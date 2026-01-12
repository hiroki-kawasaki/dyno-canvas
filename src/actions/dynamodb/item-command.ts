'use server'

import {
    PutCommand,
    DeleteCommand,
    UpdateCommand,
    BatchWriteCommand,
    TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { logger } from "@lib/logger";
import {
    tableNameSchema,
    dynamoItemSchema,
    batchDeleteSchema
} from '@lib/validation';
import { getReadOnly } from "@lib/config";
import { DynamoItem } from "@/types";
import {
    getClient,
    getErrorMessage,
    buildUpdateExpression,
    getTableKeys
} from "./utils";

export async function createItem(
    tableName: string,
    item: unknown
) {
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
        tableNameSchema.parse(tableName);

        const validItem = dynamoItemSchema.parse(item);

        const client = await getClient();
        const keys = await getTableKeys(tableName);
        const pkName = keys.pkName || 'PK';
        const skName = keys.skName || 'SK';

        const conditionExpression = skName
            ? `attribute_not_exists(${pkName}) AND attribute_not_exists(${skName})`
            : `attribute_not_exists(${pkName})`;

        await client.send(new PutCommand({
            TableName: tableName,
            Item: validItem,
            ConditionExpression: conditionExpression
        }));

        logger.info({
            tableName,
            pk: validItem[pkName],
            sk: skName ? validItem[skName] : undefined
        }, "Item created successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName, item }, "CreateItem Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteItem(
    tableName: string,
    pk: string,
    sk?: string
) {
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
        tableNameSchema.parse(tableName);
        if (!pk) throw new Error("PK is required");

        const client = await getClient();
        const keys = await getTableKeys(tableName);
        const pkName = keys.pkName || 'PK';
        const skName = keys.skName || 'SK';

        const Key: Record<string, string> = { [pkName]: pk };
        if (skName && sk) {
            Key[skName] = sk;
        }

        await client.send(new DeleteCommand({
            TableName: tableName,
            Key
        }));
        logger.info({ tableName, pk, sk }, "Item deleted successfully");
        return { success: true };
    } catch (error) {
        logger.error({ err: error, tableName, pk, sk }, "DeleteItem Error");
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function batchDeleteItems(
    tableName: string,
    keysIn: { PK: string; SK: string }[]
) {
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };

        const validated = batchDeleteSchema.parse({ tableName, keys: keysIn });
        const client = await getClient();
        const keys = await getTableKeys(tableName);
        const pkName = keys.pkName || 'PK';
        const skName = keys.skName || 'SK';

        const chunkSize = 25;
        const errors: string[] = [];
        let deletedCount = 0;

        for (let i = 0; i < validated.keys.length; i += chunkSize) {
            const chunk = validated.keys.slice(i, i + chunkSize);
            const deleteRequests = chunk.map(key => {
                const Key: Record<string, string> = { [pkName]: key.PK };
                if (skName) {
                    Key[skName] = key.SK;
                }
                return {
                    DeleteRequest: { Key }
                };
            });

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

export async function updateItem(tableName: string, item: DynamoItem) {
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
        tableNameSchema.parse(tableName);
        const validated = dynamoItemSchema.parse(item);

        const client = await getClient();
        const keys = await getTableKeys(tableName);
        const pkName = keys.pkName || 'PK';
        const skName = keys.skName || 'SK';

        const pkValue = validated[pkName] as string;
        const skValue = skName ? validated[skName] as string : undefined;

        if (!pkValue || (skName && !skValue)) {
            throw new Error(`Primary keys (${pkName}${skName ? `, ${skName}` : ''}) are required for update.`);
        }

        const Key: Record<string, string> = { [pkName]: pkValue };
        if (skName && skValue) {
            Key[skName] = skValue;
        }

        const attributes = { ...item };
        delete attributes[pkName];
        if (skName) delete attributes[skName];

        let updateData;
        try {
            updateData = buildUpdateExpression(attributes);
        } catch (e) {
            if (e instanceof Error && e.message === "No attributes to update") {
                return { success: true, message: "No attributes to update." };
            }
            throw e;
        }

        const input = {
            TableName: tableName,
            Key,
            ...updateData,
            ReturnValues: "ALL_NEW" as const,
        };

        await client.send(new UpdateCommand(input));
        logger.info({ tableName, pk: pkValue, sk: skValue }, "Item updated successfully");
        return { success: true };

    } catch (err) {
        logger.error({ err, tableName, item }, "DynamoDB Update Error");
        return {
            success: false,
            error: getErrorMessage(err)
        };
    }
}

export async function replaceItem(
    tableName: string,
    oldKey: { PK: string, SK: string },
    newItem: DynamoItem
) {
    try {
        if (getReadOnly()) return { success: false, error: "Operation not allowed in Read-Only mode." };
        tableNameSchema.parse(tableName);
        dynamoItemSchema.parse(newItem);

        const client = await getClient();
        const keys = await getTableKeys(tableName);
        const pkName = keys.pkName || 'PK';
        const skName = keys.skName || 'SK';

        const DeleteKey: Record<string, string> = { [pkName]: oldKey.PK };
        if (skName) DeleteKey[skName] = oldKey.SK;

        await client.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Delete: {
                        TableName: tableName,
                        Key: DeleteKey
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
        logger.info({ tableName, oldPk: oldKey.PK, newPk: newItem[pkName] }, "Item replaced successfully");
        return { success: true };
    } catch (err) {
        logger.error({ err, tableName }, "DynamoDB Replace Error");
        return { success: false, error: getErrorMessage(err) };
    }
}
