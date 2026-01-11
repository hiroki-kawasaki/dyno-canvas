'use server'

import { ListTablesCommand, CreateTableCommand, CreateTableCommandInput, PutItemCommand, PutItemCommandInput, QueryCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { getDynamoClient } from "@lib/dynamodb";
import { ADMIN_TABLE_NAME, DYNOCANVAS_ENV_NAME } from "@lib/config";
import { getSettings } from "@actions/settings";
import { AccessPatternDoc, AccessPatternConfig } from "@/types";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { revalidatePath } from "next/cache";


async function getAccountId(mode: 'local' | 'aws', region?: string): Promise<string> {
    if (mode === 'local') {
        return DYNOCANVAS_ENV_NAME;
    }
    try {
        const client = new STSClient({
            region: region || "ap-northeast-1"
        });
        const data = await client.send(new GetCallerIdentityCommand({}));
        return data.Account || DYNOCANVAS_ENV_NAME;
    } catch (e) {
        console.warn("Failed to get AWS Account ID, falling back to Env Name", e);
        return DYNOCANVAS_ENV_NAME;
    }
}

export async function checkAdminTableExists(region?: string): Promise<boolean> {
    const { mode, region: currentRegion } = await getSettings();
    const client = getDynamoClient(mode === 'local', region || currentRegion);
    try {
        const data = await client.send(new ListTablesCommand({}));
        return (data.TableNames || []).includes(ADMIN_TABLE_NAME);
    } catch (error) {
        console.error("Failed to list tables for checking admin table:", error);
        return false;
    }
}

export async function createAdminTable() {
    const { mode, region } = await getSettings();
    const client = getDynamoClient(mode === 'local', region);

    const input: CreateTableCommandInput = {
        TableName: ADMIN_TABLE_NAME,
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

    try {
        await client.send(new CreateTableCommand(input));
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to create admin table:", error);
        return { success: false, error: String(error) };
    }
}

export async function getAccessPatternsForTable(targetTableName: string): Promise<AccessPatternDoc[]> {
    const { mode, region } = await getSettings();
    const client = getDynamoClient(mode === 'local', region);
    const accountId = await getAccountId(mode, region);

    const regionKey = mode === 'local' ? 'dynamodb-local' : region;

    const pk = `AccountId#${accountId}#DynoCanvas#AccessPattern`;
    const skPrefix = `Region#${regionKey}#TableName#${targetTableName}#`;

    try {
        const result = await client.send(new QueryCommand({
            TableName: ADMIN_TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": { S: pk },
                ":sk": { S: skPrefix }
            }
        }));

        if (!result.Items) return [];

        return result.Items.map(item => unmarshall(item) as AccessPatternDoc);
    } catch (error) {
        console.error("Failed to get access patterns:", error);
        return [];
    }
}

export async function getAllAccessPatterns(): Promise<AccessPatternDoc[]> {
    const { mode, region } = await getSettings();
    const client = getDynamoClient(mode === 'local', region);
    const accountId = await getAccountId(mode, region);

    const regionKey = mode === 'local' ? 'dynamodb-local' : region;
    const pk = `AccountId#${accountId}#DynoCanvas#AccessPattern`;
    const skPrefix = `Region#${regionKey}#`;

    try {
        const result = await client.send(new QueryCommand({
            TableName: ADMIN_TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": { S: pk },
                ":sk": { S: skPrefix }
            }
        }));

        if (!result.Items) return [];

        return result.Items.map(item => unmarshall(item) as AccessPatternDoc);
    } catch (error) {
        console.error("Failed to get all access patterns:", error);
        return [];
    }
}

export async function saveAccessPattern(targetTableName: string, config: AccessPatternConfig, allowOverwrite: boolean = true) {
    const { mode, region } = await getSettings();
    const client = getDynamoClient(mode === 'local', region);
    const accountId = await getAccountId(mode, region);
    const regionKey = mode === 'local' ? 'dynamodb-local' : region;

    const timestamp = new Date().toISOString();

    const doc: AccessPatternDoc = {
        PK: `AccountId#${accountId}#DynoCanvas#AccessPattern`,
        SK: `Region#${regionKey}#TableName#${targetTableName}#AccessPatternId#${config.id}`,
        AccountId: accountId,
        Region: regionKey,
        TableName: targetTableName,
        AccessPatternId: config.id,
        Label: config.label,
        Description: config.description,
        GSIName: config.indexName,
        PKFormat: config.pkFormat,
        SKFormat: config.skFormat,
        CreatedAt: timestamp,
        UpdatedAt: timestamp
    };

    const input: PutItemCommandInput = {
        TableName: ADMIN_TABLE_NAME,
        Item: marshall(doc, { removeUndefinedValues: true })
    };

    if (!allowOverwrite) {
        input.ConditionExpression = "attribute_not_exists(PK) AND attribute_not_exists(SK)";
    }

    try {
        await client.send(new PutItemCommand(input));
        revalidatePath(`/tables/${targetTableName}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to save access pattern:", error);
        if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
            return { success: false, error: "PatternAlreadyExists" };
        }
        return { success: false, error: String(error) };
    }
}

export async function deleteAccessPattern(targetTableName: string, patternId: string) {
    const { mode, region } = await getSettings();
    const client = getDynamoClient(mode === 'local', region);
    const accountId = await getAccountId(mode, region);
    const regionKey = mode === 'local' ? 'dynamodb-local' : region;

    const pk = `AccountId#${accountId}#DynoCanvas#AccessPattern`;
    const sk = `Region#${regionKey}#TableName#${targetTableName}#AccessPatternId#${patternId}`;

    try {
        await client.send(new DeleteItemCommand({
            TableName: ADMIN_TABLE_NAME,
            Key: {
                PK: { S: pk },
                SK: { S: sk }
            }
        }));
        revalidatePath(`/tables/${targetTableName}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete access pattern:", error);
        return { success: false, error: String(error) };
    }
}
