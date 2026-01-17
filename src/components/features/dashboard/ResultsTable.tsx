import Link from 'next/link';
import { marshall } from "@aws-sdk/util-dynamodb";
import { DynamoItem } from '@/types';
import { Dictionary } from '@lib/i18n';

interface ResultsTableProps {
    results: DynamoItem[];
    loading: boolean;
    hasSearched: boolean;
    page: number;
    selectedKeys: Set<string>;
    toggleSelect: (item: DynamoItem) => void;
    toggleSelectAll: () => void;
    tableName: string;
    pathname: string;
    searchParams: URLSearchParams | Readonly<URLSearchParams>;
    readOnly: boolean;
    handleDeleteItem: (pk: string, sk: string) => void;
    handlePrevPage: () => void;
    handleNextPage: () => void;
    nextKey: Record<string, unknown> | undefined;
    t: Dictionary;
}

export default function ResultsTable({
    results,
    loading,
    hasSearched,
    page,
    selectedKeys,
    toggleSelect,
    toggleSelectAll,
    tableName,
    pathname,
    searchParams,
    readOnly,
    handleDeleteItem,
    handlePrevPage,
    handleNextPage,
    nextKey,
    t
}: ResultsTableProps) {

    const getKeyString = (item: DynamoItem) => JSON.stringify({ PK: item.PK, SK: item.SK });

    const getDisplayAttributes = (item: DynamoItem) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { PK, SK, ...rest } = item;
        const marshalled = marshall(rest, { removeUndefinedValues: true, convertClassInstanceToMap: false });
        return JSON.stringify(marshalled);
    };

    return (
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
                            <th className="p-3 w-60 text-gray-600 dark:text-gray-300 font-medium">PK</th>
                            <th className="p-3 w-60 text-gray-600 dark:text-gray-300 font-medium">SK</th>
                            <th className="p-3 text-gray-600 dark:text-gray-300 font-medium">{t.dashboard.attributes}</th>
                            <th className="p-3 w-32 text-gray-600 dark:text-gray-300 font-medium text-right"></th>
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
                                            {!readOnly && (
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
    );
}
