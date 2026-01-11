'use client'

import { useUI } from '@/contexts/UIContext';
import TableListTable from './TableListTable';
import CreateTableModal from './CreateTableModal';
import { EnvMode } from '@actions/settings';

interface TableListContentProps {
    tables: string[];
    mode: EnvMode;
    adminTableName?: string;
}

export default function TableListContent({ tables, mode, adminTableName }: TableListContentProps) {
    const { t } = useUI();

    return (
        <main className="w-full p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    {t.tables.title}
                </h1>
                <CreateTableModal />
            </div>

            <TableListTable tables={tables} mode={mode} adminTableName={adminTableName} />
        </main>
    );
}
