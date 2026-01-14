'use client'

import React, {
    useState,
    useMemo,
    useEffect,
    useCallback
} from 'react';
import Link from 'next/link';
import {
    useRouter,
    useSearchParams,
    usePathname
} from 'next/navigation';
import { GlobalSecondaryIndexDescription } from '@aws-sdk/client-dynamodb';
import { marshall } from "@aws-sdk/util-dynamodb";
import {
    searchItems,
    getAccessPatterns,
    deleteItem,
    batchDeleteItems,
    exportAllItems,
    getSearchCount,
    getTableDetails
} from '@actions/dynamodb';
import { setSearchLimit } from '@actions/settings';
import ImportModal from '@components/shared/ImportModal';
import { parsePlaceholders, toSnakeCase } from '@lib/utils';
import { useUI } from '@/contexts/UIContext';
import {
    SearchMode,
    DynamoItem,
    AccessPatternConfig,
    SearchParams
} from '@/types';
import TableSettings from './TableSettings';
import SearchForm from './SearchForm';
import ActionMenu from './ActionMenu';
import ResultsTable from './ResultsTable';

interface TableDashboardProps {
    tableName: string;
    mode: 'free' | 'pattern';
    patternId?: string;
    adminTableExists?: boolean;
    initialLimit?: number;
    readOnly?: boolean;
}

const ACTION_DROPDOWN_ID = 'actions-dropdown';

export default function TableDashboard({
    tableName,
    mode,
    patternId,
    adminTableExists = true,
    initialLimit,
    readOnly = false
}: TableDashboardProps) {
    const { t, showToast, confirm } = useUI();
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

    const handleDeleteItem = async (pk: string, sk: string) => {
        const message = (
            <div>
                <p className="mb-2">{t.dashboard.deleteItemConfirm}</p>
                <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className="border-b dark:border-gray-600">
                                <th className="p-2 bg-gray-50 dark:bg-gray-700 font-mono w-16 text-left border-r dark:border-gray-600">PK</th>
                                <td className="p-2 font-mono">{pk}</td>
                            </tr>
                            <tr>
                                <th className="p-2 bg-gray-50 dark:bg-gray-700 font-mono w-16 text-left border-r dark:border-gray-600">SK</th>
                                <td className="p-2 font-mono">{sk}</td>
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
                    const marshalled = marshall(item, {
                        removeUndefinedValues: true,
                        convertClassInstanceToMap: false
                    });
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


    return (
        <div className="flex flex-col gap-6 h-full relative">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-3xl">table_chart</span>
                    {tableName}
                </h1>
                <div className="flex gap-2">
                    {!readOnly && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="text-sm bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded font-bold transition-colors flex items-center gap-1 shadow-sm"
                        >
                            {t.common.import}
                        </button>
                    )}
                    {!readOnly && (
                        <Link
                            href={`/tables/${tableName}/item`}
                            className="text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded font-bold flex items-center gap-1 transition-colors shadow-sm"
                        >
                            {t.dashboard.newItem}
                        </Link>
                    )}
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
                        <ActionMenu
                            ACTION_DROPDOWN_ID={ACTION_DROPDOWN_ID}
                            isActionsOpen={isActionsOpen}
                            setIsActionsOpen={setIsActionsOpen}
                            readOnly={readOnly}
                            setIsBulkDeleteModalOpen={setIsBulkDeleteModalOpen}
                            selectedKeysSize={selectedKeys.size}
                            resultsLength={results.length}
                            handleDownload={handleDownload}
                            t={t}
                        />

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

                <SearchForm
                    mode={mode}
                    loading={loading}
                    error={error}
                    t={t}
                    indexInput={indexInput}
                    setIndexInput={setIndexInput}
                    pkInput={pkInput}
                    setPkInput={setPkInput}
                    skInput={skInput}
                    setSkInput={setSkInput}
                    gsis={gsis}
                    patterns={patterns}
                    patternId={patternId}
                    handlePatternChange={handlePatternChange}
                    patternParams={patternParams}
                    setPatternParams={setPatternParams}
                    patternsLoading={patternsLoading}
                    currentPattern={currentPattern}
                    dynamicFormFields={dynamicFormFields}
                    onSearch={handleSearchClick}
                />
            </div>

            <ResultsTable
                results={results}
                loading={loading}
                hasSearched={hasSearched}
                page={page}
                selectedKeys={selectedKeys}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                tableName={tableName}
                pathname={pathname}
                searchParams={searchParams}
                readOnly={readOnly}
                handleDeleteItem={handleDeleteItem}
                handlePrevPage={handlePrevPage}
                handleNextPage={handleNextPage}
                nextKey={nextKey}
                t={t}
            />

            {
                isSettingsOpen && (
                    <TableSettings
                        tableName={tableName}
                        patterns={patterns}
                        onClose={() => setIsSettingsOpen(false)}
                        onUpdate={handlePatternUpdate}
                        limit={limit}
                        setLimit={setLimit}
                        readOnly={readOnly}
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