'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTable } from '@actions/dynamodb';
import { useUI } from '@/contexts/UIContext';

export default function CreateTableModal() {
    const { showToast, t } = useUI();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [tableName, setTableName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!tableName) return;
        setIsLoading(true);
        const res = await createTable(tableName);
        setIsLoading(false);

        if (res.success) {
            showToast(t.createTable.success, 'success');
            setIsOpen(false);
            setTableName('');
            router.push(`/tables/${encodeURIComponent(tableName)}`);
        } else {
            showToast(`${t.common.error}: ${res.error}`, 'error');
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
                {t.createTable.button}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{t.createTable.title}</h3>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t.createTable.tableName}
                    </label>
                    <input
                        className="w-full border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder={t.createTable.placeholder}
                    />
                    <p
                        className="text-xs text-gray-500 dark:text-gray-400 mt-2"
                        dangerouslySetInnerHTML={{ __html: t.createTable.description }}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isLoading || !tableName}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? t.createTable.creating : t.createTable.create}
                    </button>
                </div>
            </div>
        </div>
    );
}