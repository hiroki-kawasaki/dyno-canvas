'use server'

import {
    GetCommand,
    QueryCommand
} from "@aws-sdk/lib-dynamodb";
import { logger } from "@lib/logger";
import {
    searchParamsSchema
} from '@lib/validation';
import { getClient, getErrorMessage, buildQueryInput } from "./utils";
import { DynamoItem, SearchParams, SearchResponse } from "@/types";
import { marshall } from "@aws-sdk/util-dynamodb";

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

export async function getSearchCount(params: SearchParams) {
    try {
        const validated = searchParamsSchema.parse(params);
        const client = await getClient();
        const queryInput = buildQueryInput(validated);

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
