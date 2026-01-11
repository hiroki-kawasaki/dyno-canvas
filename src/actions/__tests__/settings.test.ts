import { switchEnvMode, switchRegion, switchLanguage, getSettings, getSystemStatus } from '../settings';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AVAILABLE_REGIONS, IS_LOCAL_AVAILABLE } from '@lib/config';

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
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

    describe('switchRegion', () => {
        it('should set cookies for local mode', async () => {
            await switchRegion('local');

            if (IS_LOCAL_AVAILABLE) {
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'local', { path: '/' });
                expect(mockCookieStore.set).toHaveBeenCalledWith('db-region', 'local', { path: '/' });
                expect(revalidatePath).toHaveBeenCalledWith('/');
            }
        });

        it('should set cookies for AWS region', async () => {
            const targetRegion = AVAILABLE_REGIONS.find(r => r !== 'local') || 'us-east-1';
            await switchRegion(targetRegion);

            expect(mockCookieStore.set).toHaveBeenCalledWith('db-mode', 'aws', { path: '/' });
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-region', targetRegion, { path: '/' });
            expect(revalidatePath).toHaveBeenCalledWith('/');
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

    describe('switchLanguage', () => {
        it('should set language cookie', async () => {
            await switchLanguage('ja');
            expect(mockCookieStore.set).toHaveBeenCalledWith('db-language', 'ja', { path: '/' });
            expect(revalidatePath).toHaveBeenCalledWith('/');
        });
    });

    describe('getSettings', () => {
        it('should return default settings when no cookies', async () => {
            mockCookieStore.get.mockReturnValue(undefined);
            const settings = await getSettings();

            expect(settings.language).toBe('en');
            expect(AVAILABLE_REGIONS).toContain(settings.region);
        });

        it('should return settings from cookies', async () => {
            mockCookieStore.get.mockImplementation((name: string) => {
                if (name === 'db-mode') return { value: 'aws' };
                if (name === 'db-region') return { value: 'us-west-2' };
                if (name === 'db-language') return { value: 'ja' };
                return undefined;
            });

            const settings = await getSettings();
            expect(settings.mode).toBe('aws');
            expect(settings.region).toBe('us-west-2');
            expect(settings.language).toBe('ja');
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
