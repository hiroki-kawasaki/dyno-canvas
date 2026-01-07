export type SearchMode = 'DIRECT' | 'PATTERN';

export interface AccessPatternConfig {
    id: string;
    label: string;
    description: string;
    pkFormat: string;
    skFormat?: string;
    indexName?: string;
}

export interface AccessPatternDoc {
    PK: string;
    SK: string;
    AccountId: string;
    Region: string;
    TableName: string;
    AccessPatternId: string;
    Label: string;
    Description: string;
    GSIName?: string;
    PKFormat: string;
    SKFormat?: string;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface DynamoItem {
    [key: string]: unknown;
    PK: string;
    SK: string;
}

export interface SearchParams {
    tableName: string;
    mode: SearchMode;
    pkInput?: string;
    skInput?: string;
    indexName?: string;
    pkName?: string;
    skName?: string;
    patternConfig?: AccessPatternConfig;
    patternParams?: Record<string, string>;
    filters?: Record<string, string>;
    limit?: number;
    startKey?: Record<string, unknown>;
}

export interface SearchResponse {
    success: boolean;
    data?: DynamoItem[];
    lastEvaluatedKey?: Record<string, unknown>;
    error?: string;
}

export type Language = 'en' | 'ja';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}