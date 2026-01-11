import { z } from 'zod';

// Reusable schemas based on DynamoDB naming rules
// Tables and Indexes: 3-255 characters, allowed: a-z, A-Z, 0-9, '_', '-', '.'
const nameSchema = z.string()
    .min(3, "Name must be at least 3 characters")
    .max(255, "Name must be at most 255 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid name format. Allowed: a-z, A-Z, 0-9, '_', '-', '.'");

// Attribute names: 1-255 characters.
// While DynamoDB allows special chars in attributes, for keys and management we enforce standard safe chars.
const attributeNameSchema = z.string()
    .min(1, "Attribute name is required")
    .max(255, "Attribute name too long")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid attribute name format. Allowed: a-z, A-Z, 0-9, '_', '-', '.'");

// IDs for internal config (access patterns etc): strict slug
const idSchema = z.string()
    .min(1, "ID is required")
    .max(128, "ID too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format. Allowed: a-z, A-Z, 0-9, '_', '-'");

export const tableNameSchema = nameSchema;

export const dynamoItemSchema = z.looseObject({
    PK: z.string().min(1, "PK is required"),
    SK: z.string(),
});

export const accessPatternConfigSchema = z.object({
    id: idSchema,
    label: z.string().min(1, "Label is required").max(100),
    description: z.string().max(500).default(""),
    pkFormat: z.string().min(1, "PK Format is required"),
    skFormat: z.string().optional(),
    indexName: nameSchema.optional(),
});

export const searchParamsSchema = z.object({
    tableName: tableNameSchema,
    mode: z.enum(['DIRECT', 'PATTERN']),
    pkInput: z.string().optional(),
    skInput: z.string().optional(),
    indexName: nameSchema.optional(),
    pkName: attributeNameSchema.optional(),
    skName: attributeNameSchema.optional(),
    patternConfig: accessPatternConfigSchema.optional(),
    patternParams: z.record(z.string(), z.string()).optional(),
    filters: z.record(z.string(), z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
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
    indexName: nameSchema,
    pk: attributeNameSchema,
    sk: attributeNameSchema.optional(),
});

export const updateTtlSchema = z.object({
    tableName: tableNameSchema,
    enabled: z.boolean(),
    attributeName: attributeNameSchema,
});

export const batchDeleteSchema = z.object({
    tableName: tableNameSchema,
    keys: z.array(z.object({
        PK: z.string().min(1),
        SK: z.string()
    })).min(1, "At least one key is required")
        .max(25, "Cannot delete more than 25 items at once")
});
