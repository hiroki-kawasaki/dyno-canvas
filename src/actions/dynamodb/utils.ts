import { getDynamoClient } from "@lib/dynamodb";
import { getSettings } from "@actions/settings";
import { SearchParams } from "@/types";
import { QueryCommandInput } from "@aws-sdk/lib-dynamodb";

export function getErrorMessage(error: unknown): string {
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

export async function getClient() {
    const { mode, region } = await getSettings();
    return getDynamoClient(mode === 'local', region);
}

export function buildKeyFromFormat(format: string, params: Record<string, string> | undefined, isPk: boolean): string {
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

export function buildQueryInput(params: SearchParams): QueryCommandInput {
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
