'use client'

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteTable } from '@actions/dynamodb';
import { EnvMode } from '@actions/settings';
import { useUI } from '@/contexts/UIContext';

interface TableListTableProps {
    tables: string[];
    mode: EnvMode;
    adminTableName?: string;
    showActions?: boolean;
    readOnly?: boolean;
}

export default function TableListTable({
    tables,
    mode,
    adminTableName = "dyno-canvas",
    showActions = true,
    readOnly = false
}: TableListTableProps) {
    const { t, confirm, showToast } = useUI();
    const router = useRouter();

    const displayTables = tables.filter(t => t !== adminTableName);

    const handleDeleteTable = (tableName: string) => {
        confirm(
            t.common.delete,
            t.home.deleteTableConfirm.replace('{tableName}', tableName),
            async () => {
                const res = await deleteTable(tableName);
                if (res.success) {
                    showToast(t.home.tableDeleted, "success");
                    router.refresh();
                } else {
                    showToast(`${t.common.error}: ${res.error}`, "error");
                }
            }
        );
    };

    if (displayTables.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <p>{t.tables.noTables}</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t.tables.name}
                        </th>
                        {showActions && (
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t.tables.actions}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {displayTables.map((table) => (
                        <tr key={table} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Link href={`/tables/${table}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                    {table}
                                </Link>
                            </td>
                            {showActions && (
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {mode === 'local' && !readOnly && (
                                        <button
                                            onClick={() => handleDeleteTable(table)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4"
                                        >
                                            {t.common.delete}
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
