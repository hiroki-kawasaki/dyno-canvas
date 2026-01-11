'use server'

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { IS_LOCAL_AVAILABLE, DEFAULT_REGION, AVAILABLE_REGIONS, ALLOW_DELETE_TABLE } from '@lib/config';
import { Language } from '@/types';
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export type EnvMode = 'aws' | 'local';

export async function switchEnvMode(mode: EnvMode) {
    if (mode === 'local') {
        await switchRegion('local');
    } else {
        const target = AVAILABLE_REGIONS.find(r => r !== 'local') || DEFAULT_REGION;
        await switchRegion(target);
    }
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
    revalidatePath('/');
}

export async function switchLanguage(lang: Language) {
    const cookieStore = await cookies();
    cookieStore.set('db-language', lang, { path: '/' });
    revalidatePath('/');
}

export async function getSettings() {
    const cookieStore = await cookies();
    const modeRaw = cookieStore.get('db-mode')?.value;
    const regionRaw = cookieStore.get('db-region')?.value;
    const langRaw = cookieStore.get('db-language')?.value;

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

    const allowDelete = mode === 'local' || ALLOW_DELETE_TABLE;
    let accountId = 'Unknown';

    if (mode === 'local') {
        accountId = 'Local';
    } else {
        try {
            const client = new STSClient({ region });
            const data = await client.send(new GetCallerIdentityCommand({}));
            accountId = data.Account || 'Unknown';
        } catch (e) {
            console.error("Failed to fetch account ID:", e);
        }
    }

    const sidebarOpen = cookieStore.get('sidebar-open')?.value !== 'false';

    return {
        mode,
        region,
        language: (langRaw === 'ja' ? 'ja' : 'en') as Language,
        availableRegions: AVAILABLE_REGIONS,
        allowDelete,
        accountId,
        sidebarOpen
    };
}

export async function getSystemStatus() {
    return {
        isLocalAvailable: IS_LOCAL_AVAILABLE,
        defaultRegion: DEFAULT_REGION,
        availableRegions: AVAILABLE_REGIONS
    };
}