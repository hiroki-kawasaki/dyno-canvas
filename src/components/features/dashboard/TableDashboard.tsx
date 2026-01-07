'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { searchItems, getAccessPatterns, deleteItem, batchDeleteItems, exportAllItems, getSearchCount, getTableDetails } from '@/actions/dynamo';
import { SearchMode, DynamoItem, AccessPatternConfig, SearchParams } from '@/types';
import { parsePlaceholders, toSnakeCase } from '@/lib/utils';
import TableSettings from './TableSettings';
import ImportModal from '@/components/shared/ImportModal';
import { useUI } from '@/contexts/UIContext';
import { marshall } from "@aws-sdk/util-dynamodb";
import { GlobalSecondaryIndexDescription } from '@aws-sdk/client-dynamodb';

interface TableDashboardProps {
    tableName: string;
    mode: 'free' | 'pattern';
    patternId?: string;
    adminTableExists?: boolean;
}

export default function TableDashboard({ tableName, mode, patternId, adminTableExists = true }: TableDashboardProps) {
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

    const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 100);
    const [page, setPage] = useState(0);
    const [pageKeys, setPageKeys] = useState<(Record<string, unknown> | undefined)[]>([undefined]);
    const [nextKey, setNextKey] = useState<Record<string, unknown> | undefined>(undefined);

    const [tableExists, setTableExists] = useState(true);

    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
                        setTableExists(true);
                        if (tableData.table?.GlobalSecondaryIndexes) {
                            setGsis(tableData.table.GlobalSecondaryIndexes);
                        }
                    } else {
                        setTableExists(false);
                    }
                }
            } catch {
                if (active) setTableExists(false);
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
            setTableExists(true);
        } else {
            setError(res.error || 'Unknown error occurred');
            if (res.error?.includes('ResourceNotFoundException')) {
                setTableExists(false);
            }
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

    const handleDeleteItem = async (pk: string, sk: string) => {
        confirm(t.common.delete, t.dashboard.deleteItemConfirm, async () => {
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

    const handleExport = async () => {
        const searchMode: SearchMode = mode === 'free' ? 'DIRECT' : 'PATTERN';
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
            () => executeExport(params)
        );
    };

    const executeExport = async (params: SearchParams) => {
        setIsExporting(true);
        const res = await exportAllItems(params);
        setIsExporting(false);

        if (res.success && res.data) {
            const blob = new Blob([res.data], { type: 'application/x-jsonlines' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const fff = String(now.getMilliseconds()).padStart(3, '0');
            const timestamp = `${yyyy}${mm}${dd}${hh}${mi}${ss}${fff}`;

            const prefix = mode === 'pattern' && currentPattern ? currentPattern.id : 'free-search';
            a.download = `${prefix}_${timestamp}.jsonl`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(t.dashboard.exportSuccess, 'success');
        } else {
            showToast(`${t.dashboard.exportError}: ${res.error}`, 'error');
        }
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

    if (!tableExists) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900">
                <h2 className="text-xl font-bold text-red-600 mb-2">{t.dashboard.tableNotFound}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t.dashboard.tableNotFoundDesc.replace('{tableName}', tableName)}
                </p>
                <Link href="/" className="text-blue-600 hover:underline">{t.common.goBack}</Link>
            </div>
        );
    }

    const showSearchControls = mode === 'free' || (mode === 'pattern' && !!currentPattern);

    return (
        <div className="flex flex-col gap-6 h-full relative">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <div className="flex gap-4">
                        <Link
                            href={`/tables/${tableName}/search/free`}
                            className={`pb-1 text-sm font-medium transition-colors ${mode === 'free' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {t.dashboard.freeSearch}
                        </Link>
                        {adminTableExists && (
                            <Link
                                href={`/tables/${tableName}/search/access-pattern`}
                                className={`pb-1 text-sm font-medium transition-colors ${mode === 'pattern' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t.dashboard.accessPatternSearch}
                            </Link>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                        {allowDelete && selectedKeys.size > 0 && (
                            <button
                                onClick={() => setIsBulkDeleteModalOpen(true)}
                                className="text-sm bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded font-bold transition-colors animate-fade-in flex items-center gap-1"
                            >
                                {t.dashboard.bulkDelete.replace('{count}', selectedKeys.size.toString())}
                            </button>
                        )}
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="text-sm bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded font-bold transition-colors flex items-center gap-1"
                        >
                            {t.common.import}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || (mode === 'pattern' && !currentPattern) || (mode === 'free' && !pkInput)}
                            className="text-sm bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded font-bold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t.common.export}
                        </button>
                        <Link
                            href={`/tables/${tableName}/item`}
                            className="text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded font-bold flex items-center gap-1 transition-colors"
                        >
                            {t.dashboard.newItem}
                        </Link>
                        {adminTableExists && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded border border-gray-200 dark:border-gray-600 transition-colors flex items-center gap-1"
                            >
                                {t.dashboard.settings}
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
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 mb-1">{t.dashboard.limit}</label>
                                    <select
                                        className="border p-2 rounded w-24 dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        value={limit}
                                        onChange={(e) => setLimit(Number(e.target.value))}
                                    >
                                        <option value="100">100</option>
                                        <option value="250">250</option>
                                        <option value="500">500</option>
                                        <option value="1000">1000</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || (mode === 'pattern' && !currentPattern)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                >
                                    {loading ? t.dashboard.searching : t.dashboard.search}
                                </button>
                            </>
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

            <div className="flex-grow overflow-auto border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-800 flex flex-col shadow-sm">
                <div className="flex-grow overflow-auto">
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
                                        <td className="p-3 font-mono text-xs">{item.PK}</td>
                                        <td className="p-3 font-mono text-xs">{item.SK}</td>
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
                                            {t.dashboard.noItems}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {results.length > 0 && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                            {t.dashboard.page} {page + 1} ({results.length} items)
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
                )}
            </div>

            {
                isSettingsOpen && (
                    <TableSettings
                        tableName={tableName}
                        patterns={patterns}
                        onClose={() => setIsSettingsOpen(false)}
                        onUpdate={handlePatternUpdate}
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