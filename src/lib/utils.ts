import { DynamoItem } from '@/types';

export function sortDynamoItemKeys(item: DynamoItem): DynamoItem {
    const { PK, SK, ...others } = item;
    const sorted: Record<string, unknown> = {};

    if (PK !== undefined) {
        sorted.PK = PK;
    }
    if (SK !== undefined) {
        sorted.SK = SK;
    }
    for (const key in others) {
        sorted[key] = others[key];
    }
    return sorted as DynamoItem;
}

export function parsePlaceholders(format: string | undefined): string[] {
    if (!format) return [];
    const regex = /\{([^}]+)\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(format)) !== null) {
        matches.add(match[1]);
    }
    return Array.from(matches);
}

export function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}