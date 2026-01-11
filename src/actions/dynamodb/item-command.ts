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
import { getClient, getErrorMessage } from "./utils";
import { DynamoItem } from "@/types";

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
