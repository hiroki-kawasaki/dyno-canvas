'use server'

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
    IS_LOCAL_AVAILABLE,
    DEFAULT_REGION,
    AVAILABLE_REGIONS,
    getReadOnly,
    ADMIN_TABLE_NAME
} from '@lib/config';
import { Language } from '@/types';
import { logger } from '@lib/logger';

export type EnvMode = 'aws' | 'local';

export async function getAvailableProfiles(): Promise<string[]> {
    const profiles = new Set<string>();
    const home = os.homedir();

    const files = [
        process.env.AWS_SHARED_CREDENTIALS_FILE || path.join(home, '.aws', 'credentials'),
        process.env.AWS_CONFIG_FILE || path.join(home, '.aws', 'config')
    ];

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.trim().match(/^\[\s*(?:profile\s+)?([^\]]+)\s*\]$/);
                if (match) {
                    profiles.add(match[1]);
                }
            }
        } catch {
            logger.warn({ err: 'Failed to read file', file }, 'Failed to read AWS credentials file');
        }
    }

    return Array.from(profiles).sort();
}

export async function switchEnvMode(mode: EnvMode) {
    if (mode === 'local') {
        await switchRegion('local');
    } else {
        const target = AVAILABLE_REGIONS.find(r => r !== 'local') || DEFAULT_REGION;
        await switchRegion(target);
    }
}

export async function switchProfile(profile: string) {
    const cookieStore = await cookies();
    cookieStore.set('db-mode', 'aws', { path: '/' });
    cookieStore.set('db-profile', profile, { path: '/' });

    const currentRegion = cookieStore.get('db-region')?.value;
    if (currentRegion === 'local' || !currentRegion) {
        const targetRegion = AVAILABLE_REGIONS.find(r => r !== 'local') || DEFAULT_REGION;
        cookieStore.set('db-region', targetRegion, { path: '/' });
    }

    revalidatePath('/', 'layout');
}

export async function switchRegion(region: string) {
    const cookieStore = await cookies();

    if (region === 'local') {
        if (!IS_LOCAL_AVAILABLE) return;
        cookieStore.set('db-mode', 'local', { path: '/' });
        cookieStore.set('db-region', 'local', { path: '/' });
    } else {
        cookieStore.set('db-mode', 'aws', { path: '/' });
        cookieStore.set('db-region', region, { path: '/' });
    }
    revalidatePath('/', 'layout');
}

export async function switchLanguage(lang: Language) {
    const cookieStore = await cookies();
    cookieStore.set('db-language', lang, { path: '/' });
    revalidatePath('/', 'layout');
}

export async function getSettings() {
    const cookieStore = await cookies();
    const modeRaw = cookieStore.get('db-mode')?.value;
    const regionRaw = cookieStore.get('db-region')?.value;
    const langRaw = cookieStore.get('db-language')?.value;
    const profileRaw = cookieStore.get('db-profile')?.value;

    let mode: EnvMode = (modeRaw === 'local' ? 'local' : 'aws');
    let region = regionRaw || DEFAULT_REGION;

    if (mode === 'local' && !IS_LOCAL_AVAILABLE) {
        mode = 'aws';
        region = DEFAULT_REGION === 'local' ? (AVAILABLE_REGIONS.find(r => r !== 'local') || 'ap-northeast-1') : DEFAULT_REGION;
    }

    if (mode === 'local') {
        region = 'local';
    } else {
        if (region === 'local') {
            region = AVAILABLE_REGIONS.find(r => r !== 'local') || DEFAULT_REGION;
            if (region === 'local') region = 'ap-northeast-1';
        }
    }

    const availableProfiles = await getAvailableProfiles();
    const currentProfile = profileRaw || (availableProfiles.includes('default') ? 'default' : availableProfiles[0]);

    const readOnly = getReadOnly();
    let accountId = 'Unknown';

    if (mode === 'local') {
        accountId = 'Local';
    } else {
        try {
            const { fromIni } = await import("@aws-sdk/credential-providers");
            const credentials = currentProfile ? fromIni({ profile: currentProfile }) : undefined;

            const client = new STSClient({ region, credentials });
            const data = await client.send(new GetCallerIdentityCommand({}));
            accountId = data.Account || 'Unknown';
        } catch (e) {
            logger.error({ err: e }, "Failed to fetch account ID");
        }
    }

    const sidebarOpen = cookieStore.get('sidebar-open')?.value !== 'false';

    return {
        mode,
        region,
        currentProfile,
        availableProfiles,
        language: (langRaw === 'ja' ? 'ja' : 'en') as Language,
        availableRegions: AVAILABLE_REGIONS,
        readOnly,
        accountId,
        sidebarOpen,
        adminTableName: ADMIN_TABLE_NAME
    };
}

export async function getSystemStatus() {
    return {
        isLocalAvailable: IS_LOCAL_AVAILABLE,
        defaultRegion: DEFAULT_REGION,
        availableRegions: AVAILABLE_REGIONS
    };
}

export async function setSearchLimit(limit: number) {
    const cookieStore = await cookies();
    cookieStore.set('db-limit', limit.toString(), { path: '/' });
}
