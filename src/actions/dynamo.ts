'use server'

import {
    ListTablesCommand,
    CreateTableCommand,
    CreateTableCommandInput,
    DeleteTableCommand,
    ScanCommand,
    ScanCommandOutput,
    DescribeTableCommand,
    UpdateTableCommand,
    DescribeTimeToLiveCommand,
    UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import {
    QueryCommand,
    UpdateCommand,
    PutCommand,
    DeleteCommand,
    TransactWriteCommand,
    QueryCommandInput,
    GetCommand,
    BatchWriteCommand,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { getDynamoClient } from "@/lib/dynamodb";
import { DynamoItem, AccessPatternConfig, SearchParams, SearchResponse } from "@/types";
import { revalidatePath } from 'next/cache';
import { getSettings } from "@/actions/settings";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ALLOW_DELETE_TABLE } from "@/lib/config";
import {
    getAccessPatternsForTable,
    saveAccessPattern,
    deleteAccessPattern as deleteAdminPattern
} from "@/actions/admin";
import { Readable } from 'stream';
import readline from 'readline';
import { logger } from "@/lib/logger";
import {
    tableNameSchema,
    dynamoItemSchema,
    batchDeleteSchema,
    searchParamsSchema,
    createGsiSchema,
    updateTtlSchema,
    accessPatternConfigSchema
} from '@/lib/validation';

function getErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        const msg = (error as Error).message;
        const name = (error as { name?: string }).name;

        if (name === 'ResourceNotFoundException') return "Table or Resource not found.";
        if (name === 'ProvisionedThroughputExceededException') return "Provisioned throughput exceeded.";
        if (name === 'ConditionalCheckFailedException') return "Item already exists or condition failed.";
        if (name === 'ValidationException') return `Validation Error: ${msg}`;
        if (name === 'AccessDeniedException') return "Access Denied.";

        return msg;
    }
    return "Unknown error occurred.";
}

async function getClient() {
    const { mode, region } = await getSettings();
    return getDynamoClient(mode === 'local', region);
}

export async function listTables(): Promise<string[]> {
    try {
        const client = await getClient();
        const data = await client.send(new ListTablesCommand({}));
        return data.TableNames || [];
    } catch (error) {
        logger.error({ err: error }, "Failed to list tables");
        return [];
    }
}

