import {
    switchEnvMode,
    switchRegion,
    switchLanguage,
    switchProfile,
    getSettings,
    getSystemStatus,
    getAvailableProfiles
} from '../settings';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
    AVAILABLE_REGIONS,
    IS_LOCAL_AVAILABLE,
    DEFAULT_REGION
} from '@lib/config';
import { promises as fs } from 'fs';

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

jest.mock("@aws-sdk/client-sts", () => ({
    STSClient: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({ Account: '123456789012' })
    })),
    GetCallerIdentityCommand: jest.fn()
}));

describe('Settings Actions', () => {
    let mockCookieStore: {
        set: jest.Mock;
        get: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCookieStore = {
            set: jest.fn(),
            get: jest.fn(),
        };
        (cookies as jest.Mock).mockResolvedValue(mockCookieStore);
    });

    describe('getAvailableProfiles', () => {
        it('should parse profiles from credentials file', async () => {
            (fs.readFile as jest.Mock).mockResolvedValue(`
[default]
aws_access_key_id = X
aws_secret_access_key = Y

[profile prod]
aws_access_key_id = A
aws_secret_access_key = B
             `);

            const profiles = await getAvailableProfiles();
            expect(profiles).toContain('default');
            expect(profiles).toContain('prod');
        });

        it('should handle file errors gracefully', async () => {
            (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
            const profiles = await getAvailableProfiles();
            expect(profiles).toEqual([]);
        });
    });

    describe('switchRegion', () => {
        it('should set cookies for local mode', async () => {
            await switchRegion('local');

            if (IS_LOCAL_AVAILABLE) {
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'local', { path: '/' });
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-region', 'local', { path: '/' });
                expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
            }
        });

        it('should set cookies for AWS region', async () => {
            const targetRegion = AVAILABLE_REGIONS.find(r => r !== 'local') || 'us-east-1';
            await switchRegion(targetRegion);

            expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'aws', { path: '/' });
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-region', targetRegion, { path: '/' });
            expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
        });
    });

    describe('switchEnvMode', () => {
        it('should switch to local mode', async () => {
            await switchEnvMode('local');
            if (IS_LOCAL_AVAILABLE) {
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'local', { path: '/' });
            }
        });

        it('should switch to aws mode', async () => {
            const awsRegion = AVAILABLE_REGIONS.find(r => r !== 'local');
            if (awsRegion) {
                await switchEnvMode('aws');
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'aws', { path: '/' });
            }
        });
    });

    describe('switchProfile', () => {
        it('should set profile and switch to aws mode', async () => {
            await switchProfile('prod');
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'aws', { path: '/' });
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-profile', 'prod', { path: '/' });
            expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
        });

        it('should reset region if currently local', async () => {
            mockCookieStore.get.mockImplementation((key) => {
                if (key === 'db-region') return { value: 'local' };
                return undefined;
            });

            const awsRegion = AVAILABLE_REGIONS.find(r => r !== 'local') || DEFAULT_REGION;

            await switchProfile('prod');
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-region', awsRegion, { path: '/' });
        });
    });

    describe('switchLanguage', () => {
        it('should set language cookie', async () => {
            await switchLanguage('ja');
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-language', 'ja', { path: '/' });
            expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
        });
    });

    describe('getSettings', () => {
        it('should return default settings when no cookies', async () => {
            mockCookieStore.get.mockReturnValue(undefined);
            (fs.readFile as jest.Mock).mockResolvedValue('');

            const settings = await getSettings();

            expect(settings.language).toBe('en');
            expect(AVAILABLE_REGIONS).toContain(settings.region);
            expect(settings.availableProfiles).toEqual([]);
        });

        it('should return settings from cookies including profile', async () => {
            mockCookieStore.get.mockImplementation((name: string) => {
                if (name === 'db-mode') return { value: 'aws' };
                if (name === 'db-region') return { value: 'us-west-2' };
                if (name === 'db-language') return { value: 'ja' };
                if (name === 'db-profile') return { value: 'prod' };
                return undefined;
            });

            const settings = await getSettings();
            expect(settings.mode).toBe('aws');
            expect(settings.region).toBe('us-west-2');
            expect(settings.language).toBe('ja');
            expect(settings.currentProfile).toBe('prod');
        });
    });

    describe('getSystemStatus', () => {
        it('should return system configurations', async () => {
            const status = await getSystemStatus();
            expect(status).toHaveProperty('isLocalAvailable');
            expect(status).toHaveProperty('availableRegions');
        });
    });
});
