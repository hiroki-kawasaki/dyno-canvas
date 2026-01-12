import { AccessPatternConfig } from '@/types';

export const ACCESS_PATTERNS: AccessPatternConfig[] = [];

export const ADMIN_TABLE_NAME = process.env.DYNOCANVAS_ADMIN_TABLE_NAME || 'dyno-canvas';
export const DYNOCANVAS_ENV_NAME = process.env.DYNOCANVAS_ENV_NAME || 'local';

const regionsEnv = process.env.DYNOCANVAS_REGIONS;
let availableRegions = regionsEnv ? regionsEnv.split(',').map(r => r.trim()).filter(Boolean) : [];

if (availableRegions.length === 0) {
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    const defaultAwsRegion = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

    if (endpoint) {
        availableRegions.push('local');
    }
    availableRegions.push(defaultAwsRegion);
}

availableRegions = Array.from(new Set(availableRegions));

if (availableRegions.includes('local')) {
    availableRegions = ['local', ...availableRegions.filter(r => r !== 'local')];
}

export const AVAILABLE_REGIONS = availableRegions;
export const IS_LOCAL_AVAILABLE = availableRegions.includes('local');
export const DEFAULT_REGION = availableRegions[0];

export const getReadOnly = () => process.env.DYNOCANVAS_READONLY === 'true';

export const AUTH_CONFIG = {
    mode: process.env.DYNOCANVAS_AUTH || 'none',
    user: process.env.DYNOCANVAS_AUTH_USER || 'admin',
    pass: process.env.DYNOCANVAS_AUTH_PASS || 'dynocanvas'
};