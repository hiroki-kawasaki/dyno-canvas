'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { switchEnvMode, switchRegion, EnvMode } from '@/actions/settings';
import { useUI } from '@/contexts/UIContext';

interface HeaderProps {
    currentMode: EnvMode;
    currentRegion: string;
    systemStatus: {
        isLocalAvailable: boolean;
        availableRegions: string[];
    };
}

export default function Header({ currentMode, currentRegion, systemStatus }: HeaderProps) {
    const { language, setLanguage, t, toggleSidebar, accountId, theme, setTheme } = useUI();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();

    const isItemDetailPage = pathname.includes('/item');

    const handleEnvChange = (value: string) => {
        startTransition(async () => {
            if (value === 'local') {
                if (systemStatus.isLocalAvailable) {
                    await switchEnvMode('local');
                }
            } else {
                await switchRegion(value);
                await switchEnvMode('aws');
            }
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
                    {accountId && accountId !== 'Unknown' && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700">
                            <span className="font-mono">{accountId}</span>
                        </div>
                    )}

                    <div className="relative">
                        <select
                            value={currentMode === 'local' ? 'local' : currentRegion}
                            onChange={(e) => handleEnvChange(e.target.value)}
                            disabled={isPending || isItemDetailPage}
                            className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {systemStatus.isLocalAvailable && (
                                <option value="local">{t.header.local}</option>
                            )}
                            {awsRegions.length > 0 && (
                                <optgroup label={t.header.awsRegions}>
                                    {awsRegions.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </optgroup>
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
                            className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
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
                            className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
