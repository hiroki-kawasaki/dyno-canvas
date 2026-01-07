'use client'

import Link from 'next/link';
import { useUI } from '@/contexts/UIContext';

interface Props {
    tableName: string;
    isCreateMode: boolean;
    pk?: string;
    sk?: string;
    backUrl?: string;
}

export default function ItemDetailHeader({ tableName, isCreateMode, pk, sk, backUrl }: Props) {
    const { t } = useUI();

    return (
        <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link
                    href={backUrl || `/tables/${tableName}`}
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                    ← {t.editor.backToSearch}
                </Link>
                <h1 className="text-xl font-bold">
                    {isCreateMode ? t.editor.createTitle : t.editor.detailTitle}
                </h1>
            </div>
            {!isCreateMode && (
                <div className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    PK: {pk} / SK: {sk}
                </div>
            )}
        </div>
    );
}