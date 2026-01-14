import React, { useState } from 'react';
import { useUI } from '@/contexts/UIContext';
import { EnvMode } from '@actions/settings';

export interface DeleteTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    tableName: string;
    mode: EnvMode;
    region: string;
    accountId: string;
    isDeleting: boolean;
}

export default function DeleteTableModal({
    isOpen,
    onClose,
    onConfirm,
    tableName,
    mode,
    region,
    accountId,
    isDeleting
}: DeleteTableModalProps) {
    const { t } = useUI();
    const [inputValue, setInputValue] = useState('');

    if (!isOpen) return null;

    const expectedValue = mode === 'local'
        ? `local:${tableName}`
        : `${region}:${accountId}:${tableName}`;

    const isValid = inputValue === expectedValue;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.home.deleteTableConfirm.replace('{tableName}', tableName)}
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {t.home.deleteTableInputInstruction.replace('{identifier}', expectedValue)}
                </p>

                <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-1">
                        Table Identifier: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded select-all">{expectedValue}</span>
                    </label>
                    <input
                        className="w-full border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono text-sm"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={expectedValue}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        disabled={isDeleting}
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isValid || isDeleting}
                        className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded disabled:opacity-50 flex items-center gap-2"
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
    );
}
