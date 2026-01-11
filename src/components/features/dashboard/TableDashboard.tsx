'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    useRouter,
    useSearchParams,
    usePathname
} from 'next/navigation';
import {
    searchItems,
    getAccessPatterns,
    deleteItem,
    batchDeleteItems,
    exportAllItems,
    getSearchCount,
    getTableDetails
} from '@actions/dynamodb';
import {
    SearchMode,
    DynamoItem,
    AccessPatternConfig,
    SearchParams
} from '@/types';
import { parsePlaceholders, toSnakeCase } from '@lib/utils';
import TableSettings from './TableSettings';
import ImportModal from '@components/shared/ImportModal';
import { useUI } from '@/contexts/UIContext';
import { marshall } from "@aws-sdk/util-dynamodb";
import { GlobalSecondaryIndexDescription } from '@aws-sdk/client-dynamodb';
import { setSearchLimit } from '@actions/settings';

interface TableDashboardProps {
    tableName: string;
    mode: 'free' | 'pattern';
    patternId?: string;
    adminTableExists?: boolean;
    initialLimit?: number;
}

const ACTION_DROPDOWN_ID = 'actions-dropdown';

export default function TableDashboard({
    tableName,
    mode,
    patternId,
    adminTableExists = true,
    initialLimit
}: TableDashboardProps) {
    const { t, showToast, confirm, allowDelete } = useUI();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [results, setResults] = useState<DynamoItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [patterns, setPatterns] = useState<AccessPatternConfig[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [patternsLoading, setPatternsLoading] = useState(true);

    const [pkInput, setPkInput] = useState(searchParams.get('pk') || '');
    const [skInput, setSkInput] = useState(searchParams.get('sk') || '');
    const [indexInput, setIndexInput] = useState(searchParams.get('index') || '');
    const [patternParams, setPatternParams] = useState<Record<string, string>>({});

    const [gsis, setGsis] = useState<GlobalSecondaryIndexDescription[]>([]);

    const [limit, setLimitState] = useState(initialLimit || 100);
    const [hasSearched, setHasSearched] = useState(false);
    const [isActionsOpen, setIsActionsOpen] = useState(false);

    const setLimit = (val: number) => {
        setLimitState(val);
        setSearchLimit(val);
    };
    const [page, setPage] = useState(0);
    const [pageKeys, setPageKeys] = useState<(Record<string, unknown> | undefined)[]>([undefined]);
    const [nextKey, setNextKey] = useState<Record<string, unknown> | undefined>(undefined);

    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const updatePatternsState = useCallback((data: AccessPatternConfig[]) => {
        setPatterns(data);
        setPatternsLoading(false);
    }, []);

    useEffect(() => {
        let active = true;
        const loadData = async () => {
            setPatternsLoading(true);
            try {
                const [patternsData, tableData] = await Promise.all([
                    getAccessPatterns(tableName),
                    getTableDetails(tableName)
                ]);

                if (active) {
                    updatePatternsState(patternsData);
                    if (tableData.success) {
                        if (tableData.table?.GlobalSecondaryIndexes) {
                            setGsis(tableData.table.GlobalSecondaryIndexes);
                        }
                    }
                }
            } catch {
                if (active) { }
            } finally {
                if (active) setPatternsLoading(false);
            }
        };
        loadData();
        return () => { active = false; };
    }, [tableName, updatePatternsState]);

    const currentPattern = useMemo(() => patterns.find(p => p.id === patternId), [patterns, patternId]);

    useEffect(() => {
        if (mode === 'pattern' && currentPattern) {
            const pkPlaceholders = parsePlaceholders(currentPattern.pkFormat);
            const skPlaceholders = parsePlaceholders(currentPattern.skFormat);
            const allPlaceholders = [...pkPlaceholders, ...skPlaceholders];

            const initialParams: Record<string, string> = {};
            allPlaceholders.forEach(ph => {
                const snakeKey = toSnakeCase(ph);
                const val = searchParams.get(snakeKey);
                if (val) initialParams[ph] = val;
            });
            setPatternParams(initialParams);
        }
    }, [mode, currentPattern, searchParams]);

    const dynamicFormFields = useMemo(() => {
        if (!currentPattern) return [];
        const pkParams = parsePlaceholders(currentPattern.pkFormat);
        const skParams = parsePlaceholders(currentPattern.skFormat);
        const allParamNames = Array.from(new Set([...pkParams, ...skParams]));

        return allParamNames.map(name => ({
            name,
            required: pkParams.includes(name)
        }));
    }, [currentPattern]);

    const executeSearch = useCallback(async (startKey?: Record<string, unknown>) => {
        const searchMode: SearchMode = mode === 'free' ? 'DIRECT' : 'PATTERN';

        setLoading(true);
        setError('');
        setResults([]);
        setSelectedKeys(new Set());

        const currentGsi = mode === 'free' ? gsis.find(g => g.IndexName === indexInput) : undefined;
        let pkName = 'PK';
        let skName = 'SK';

        if (mode === 'free' && currentGsi) {
            pkName = currentGsi.KeySchema?.find(k => k.KeyType === 'HASH')?.AttributeName || 'PK';
            skName = currentGsi.KeySchema?.find(k => k.KeyType === 'RANGE')?.AttributeName || 'SK';
        }

        const res = await searchItems({
            tableName,
            mode: searchMode,
            pkInput: mode === 'free' ? pkInput : undefined,
            skInput: mode === 'free' ? skInput : undefined,
            indexName: mode === 'free' ? (indexInput || undefined) : undefined,
            pkName,
            skName,
            patternConfig: currentPattern,
            patternParams: mode === 'pattern' ? patternParams : undefined,
            limit,
            startKey,
        });

        if (res.success && res.data) {
            setResults(res.data);
            setNextKey(res.lastEvaluatedKey);
            setHasSearched(true);
        } else {
            setError(res.error || 'Unknown error occurred');
            if (res.error?.includes('ResourceNotFoundException')) { }
        }
        setLoading(false);
    }, [tableName, mode, pkInput, skInput, currentPattern, patternParams, limit, gsis, indexInput]);

    useEffect(() => {
        const hasParams = mode === 'free' ? (!!pkInput) : (Object.keys(patternParams).length > 0);
        if (hasParams && !loading && results.length === 0) {
            executeSearch(undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const handleSearchClick = (e: React.FormEvent) => {
        e.preventDefault();

        const params = new URLSearchParams();
        params.set('limit', limit.toString());

        if (mode === 'free') {
            if (pkInput) params.set('pk', pkInput);
            if (skInput) params.set('sk', skInput);
            if (indexInput) params.set('index', indexInput);
            router.push(`/tables/${tableName}/search/free?${params.toString()}`);
        } else if (mode === 'pattern' && currentPattern) {
            Object.entries(patternParams).forEach(([key, val]) => {
                if (val) params.set(toSnakeCase(key), val);
            });
            router.push(`/tables/${tableName}/search/access-pattern/${currentPattern.id}?${params.toString()}`);
        }

        setPage(0);
        setPageKeys([undefined]);
        setNextKey(undefined);
        executeSearch(undefined);
    };

    const handlePatternChange = (newPatternId: string) => {
        router.push(`/tables/${tableName}/search/access-pattern/${newPatternId}`);
    };

    const handleNextPage = () => {
        if (!nextKey) return;
        const newPage = page + 1;
        const newPageKeys = [...pageKeys];
        newPageKeys[newPage] = nextKey;

        setPageKeys(newPageKeys);
        setPage(newPage);
        executeSearch(nextKey);
    };

    const handlePrevPage = () => {
        if (page === 0) return;
        const newPage = page - 1;
        setPage(newPage);
        executeSearch(pageKeys[newPage]);
    };


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isActionsOpen && !target.closest(`#${ACTION_DROPDOWN_ID}`)) {
                setIsActionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isActionsOpen]);

    const handleDeleteItem = async (pk: string, sk: string) => {
        const message = (
            <div>
                <p className="mb-2">{t.dashboard.deleteItemConfirm}</p>
                <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 border-b dark:border-gray-600 font-mono">PK</th>
                                <th className="p-2 border-b dark:border-gray-600 font-mono">SK</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border-r dark:border-gray-600 font-mono text-center">{pk}</td>
                                <td className="p-2 font-mono text-center">{sk}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );

        confirm(t.common.delete, message, async () => {
            const res = await deleteItem(tableName, pk, sk);
            if (res.success) {
                showToast(t.dashboard.itemDeleted, 'success');
                executeSearch(pageKeys[page]);
            } else {
                showToast(`${t.common.error}: ${res.error}`, 'error');
            }
        });
    };

    const handlePatternUpdate = async () => {
        setPatternsLoading(true);
        const data = await getAccessPatterns(tableName);
        updatePatternsState(data);
    };

    const getKeyString = (item: DynamoItem) => JSON.stringify({ PK: item.PK, SK: item.SK });

    const toggleSelect = (item: DynamoItem) => {
        const key = getKeyString(item);
        const newSet = new Set(selectedKeys);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setSelectedKeys(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedKeys.size === results.length && results.length > 0) {
            setSelectedKeys(new Set());
        } else {
            const newSet = new Set<string>();
            results.forEach(item => newSet.add(getKeyString(item)));
            setSelectedKeys(newSet);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedKeys.size === 0) return;
        setIsDeleting(true);
        const keysToDelete = Array.from(selectedKeys).map(k => JSON.parse(k) as { PK: string, SK: string });

        const res = await batchDeleteItems(tableName, keysToDelete);
        setIsDeleting(false);
        setIsBulkDeleteModalOpen(false);

        if (res.success) {
            showToast(t.dashboard.bulkDeleteSuccess.replace('{count}', keysToDelete.length.toString()), 'success');
            setSelectedKeys(new Set());
            executeSearch(pageKeys[page]);
        } else {
            showToast(`${t.dashboard.bulkDeleteError}: ${res.error}`, 'error');
        }
    };



    const handleDownload = async (target: 'selected' | 'results', format: 'jsonl' | 'csv') => {
        setIsActionsOpen(false);
        const searchMode: SearchMode = mode === 'free' ? 'DIRECT' : 'PATTERN';

        if (target === 'selected') {
            const keysToCheck = new Set(selectedKeys);
            const selectedItems = results.filter(item => keysToCheck.has(getKeyString(item)));

            if (selectedItems.length === 0) return;

            let content = '';
            if (format === 'csv') {
                const allKeys = new Set<string>();
                selectedItems.forEach(item => {
                    Object.keys(item).forEach(k => allKeys.add(k));
                });

                const sortedKeys = Array.from(allKeys).sort((a, b) => {
                    if (a === 'PK') return -1; if (b === 'PK') return 1;
                    if (a === 'SK') return -1; if (b === 'SK') return 1;
                    return a.localeCompare(b);
                });

                const header = sortedKeys.join(',');
                const rows = selectedItems.map(item => {
                    return sortedKeys.map(key => {
                        const val = item[key];
                        if (val === undefined || val === null) return '';
                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    }).join(',');
                });
                content = [header, ...rows].join('\n');
            } else {
                content = selectedItems.map(item => {
                    const marshalled = marshall(item, { removeUndefinedValues: true, convertClassInstanceToMap: false });
                    return JSON.stringify({ Item: marshalled });
                }).join('\n');
            }

            downloadFile(content, format, `selected`);
            return;
        }

        if (searchMode === 'DIRECT' && !pkInput) return;
        if (searchMode === 'PATTERN' && !currentPattern) return;

        const params: SearchParams = {
            tableName,
            mode: searchMode,
            pkInput: mode === 'free' ? pkInput : undefined,
            skInput: mode === 'free' ? skInput : undefined,
            indexName: mode === 'free' ? (indexInput || undefined) : undefined,
            patternConfig: currentPattern,
            patternParams: mode === 'pattern' ? patternParams : undefined,
        };

        const countRes = await getSearchCount(params);
        if (!countRes.success) {
            showToast(`${t.dashboard.exportError}: ${countRes.error}`, 'error');
            return;
        }

        confirm(
            t.dashboard.exportConfirmTitle,
            t.dashboard.exportConfirmMessage.replace('{count}', (countRes.count || 0).toString()),
            () => executeExportDownload(params, format)
        );
    };

    const executeExportDownload = async (params: SearchParams, format: 'jsonl' | 'csv') => {
        const res = await exportAllItems(params, format);

        if (res.success && res.data) {
            downloadFile(res.data, format, mode === 'pattern' && currentPattern ? currentPattern.id : 'free-search');
            showToast(t.dashboard.exportSuccess, 'success');
        } else {
            showToast(`${t.dashboard.exportError}: ${res.error}`, 'error');
        }
    };

    const downloadFile = (content: string, format: 'jsonl' | 'csv', prefix: string) => {
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/x-jsonlines' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
        a.download = `${prefix}_${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportSuccess = () => {
        setIsImportModalOpen(false);
        executeSearch(pageKeys[page]);
    };

    const selectedList = Array.from(selectedKeys).map(k => JSON.parse(k) as { PK: string, SK: string });

    const getDisplayAttributes = (item: DynamoItem) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { PK, SK, ...rest } = item;
        const marshalled = marshall(rest, { removeUndefinedValues: true, convertClassInstanceToMap: false });
        return JSON.stringify(marshalled);
    };

    const showSearchControls = mode === 'free' || (mode === 'pattern' && !!currentPattern);

    return (
        <div className="flex flex-col gap-6 h-full relative">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-3xl">table_chart</span>
                    {tableName}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="text-sm bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded font-bold transition-colors flex items-center gap-1 shadow-sm"
                    >
                        {t.common.import}
                    </button>
                    <Link
                        href={`/tables/${tableName}/item`}
                        className="text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        {t.dashboard.newItem}
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm relative z-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <div className="flex gap-4">
                        <Link
                            href={`/tables/${tableName}/search/free?limit=${limit}`}
                            className={`pb-1 text-sm font-medium transition-colors ${mode === 'free' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {t.dashboard.freeSearch}
                        </Link>
                        {adminTableExists && (
                            <Link
                                href={`/tables/${tableName}/search/access-pattern?limit=${limit}`}
                                className={`pb-1 text-sm font-medium transition-colors ${mode === 'pattern' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t.dashboard.accessPatternSearch}
                            </Link>
                        )}
                    </div>

                    <div className="flex gap-2 relative">
                        <div className="relative" id={ACTION_DROPDOWN_ID}>
                            <button
                                onClick={() => setIsActionsOpen(!isActionsOpen)}
                                className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 px-3 py-2 rounded font-medium flex items-center gap-1 transition-colors shadow-sm"
                            >
                                {t.tables.actions}
                                <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
                            </button>

                            {isActionsOpen && (
                                <div className="absolute right-0 mt-1 w-70 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 text-sm py-1 animate-fade-in-up">
                                    <button
                                        onClick={() => setIsBulkDeleteModalOpen(true)}
                                        disabled={selectedKeys.size === 0}
                                        className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t.dashboard.bulkDelete.replace('{count}', selectedKeys.size.toString())}
                                    </button>
                                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                    <button
                                        onClick={() => handleDownload('selected', 'jsonl')}
                                        disabled={selectedKeys.size === 0}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t.dashboard.downloadSelectedJsonl}
                                    </button>
                                    <button
                                        onClick={() => handleDownload('selected', 'csv')}
                                        disabled={selectedKeys.size === 0}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t.dashboard.downloadSelectedCsv}
                                    </button>
                                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                    <button
                                        onClick={() => handleDownload('results', 'jsonl')}
                                        disabled={results.length === 0}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t.dashboard.downloadResultsJsonl}
                                    </button>
                                    <button
                                        onClick={() => handleDownload('results', 'csv')}
                                        disabled={results.length === 0}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t.dashboard.downloadResultsCsv}
                                    </button>
                                </div>
                            )}
                        </div>

                        {adminTableExists && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {mode === 'pattern' && patterns.length === 0 && !patternsLoading ? (
                    <div className="flex-1 p-3 text-sm text-red-600 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400 rounded flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                        {t.dashboard.noPatterns}
                    </div>
                ) : (
                    <form onSubmit={handleSearchClick} className="flex gap-4 items-end flex-wrap">
                        {mode === 'free' ? (
                            <>
                                <div className="flex flex-col flex-1 min-w-[120px] max-w-[150px]">
                                    <label className="text-xs text-gray-500 mb-1">{t.dashboard.index}</label>
                                    <select
                                        className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        value={indexInput}
                                        onChange={(e) => setIndexInput(e.target.value)}
                                    >
                                        <option value="">{t.dashboard.tableBase}</option>
                                        {gsis.map(g => (
                                            <option key={g.IndexName} value={g.IndexName}>{g.IndexName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col flex-1 min-w-[200px]">
                                    <label className="text-xs text-gray-500 mb-1">
                                        {t.dashboard.pk}
                                        <span className="ml-1 font-mono text-gray-400">
                                            ({mode === 'free' && indexInput && gsis.find(g => g.IndexName === indexInput)?.KeySchema?.find(k => k.KeyType === 'HASH')?.AttributeName || 'PK'})
                                        </span>
                                    </label>
                                    <input
                                        className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        placeholder="e.g. USER#123"
                                        value={pkInput}
                                        onChange={(e) => setPkInput(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col flex-1 min-w-[200px]">
                                    <label className="text-xs text-gray-500 mb-1">
                                        {t.dashboard.sk}
                                        <span className="ml-1 font-mono text-gray-400">
                                            ({mode === 'free' && indexInput && gsis.find(g => g.IndexName === indexInput)?.KeySchema?.find(k => k.KeyType === 'RANGE')?.AttributeName || 'SK'})
                                        </span>
                                    </label>
                                    <input
                                        className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        placeholder="e.g. ORDER#"
                                        value={skInput}
                                        onChange={(e) => setSkInput(e.target.value)}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col w-80">
                                    <label className="text-xs text-gray-500 mb-1">{t.dashboard.selectPattern}</label>
                                    {patternsLoading ? (
                                        <div className="p-2 text-sm text-gray-500">{t.dashboard.patternLoading}</div>
                                    ) : (
                                        <select
                                            className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                            value={patternId || ''}
                                            onChange={(e) => handlePatternChange(e.target.value)}
                                        >
                                            <option value="" disabled>{t.dashboard.selectPattern}</option>
                                            {patterns.map(p => (
                                                <option key={p.id} value={p.id}>{p.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {dynamicFormFields.map(field => (
                                    <div key={field.name} className="flex flex-col flex-1 min-w-[150px]">
                                        <label className="text-xs text-gray-500 flex gap-1 mb-1">
                                            {field.name}
                                            {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                            placeholder={`Value`}
                                            value={patternParams[field.name] || ''}
                                            onChange={(e) => setPatternParams(prev => ({
                                                ...prev,
                                                [field.name]: e.target.value
                                            }))}
                                            required={field.required}
                                        />
                                    </div>
                                ))}
                            </>
                        )}

                        {showSearchControls && (
                            <button
                                type="submit"
                                disabled={loading || (mode === 'pattern' && !currentPattern)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors h-[38px]"
                            >
                                {loading ? t.dashboard.searching : t.dashboard.search}
                            </button>
                        )}
                    </form>
                )}
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
                {currentPattern && mode === 'pattern' && (
                    <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                        <span className="font-bold">PK:</span> {currentPattern.pkFormat} <span className="mx-2">|</span> <span className="font-bold">SK:</span> {currentPattern.skFormat || '(none)'}
                        {currentPattern.indexName && <span className="ml-2 font-mono text-blue-600 dark:text-blue-400">[Index: {currentPattern.indexName}]</span>}
                        {currentPattern.description && <span className="ml-2 text-gray-500">- {currentPattern.description}</span>}
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-hidden border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-800 flex flex-col shadow-sm">

                <div className="p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                        {results.length > 0 && `${t.dashboard.page} ${page + 1} (${results.length} items)`}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={page === 0 || loading}
                            className="px-3 py-1 text-xs border rounded bg-white dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t.dashboard.prev}
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={!nextKey || loading}
                            className="px-3 py-1 text-xs border rounded bg-white dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t.dashboard.next}
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-auto relative">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                        checked={results.length > 0 && selectedKeys.size === results.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-3 text-gray-600 dark:text-gray-300 font-medium">PK</th>
                                <th className="p-3 text-gray-600 dark:text-gray-300 font-medium">SK</th>
                                <th className="p-3 text-gray-600 dark:text-gray-300 font-medium">{t.dashboard.attributes}</th>
                                <th className="p-3 w-32 text-gray-600 dark:text-gray-300 font-medium text-right">{t.dashboard.action}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {results.length > 0 ? (
                                results.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="p-3 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                                checked={selectedKeys.has(getKeyString(item))}
                                                onChange={() => toggleSelect(item)}
                                            />
                                        </td>
                                        <td className="p-3 font-mono text-xs max-w-[150px] truncate" title={item.PK}>{item.PK}</td>
                                        <td className="p-3 font-mono text-xs max-w-[150px] truncate" title={item.SK}>{item.SK}</td>
                                        <td className="p-3 text-gray-500 truncate max-w-xs text-xs font-mono">
                                            {getDisplayAttributes(item)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/tables/${tableName}/item?pk=${encodeURIComponent(item.PK)}&sk=${encodeURIComponent(item.SK)}&backUrl=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`}
                                                    className="text-blue-600 hover:underline text-xs"
                                                >
                                                    {t.common.detail}
                                                </Link>
                                                {allowDelete && (
                                                    <button
                                                        onClick={() => handleDeleteItem(item.PK, item.SK)}
                                                        className="text-red-500 hover:text-red-700 text-xs hover:bg-red-50 dark:hover:bg-red-900/30 px-1 rounded flex items-center"
                                                        title={t.common.delete}
                                                    >
                                                        {t.common.delete}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                !loading && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-500">
                                            {hasSearched ? t.dashboard.noItems : t.dashboard.beforeSearch}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                isSettingsOpen && (
                    <TableSettings
                        tableName={tableName}
                        patterns={patterns}
                        onClose={() => setIsSettingsOpen(false)}
                        onUpdate={handlePatternUpdate}
                        limit={limit}
                        setLimit={setLimit}
                    />
                )
            }

            {
                isImportModalOpen && (
                    <ImportModal
                        tableName={tableName}
                        onClose={() => setIsImportModalOpen(false)}
                        onSuccess={handleImportSuccess}
                        target="items"
                    />
                )
            }

            {
                isBulkDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {t.dashboard.bulkDeleteConfirmTitle}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                                    {t.dashboard.bulkDeleteConfirmMessage.replace('{count}', selectedKeys.size.toString())}
                                </p>
                            </div>
                            <div className="flex-grow overflow-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                                <div className="space-y-2">
                                    {selectedList.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 text-xs font-mono border-b border-gray-200 dark:border-gray-700 pb-1 last:border-0">
                                            <span className="text-gray-500 font-bold">PK:</span>
                                            <span className="text-gray-800 dark:text-gray-200">{item.PK}</span>
                                            <span className="text-gray-300 mx-2">|</span>
                                            <span className="text-gray-500 font-bold">SK:</span>
                                            <span className="text-gray-800 dark:text-gray-200">{item.SK}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                <button
                                    onClick={() => setIsBulkDeleteModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    disabled={isDeleting}
                                >
                                    {t.common.cancel}
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded disabled:opacity-50 flex items-center gap-2"
                                    disabled={isDeleting}
                                >
                                    {isDeleting && (
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {t.common.delete}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}