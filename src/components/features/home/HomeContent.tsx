'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnvMode } from '@actions/settings';
import { createAdminTable } from '@actions/admin';
import CreateTableModal from '@components/features/tables/CreateTableModal';
import TableListTable from '@components/features/tables/TableListTable';
import { useUI } from '@/contexts/UIContext';

interface HomeContentProps {
    tables: string[];
    mode: EnvMode;
    adminTableName?: string;
    readOnly: boolean;
}

export default function HomeContent({
    tables,
    mode,
    adminTableName = "dyno-canvas",
    readOnly
}: HomeContentProps) {
    const { t, showToast, confirm } = useUI();
    const router = useRouter();
    const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

    const adminTableExists = tables.includes(adminTableName);

    const handleCreateAdminTable = async () => {
        confirm(
            t.home.createAdminTableConfirm,
            (
                <div className="text-sm">
                    <p className="mb-2">{t.home.createAdminTableDetails}</p>
                    <ul className="list-disc pl-5 font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded">
                        <li>Table Name: <strong>{adminTableName}</strong></li>
                        <li>Partition Key: <strong>PK</strong> (String)</li>
                        <li>Sort Key: <strong>SK</strong> (String)</li>
                        <li>Billing Mode: <strong>PAY_PER_REQUEST</strong></li>
                    </ul>
                </div>
            ),
            async () => {
                setIsCreatingAdmin(true);
                try {
                    const res = await createAdminTable();
                    if (res.success) {
                        showToast(t.home.adminTableCreated, "success");
                        router.refresh();
                    } else {
                        showToast(`${t.home.adminTableCreateError}: ${res.error}`, "error");
                    }
                } catch {
                    showToast(t.home.adminTableCreateError, "error");
                } finally {
                    setIsCreatingAdmin(false);
                }
            }
        );
    };

    return (
        <main className="w-full p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    {t.sidebar.dashboard}
                </h1>
            </div>

            {!adminTableExists && !readOnly && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 mb-8 rounded-r-lg shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <span className="material-symbols-outlined text-amber-500 text-3xl">warning</span>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-amber-800 dark:text-amber-200">
                                    {t.home.adminTableMissing.replace('{tableName}', adminTableName)}
                                </h3>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                    {t.home.adminTableMissingDesc}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCreateAdminTable}
                            disabled={isCreatingAdmin}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-md shadow transition-colors font-medium whitespace-nowrap"
                        >
                            {isCreatingAdmin ? t.home.creatingAdminTable : t.home.createAdminTable}
                        </button>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">
                    {t.tables.title}
                </h2>
                {!readOnly && <CreateTableModal />}
            </div>
            <TableListTable tables={tables} mode={mode} adminTableName={adminTableName} readOnly={readOnly} />
        </main >
    );
}