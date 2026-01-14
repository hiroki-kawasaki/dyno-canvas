import React, { useEffect } from 'react';
import { Dictionary } from '@lib/i18n';

interface ActionMenuProps {
    ACTION_DROPDOWN_ID: string;
    isActionsOpen: boolean;
    setIsActionsOpen: (val: boolean) => void;
    readOnly: boolean;
    setIsBulkDeleteModalOpen: (val: boolean) => void;
    selectedKeysSize: number;
    resultsLength: number;
    handleDownload: (target: 'selected' | 'results', format: 'jsonl' | 'csv') => void;
    t: Dictionary;
}

export default function ActionMenu({
    ACTION_DROPDOWN_ID,
    isActionsOpen,
    setIsActionsOpen,
    readOnly,
    setIsBulkDeleteModalOpen,
    selectedKeysSize,
    resultsLength,
    handleDownload,
    t
}: ActionMenuProps) {

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isActionsOpen && !target.closest(`#${ACTION_DROPDOWN_ID}`)) {
                setIsActionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isActionsOpen, ACTION_DROPDOWN_ID, setIsActionsOpen]);

    return (
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
                    {!readOnly && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            disabled={selectedKeysSize === 0}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t.dashboard.bulkDelete.replace('{count}', selectedKeysSize.toString())}
                        </button>
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                    <button
                        onClick={() => handleDownload('selected', 'jsonl')}
                        disabled={selectedKeysSize === 0}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.dashboard.downloadSelectedJsonl}
                    </button>
                    <button
                        onClick={() => handleDownload('selected', 'csv')}
                        disabled={selectedKeysSize === 0}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.dashboard.downloadSelectedCsv}
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                    <button
                        onClick={() => handleDownload('results', 'jsonl')}
                        disabled={resultsLength === 0}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.dashboard.downloadResultsJsonl}
                    </button>
                    <button
                        onClick={() => handleDownload('results', 'csv')}
                        disabled={resultsLength === 0}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.dashboard.downloadResultsCsv}
                    </button>
                </div>
            )}
        </div>
    );
}
