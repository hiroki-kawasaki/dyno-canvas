'use server'

import {
    ListTablesCommand,
    DescribeTableCommand,
    DescribeTimeToLiveCommand,
    ScanCommand,
    ScanCommandOutput
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { getAccessPatternsForTable } from "@actions/admin";
import { logger } from "@lib/logger";
import { tableNameSchema } from '@lib/validation';
import { getSettings } from "@actions/settings";
import { AccessPatternConfig } from "@/types";
import {
    getClient,
    getErrorMessage
} from "./utils";

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
