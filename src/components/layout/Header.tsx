'use client'

import { useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    switchEnvMode,
    switchRegion,
    switchProfile,
    EnvMode
} from '@actions/settings';
import { useUI } from '@/contexts/UIContext';

interface HeaderProps {
    currentMode: EnvMode;
    currentRegion: string;
    currentProfile: string;
    availableProfiles: string[];
    systemStatus: {
        isLocalAvailable: boolean;
        availableRegions: string[];
    };
}

export default function Header({
    currentMode,
    currentRegion,
    currentProfile,
    availableProfiles,
    systemStatus
}: HeaderProps) {
    const { language, setLanguage, t, toggleSidebar, accountId, theme, setTheme } = useUI();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();

    const isItemDetailPage = pathname.includes('/item');

    const handleProfileChange = (value: string) => {
        startTransition(async () => {
            if (value === 'Local') {
                if (systemStatus.isLocalAvailable) {
                    await switchEnvMode('local');
                }
            } else {
                await switchProfile(value);
            }
        });
    };

    const handleRegionChange = (value: string) => {
        startTransition(async () => {
            await switchRegion(value);
        });
    };

    const handleLanguageChange = (value: string) => {
        startTransition(async () => {
            setLanguage(value as 'en' | 'ja');
        });
    };

    const awsRegions = systemStatus.availableRegions.filter(r => r !== 'local');

    return (
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleSidebar}
                        className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <Link href="/" className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        DynoCanvas
                    </Link>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative">
                        <select
                            value={currentMode === 'local' ? 'Local' : currentProfile}
                            onChange={(e) => handleProfileChange(e.target.value)}
                            disabled={isPending || isItemDetailPage}
                            className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                        >
                            {systemStatus.isLocalAvailable && (
                                <option value="Local">{t.header.local}</option>
                            )}
                            {availableProfiles.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </div>
                    </div>

                    <div className="flex items-center w-28 gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700">
                        <span className="font-mono">{accountId}</span>
                    </div>

                    <div className="relative">
                        <select
                            value={currentMode === 'local' ? 'local' : currentRegion}
                            onChange={(e) => handleRegionChange(e.target.value)}
                            disabled={isPending || isItemDetailPage || currentMode === 'local'}
                            className="appearance-none w-32 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {currentMode === 'local' ? (
                                <option value="local">local</option>
                            ) : (
                                <>
                                    {awsRegions.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </>
                            )}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                            className="appearance-none w-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="system">{t.theme.system}</option>
                            <option value="light">{t.theme.light}</option>
                            <option value="dark">{t.theme.dark}</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            value={language}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            disabled={isPending}
                            className="appearance-none w-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
