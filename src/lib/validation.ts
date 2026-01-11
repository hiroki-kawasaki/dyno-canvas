import { z } from 'zod';

export const tableNameSchema = z.string().min(1, "Table name is required");

export const dynamoItemSchema = z.object({
    PK: z.string().min(1, "PK is required"),
    SK: z.string(),
}).passthrough();

export const accessPatternConfigSchema = z.object({
    id: z.string().min(1, "ID is required"),
    label: z.string().min(1, "Label is required"),
    description: z.string().default(""),
    pkFormat: z.string().min(1, "PK Format is required"),
    skFormat: z.string().optional(),
    indexName: z.string().optional(),
});

export const searchParamsSchema = z.object({
    tableName: tableNameSchema,
    mode: z.enum(['DIRECT', 'PATTERN']),
    pkInput: z.string().optional(),
    skInput: z.string().optional(),
    indexName: z.string().optional(),
    pkName: z.string().optional(),
    skName: z.string().optional(),
    patternConfig: accessPatternConfigSchema.optional(),
    patternParams: z.record(z.string(), z.string()).optional(),
    filters: z.record(z.string(), z.string()).optional(),
    limit: z.number().optional(),
    startKey: z.record(z.string(), z.unknown()).optional(),
}).refine(data => {
    if (data.mode === 'DIRECT' && !data.pkInput) {
        return false;
    }
    if (data.mode === 'PATTERN' && !data.patternConfig) {
        return false;
    }
    return true;
}, {
    message: "Invalid search parameters: missing PK for DIRECT or patternConfig for PATTERN",
    path: ["mode"]
});

export const createGsiSchema = z.object({
    tableName: tableNameSchema,
    indexName: z.string().min(1, "Index Name is required"),
    pk: z.string().min(1, "PK Name is required"),
    sk: z.string().optional(),
});

export const updateTtlSchema = z.object({
    tableName: tableNameSchema,
    enabled: z.boolean(),
    attributeName: z.string().min(1, "Attribute Name is required"),
});

export const batchDeleteSchema = z.object({
    tableName: tableNameSchema,
    keys: z.array(z.object({
        PK: z.string().min(1),
        SK: z.string()
    })).min(1, "At least one key is required")
});