export async function createTable(tableName: string) {
    try {
        const validName = tableNameSchema.parse(tableName);
        const client = await getClient();
        const input: CreateTableCommandInput = {
            TableName: validName,
            KeySchema: [
                { AttributeName: "PK", KeyType: "HASH" },
                { AttributeName: "SK", KeyType: "RANGE" }
            ],
            AttributeDefinitions: [
                { AttributeName: "PK", AttributeType: "S" },
                { AttributeName: "SK", AttributeType: "S" }
            ],
            BillingMode: "PAY_PER_REQUEST"
        };

        await client.send(new CreateTableCommand(input));
        revalidatePath('/');
        logger.info({ tableName: validName }, "Table created successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to create table");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteTable(tableName: string) {
    try {
        const validName = tableNameSchema.parse(tableName);
        const { mode } = await getSettings();
        if (mode !== 'local' && !ALLOW_DELETE_TABLE) {
            return { success: false, error: "Table deletion is not allowed in this environment." };
        }
        const client = await getClient();
        await client.send(new DeleteTableCommand({ TableName: validName }));
        revalidatePath('/');
        logger.info({ tableName: validName }, "Table deleted successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to delete table");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getItem(tableName: string, pk: string, sk: string): Promise<DynamoItem | undefined> {
    try {
        const client = await getClient();
        const data = await client.send(new GetCommand({
            TableName: tableName,
            Key: { PK: pk, SK: sk },
        }));
        return data.Item as DynamoItem | undefined;
    } catch (error) {
        console.error("GetItem Error:", error);
        return undefined;
    }
}

export async function createItem(tableName: string, item: DynamoItem) {
    try {
        tableNameSchema.parse(tableName);
        dynamoItemSchema.parse(item);

        const client = await getClient();
        await client.send(new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));
        logger.info({ tableName, pk: item.PK, sk: item.SK }, "Item created successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName, item }, "CreateItem Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteItem(tableName: string, pk: string, sk: string) {
    try {
        tableNameSchema.parse(tableName);
        if (!pk) throw new Error("PK is required");

        const client = await getClient();
        await client.send(new DeleteCommand({
            TableName: tableName,
            Key: { PK: pk, SK: sk }
        }));
        logger.info({ tableName, pk, sk }, "Item deleted successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName, pk, sk }, "DeleteItem Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function batchDeleteItems(tableName: string, keys: { PK: string; SK: string }[]) {
    try {
        const validated = batchDeleteSchema.parse({ tableName, keys });
        const client = await getClient();
        const chunkSize = 25;
        const errors: string[] = [];
        let deletedCount = 0;

        for (let i = 0; i < validated.keys.length; i += chunkSize) {
            const chunk = validated.keys.slice(i, i + chunkSize);
            const deleteRequests = chunk.map(key => ({
                DeleteRequest: {
                    Key: { PK: key.PK, SK: key.SK }
                }
            }));

            try {
                await client.send(new BatchWriteCommand({
                    RequestItems: {
                        [tableName]: deleteRequests
                    }
                }));
                deletedCount += chunk.length;
            } catch (err) {
                logger.error({ err, tableName, chunk }, "Batch delete chunk error");
                errors.push(String(err));
            }
        }

        if (errors.length > 0) {
            return { success: false, error: errors.join(", ") };
        }

        logger.info({ tableName, count: deletedCount }, "Batch delete items successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName }, "BatchDeleteItem Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getAccessPatterns(tableName: string): Promise<AccessPatternConfig[]> {
    try {
        tableNameSchema.parse(tableName);
        const patterns = await getAccessPatternsForTable(tableName);
        return patterns.map(p => ({
            id: p.AccessPatternId,
            label: p.Label,
            description: p.Description,
            pkFormat: p.PKFormat,
            skFormat: p.SKFormat,
            indexName: p.GSIName
        }));
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to fetch access patterns");
        return [];
    }
}

export async function upsertAccessPattern(tableName: string, config: AccessPatternConfig, allowOverwrite: boolean = true) {
    try {
        tableNameSchema.parse(tableName);
        accessPatternConfigSchema.parse(config);
        logger.info({ tableName, patternId: config.id }, "Upserting access pattern");
        return saveAccessPattern(tableName, config, allowOverwrite);
    } catch (error) {
        logger.error({ err: error, tableName, config }, "UpsertAccessPattern Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteAccessPattern(tableName: string, patternId: string) {
    return deleteAdminPattern(tableName, patternId);
}

function buildKeyFromFormat(format: string, params: Record<string, string> | undefined, isPk: boolean): string {
    if (!params) {
        if (isPk && format.includes('{')) {
            throw new Error("PK parameters are missing.");
        }
        return isPk ? format : "";
    }

    let result = "";
    const regex = /([^{]*)\{([^}]+)\}/g;

    let match;
    let lastIndex = 0;

    while ((match = regex.exec(format)) !== null) {
        const [, prefix, key] = match;
        const value = params[key];

        result += prefix;

        if (!value) {
            if (isPk) {
                throw new Error(`Missing required param for PK: ${key}`);
            } else {
                return result;
            }
        }

        result += value;
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < format.length) {
        result += format.substring(lastIndex);
    }

    return result;
}

function buildQueryInput(params: SearchParams): QueryCommandInput {
    const queryInput: QueryCommandInput = {
        TableName: params.tableName,
        Limit: params.limit || 100,
    };

    if (params.startKey) {
        queryInput.ExclusiveStartKey = params.startKey;
    }

    if (params.mode === 'DIRECT') {
        if (!params.pkInput) throw new Error("Partition Key is required");

        if (params.indexName) {
            queryInput.IndexName = params.indexName;
        }

        const pkName = params.pkName || (params.indexName ? 'GSI1PK' : 'PK');
        const skName = params.skName || (params.indexName ? 'GSI1SK' : 'SK');

        queryInput.KeyConditionExpression = `${pkName} = :pk`;
        queryInput.ExpressionAttributeValues = { ':pk': params.pkInput };

        if (params.skInput) {
            queryInput.KeyConditionExpression += ` AND begins_with(${skName}, :sk)`;
            queryInput.ExpressionAttributeValues[':sk'] = params.skInput;
        }
    }
    else if (params.mode === 'PATTERN') {
        const pattern = params.patternConfig;
        if (!pattern) throw new Error("Access Pattern Config is missing");

        if (pattern.indexName) queryInput.IndexName = pattern.indexName;

        let fullPk = "";
        if (pattern.pkFormat) {
            fullPk = buildKeyFromFormat(pattern.pkFormat, params.patternParams, true);
        } else {
            throw new Error("PK Format is not defined in pattern config.");
        }

        let fullSk = "";
        if (pattern.skFormat) {
            fullSk = buildKeyFromFormat(pattern.skFormat, params.patternParams, false);
        }

        const pkName = params.pkName || (pattern.indexName ? 'GSI1PK' : 'PK');
        const skName = params.skName || (pattern.indexName ? 'GSI1SK' : 'SK');

        queryInput.KeyConditionExpression = `${pkName} = :pk`;
        queryInput.ExpressionAttributeValues = { ':pk': fullPk };

        if (fullSk) {
            queryInput.KeyConditionExpression += ` AND begins_with(${skName}, :sk)`;
            queryInput.ExpressionAttributeValues[':sk'] = fullSk;
        }
    }

    if (params.filters && Object.keys(params.filters).length > 0) {
        const expressions: string[] = [];
        Object.entries(params.filters).forEach(([k, v], i) => {
            if (!v) return;
            const keyMap = `#fName${i}`;
            const valMap = `:fVal${i}`;
            expressions.push(`${keyMap} = ${valMap}`);
            queryInput.ExpressionAttributeNames = {
                ...queryInput.ExpressionAttributeNames,
                [keyMap]: k
            };
            queryInput.ExpressionAttributeValues = queryInput.ExpressionAttributeValues || {};
            queryInput.ExpressionAttributeValues[valMap] = v;
        });
        if (expressions.length > 0) {
            queryInput.FilterExpression = expressions.join(' AND ');
        }
    }

    return queryInput;
}

export async function searchItems(params: SearchParams): Promise<SearchResponse> {
    try {
        const validated = searchParamsSchema.parse(params);
        const client = await getClient();
        const queryInput = buildQueryInput(validated);
        const res = await client.send(new QueryCommand(queryInput));
        return {
            success: true,
            data: res.Items as DynamoItem[],
            lastEvaluatedKey: res.LastEvaluatedKey
        };

    } catch (err) {
        logger.error({ err, params }, "DynamoDB Search Error");
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function updateItem(tableName: string, item: DynamoItem) {
    try {
        tableNameSchema.parse(tableName);
        dynamoItemSchema.parse(item);
        const client = await getClient();
        const { PK, SK, ...attributes } = item;

        if (!PK || !SK) {
            throw new Error("Primary keys (PK, SK) are required for update.");
        }

        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, unknown> = {};

        Object.entries(attributes).forEach(([key, value], index) => {
            const attrNamePlaceholder = `#attr${index}`;
            const attrValuePlaceholder = `:val${index}`;

            updateExpressions.push(`${attrNamePlaceholder} = ${attrValuePlaceholder}`);
            expressionAttributeNames[attrNamePlaceholder] = key;
            expressionAttributeValues[attrValuePlaceholder] = value;
        });

        if (updateExpressions.length === 0) {
            return { success: true, message: "No attributes to update." };
        }

        const input = {
            TableName: tableName,
            Key: { PK, SK },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW" as const,
        };

        await client.send(new UpdateCommand(input));
        logger.info({ tableName, pk: PK, sk: SK }, "Item updated successfully");
        return { success: true };

    } catch (err) {
        logger.error({ err, tableName, item }, "DynamoDB Update Error");
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function replaceItem(tableName: string, oldKey: { PK: string, SK: string }, newItem: DynamoItem) {
    try {
        tableNameSchema.parse(tableName);
        dynamoItemSchema.parse(newItem);

        const client = await getClient();
        await client.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Delete: {
                        TableName: tableName,
                        Key: { PK: oldKey.PK, SK: oldKey.SK }
                    }
                },
                {
                    Put: {
                        TableName: tableName,
                        Item: newItem
                    }
                }
            ]
        }));
        logger.info({ tableName, oldPk: oldKey.PK, newPk: newItem.PK }, "Item replaced successfully");
        return { success: true };
    } catch (err) {
        logger.error({ err, tableName }, "DynamoDB Replace Error");
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function getSearchCount(params: SearchParams) {
    try {
        const validated = searchParamsSchema.parse(params);
        const client = await getClient();
        const queryInput = buildQueryInput(validated);
        // ...
        queryInput.Select = 'COUNT';
        delete queryInput.Limit;

        let totalCount = 0;
        let lastEvaluatedKey = undefined;

        do {
            queryInput.ExclusiveStartKey = lastEvaluatedKey;
            const res = await client.send(new QueryCommand(queryInput));
            totalCount += res.Count || 0;
            lastEvaluatedKey = res.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return { success: true, count: totalCount };
    } catch (err) {
        logger.error({ err, params }, "Count Error");
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function exportAllItems(params: SearchParams) {
    try {
        const validated = searchParamsSchema.parse(params);
        const client = await getClient();

        const queryInput = buildQueryInput(validated);
        // ...
        delete queryInput.Limit;

        let items: Record<string, unknown>[] = [];
        let lastEvaluatedKey = undefined;

        do {
            queryInput.ExclusiveStartKey = lastEvaluatedKey;
            const res = await client.send(new QueryCommand(queryInput));
            if (res.Items) {
                items = items.concat(res.Items);
            }
            lastEvaluatedKey = res.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        const lines = items.map(item => {
            const marshalled = marshall(item, { removeUndefinedValues: true, convertClassInstanceToMap: false });
            return JSON.stringify({ Item: marshalled });
        });

        logger.info({ count: items.length }, "Exported items successfully");
        return { success: true, data: lines.join('\n') };

    } catch (err) {
        logger.error({ err }, "Export Error");
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function exportTable(tableName: string) {
    try {
        const client = await getClient();
        let items: Record<string, unknown>[] = [];
        let lastEvaluatedKey = undefined;

        do {
            const res: ScanCommandOutput = await client.send(new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastEvaluatedKey
            }));
            if (res.Items) {
                items = items.concat(res.Items);
            }
            lastEvaluatedKey = res.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        const lines = items.map(item => {
            const marshalled = marshall(item, { removeUndefinedValues: true, convertClassInstanceToMap: false });
            return JSON.stringify({ Item: marshalled });
        });

        return { success: true, data: lines.join('\n') };

    } catch (err) {
        console.error("Export Table Error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function importItems(tableName: string, formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error("No file uploaded");

        const client = await getClient();
        const chunkSize = 25;
        let importedCount = 0;
        const errors: string[] = [];

        const stream = file.stream();
        // @ts-expect-error: Readable.fromWeb matches web streams
        const nodeStream = Readable.fromWeb(stream);
        const rl = readline.createInterface({
            input: nodeStream,
            crlfDelay: Infinity
        });

        let currentChunk: DynamoItem[] = [];

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const jsonObj = JSON.parse(line);
                if (!jsonObj.Item) {
                    errors.push("Missing 'Item' property in a line");
                    continue;
                }
                const unmarshalled = unmarshall(jsonObj.Item) as DynamoItem;
                currentChunk.push(unmarshalled);
            } catch (e) {
                errors.push(`Parse error: ${getErrorMessage(e)}`);
            }

            if (currentChunk.length >= chunkSize) {
                await processBatch(tableName, client, currentChunk, errors);
                importedCount += currentChunk.length;
                currentChunk = [];
            }
        }

        if (currentChunk.length > 0) {
            await processBatch(tableName, client, currentChunk, errors);
            importedCount += currentChunk.length;
        }

        if (errors.length > 0) {
            return { success: false, error: `Imported ${importedCount} items with errors: ${errors.slice(0, 3).join(", ")}...` };
        }

        revalidatePath(`/tables/${tableName}`);
        logger.info({ tableName, count: importedCount }, "Import items completed successfully");
        return { success: true, count: importedCount };

    } catch (err) {
        logger.error({ err, tableName }, "Import Error");
        return { success: false, error: getErrorMessage(err) };
    }
}

async function processBatch(tableName: string, client: DynamoDBDocumentClient, items: DynamoItem[], errors: string[]) {
    const putRequests = items.map(item => ({
        PutRequest: {
            Item: item
        }
    }));
    try {
        await client.send(new BatchWriteCommand({
            RequestItems: {
                [tableName]: putRequests
            }
        }));
    } catch (err) {
        console.error("Batch write chunk error:", err);
        errors.push(getErrorMessage(err));
    }
}

export async function exportAccessPatterns(tableName: string) {
    try {
        const patterns = await getAccessPatternsForTable(tableName);
        const lines = patterns.map(p => {
            const marshalled = marshall(p, { removeUndefinedValues: true, convertClassInstanceToMap: false });
            return JSON.stringify({ Item: marshalled });
        });

        return { success: true, data: lines.join('\n') };

    } catch (err) {
        console.error("Export Patterns Error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function getTableDetails(tableName: string) {
    try {
        tableNameSchema.parse(tableName);
        const { mode } = await getSettings();
        const client = await getClient();

        const [tableRes, ttlRes] = await Promise.all([
            client.send(new DescribeTableCommand({ TableName: tableName })),
            client.send(new DescribeTimeToLiveCommand({ TableName: tableName }))
        ]);

        return {
            success: true,
            table: tableRes.Table,
            ttl: ttlRes.TimeToLiveDescription,
            isLocal: mode === 'local'
        };
    } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'ResourceNotFoundException') {
            logger.info(`Table ${tableName} not found during detail fetch.`);
        } else {
            logger.error({ err: error, tableName }, "Failed to get table details");
        }
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function createGSI(tableName: string, indexName: string, pk: string, sk?: string) {
    try {
        const validated = createGsiSchema.parse({ tableName, indexName, pk, sk });
        const client = await getClient();

        const tableDesc = await client.send(new DescribeTableCommand({ TableName: validated.tableName }));
        // ...
        const table = tableDesc.Table;
        if (!table) throw new Error("Table not found");

        const isPayPerRequest = table.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST' ||
            (table.ProvisionedThroughput?.ReadCapacityUnits === 0 && table.ProvisionedThroughput?.WriteCapacityUnits === 0);

        const attributeDefinitions: { AttributeName: string; AttributeType: "S" | "N" | "B" }[] = [];
        const keySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[] = [
            { AttributeName: validated.pk, KeyType: "HASH" as const }
        ];

        const getAttrType = (name: string): "S" | "N" | "B" => {
            const existing = table.AttributeDefinitions?.find(ad => ad.AttributeName === name);
            return (existing?.AttributeType as "S" | "N" | "B") || "S";
        };

        attributeDefinitions.push({ AttributeName: validated.pk, AttributeType: getAttrType(validated.pk) });

        if (validated.sk) {
            if (validated.sk !== validated.pk) {
                attributeDefinitions.push({ AttributeName: validated.sk, AttributeType: getAttrType(validated.sk) });
            }
            keySchema.push({ AttributeName: validated.sk, KeyType: "RANGE" as const });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const create: any = {
            IndexName: validated.indexName,
            KeySchema: keySchema,
            Projection: {
                ProjectionType: "ALL"
            }
        };

        if (!isPayPerRequest) {
            create.ProvisionedThroughput = {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            };
        }

        await client.send(new UpdateTableCommand({
            TableName: validated.tableName,
            AttributeDefinitions: attributeDefinitions,
            GlobalSecondaryIndexUpdates: [
                {
                    Create: create
                }
            ]
        }));

        logger.info({ tableName, indexName }, "GSI created successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName, indexName }, "Failed to create GSI");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteGSI(tableName: string, indexName: string) {
    try {
        tableNameSchema.parse(tableName);
        const { mode } = await getSettings();
        if (mode !== 'local' && !ALLOW_DELETE_TABLE) {
            return { success: false, error: "GSI deletion is not allowed in this environment." };
        }

        const client = await getClient();
        await client.send(new UpdateTableCommand({
            TableName: tableName,
            GlobalSecondaryIndexUpdates: [
                {
                    Delete: {
                        IndexName: indexName
                    }
                }
            ]
        }));

        logger.info({ tableName, indexName }, "GSI deleted successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to delete GSI");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function updateTTL(tableName: string, enabled: boolean, attributeName: string) {
    try {
        const validated = updateTtlSchema.parse({ tableName, enabled, attributeName });
        const client = await getClient();
        await client.send(new UpdateTimeToLiveCommand({
            TableName: validated.tableName,
            TimeToLiveSpecification: {
                Enabled: validated.enabled,
                AttributeName: validated.attributeName
            }
        }));

        logger.info({ tableName, enabled, attributeName }, "TTL updated successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to update TTL");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function importAccessPatterns(tableName: string, formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error("No file uploaded");

        const stream = file.stream();
        // @ts-expect-error: Readable.fromWeb matches web streams
        const nodeStream = Readable.fromWeb(stream);
        const rl = readline.createInterface({
            input: nodeStream,
            crlfDelay: Infinity
        });

        let importedCount = 0;
        const errors: string[] = [];

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const jsonObj = JSON.parse(line);
                if (!jsonObj.Item) throw new Error(`Missing 'Item' property`);
                const item = unmarshall(jsonObj.Item);

                const config: AccessPatternConfig = {
                    id: item.AccessPatternId,
                    label: item.Label,
                    description: item.Description || "",
                    pkFormat: item.PKFormat || item.PK_Format,
                    skFormat: item.SKFormat || item.SK_Format,
                    indexName: item.GSIName || item.IndexName
                };

                if (!config.id || !config.label || !config.pkFormat) {
                    throw new Error("Missing required fields (id, label, pkFormat)");
                }

                await saveAccessPattern(tableName, config, true);
                importedCount++;
            } catch (e) {
                errors.push(getErrorMessage(e));
            }
        }

        if (errors.length > 0) {
            return { success: false, error: `Imported ${importedCount} patterns. Errors: ${errors.slice(0, 3).join(", ")}...` };
        }

        logger.info({ tableName, count: importedCount }, "Import access patterns completed successfully");
        return { success: true, count: importedCount };

    } catch (err) {
        logger.error({ err, tableName }, "Import Patterns Error");
        return { success: false, error: getErrorMessage(err) };
    }
}