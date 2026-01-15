'use server'

import { revalidatePath } from 'next/cache';
import { Readable } from 'stream';
import readline from 'readline';
import {
    CreateTableCommand,
    CreateTableCommandInput,
    DeleteTableCommand,
    UpdateTableCommand,
    UpdateTimeToLiveCommand,
    DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
    saveAccessPattern,
    deleteAccessPattern as deleteAdminPattern
} from "@actions/admin";
import { getReadOnly } from "@lib/config";
import { logger } from "@lib/logger";
import {
    tableNameSchema,
    createGsiSchema,
    updateTtlSchema,
    accessPatternConfigSchema
} from '@lib/validation';
import {
    DynamoItem,
    AccessPatternConfig
} from "@/types";
import {
    getClient,
    getErrorMessage
} from "./utils";


export async function createTable(tableName: string) {
    logger.debug({ tableName }, "createTable called");
    try {
        if (getReadOnly()) return {
            success: false,
            error: "Operation not allowed in Read-Only mode."
        };
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
        return {
            success: true
        };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to create table");
        return {
            success: false,
            error: getErrorMessage(error)
        };
    }
}

export async function deleteTable(tableName: string) {
    logger.debug({ tableName }, "deleteTable called");
    try {
        const validName = tableNameSchema.parse(tableName);

        if (getReadOnly()) {
            return {
                success: false,
                error: "Operation not allowed in Read-Only mode."
            };
        }
        const client = await getClient();
        await client.send(new DeleteTableCommand({ TableName: validName }));
        revalidatePath('/');
        logger.info({ tableName: validName }, "Table deleted successfully");
        return {
            success: true
        };
    } catch (error) {
        logger.error({ err: error, tableName }, "Failed to delete table");
        return {
            success: false,
            error: getErrorMessage(error)
        };
    }
}

export async function createGSI(
    tableName: string,
    indexName: string,
    pk: string,
    sk?: string
) {
    logger.debug({ tableName, indexName }, "createGSI called");
    try {
        if (getReadOnly()) return {
            success: false,
            error: "Operation not allowed in Read-Only mode."
        };
        const validated = createGsiSchema.parse({ tableName, indexName, pk, sk });
        const client = await getClient();

        const tableDesc = await client.send(new DescribeTableCommand({ TableName: validated.tableName }));

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
                attributeDefinitions.push({
                    AttributeName: validated.sk,
                    AttributeType: getAttrType(validated.sk)
                });
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

export async function deleteGSI(
    tableName: string,
    indexName: string
) {
    logger.debug({ tableName, indexName }, "deleteGSI called");
    try {
        tableNameSchema.parse(tableName);
        if (getReadOnly()) {
            return { success: false, error: "Operation not allowed in Read-Only mode." };
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

export async function updateTTL(
    tableName: string,
    enabled: boolean,
    attributeName: string
) {
    logger.debug({ tableName, enabled, attributeName }, "updateTTL called");
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
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

export async function importItems(
    tableName: string,
    formData: FormData
) {
    logger.debug({ tableName }, "importItems called");
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
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

async function processBatch(
    tableName: string,
    client: DynamoDBDocumentClient,
    items: DynamoItem[],
    errors: string[]
) {
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

export async function upsertAccessPattern(
    tableName: string,
    config: AccessPatternConfig,
    allowOverwrite: boolean = true
) {
    logger.debug({ tableName, id: config.id }, "upsertAccessPattern called");
    try {
        if (getReadOnly()) return {
            success: false,
            error: "Operation not allowed in Read-Only mode."
        };
        tableNameSchema.parse(tableName);
        accessPatternConfigSchema.parse(config);
        logger.info({ tableName, patternId: config.id }, "Upserting access pattern");
        return saveAccessPattern(tableName, config, allowOverwrite);
    } catch (error) {
        logger.error({ err: error, tableName, config }, "UpsertAccessPattern Error");
        return {
            success: false,
            error: getErrorMessage(error)
        };
    }
}

export async function deleteAccessPattern(
    tableName: string,
    patternId: string
) {
    logger.debug({ tableName, patternId }, "deleteAccessPattern (wrapper) called");
    if (getReadOnly()) return {
        success: false,
        error: "Operation not allowed in Read-Only mode."
    };
    return deleteAdminPattern(tableName, patternId);
}

export async function importAccessPatterns(
    tableName: string,
    formData: FormData
) {
    logger.debug({ tableName }, "importAccessPatterns called");
    try {
        if (getReadOnly()) return {
            success: false,
            error: "Operation not allowed in Read-Only mode."
        };
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
            return {
                success: false,
                error: `Imported ${importedCount} patterns. Errors: ${errors.slice(0, 3).join(", ")}...`
            };
        }

        logger.info({ tableName, count: importedCount }, "Import access patterns completed successfully");
        return {
            success: true,
            count: importedCount
        };

    } catch (err) {
        logger.error({ err, tableName }, "Import Patterns Error");
        return { success: false, error: getErrorMessage(err) };
    }
}
