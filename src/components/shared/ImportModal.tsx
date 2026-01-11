'use client'

import {
    useState,
    useRef
} from 'react';
import { useUI } from '@/contexts/UIContext';
import {
    importItems,
    importAccessPatterns
} from '@actions/dynamodb';

interface ImportModalProps {
    tableName: string;
    onClose: () => void;
    onSuccess: () => void;
    target: 'items' | 'patterns';
}

export default function ImportModal({
    tableName,
    onClose,
    onSuccess,
    target
}: ImportModalProps) {
    const { t, showToast, confirm } = useUI();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleImportClick = async () => {
        if (!file) return;

        const content = await file.text();
        const lines = content.split('\n').filter(line => line.trim() !== '');

        let count = lines.length;

        if (target === 'patterns') {
            count = lines.filter(line => {
                try {
                    const json = JSON.parse(line);
                    const pk = json?.Item?.PK?.S;
                    return typeof pk === 'string' && pk.startsWith("AccountId#") && pk.endsWith("#DynoCanvas#AccessPattern");
                } catch {
                    return false;
                }
            }).length;

            if (count === 0) {
                showToast(t.patterns.noPatternsFound, 'error');
                return;
            }
        }

        const confirmTitle = target === 'items' ? t.dashboard.importConfirmTitle : t.dashboard.importConfirmTitle;
        const confirmMessage = target === 'items'
            ? t.dashboard.importConfirmMessage.replace('{count}', count.toString())
            : t.patterns.importConfirmMessage.replace('{count}', count.toString());

        confirm(confirmTitle, confirmMessage, () => executeImport());
    };

    const executeImport = async () => {
        if (!file) return;

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            let res;
            if (target === 'items') {
                res = await importItems(tableName, formData);
            } else {
                res = await importAccessPatterns(tableName, formData);
            }

            if (res.success) {
                showToast(t.dashboard.importSuccess.replace('{count}', (res.count || 0).toString()), 'success');
                onSuccess();
            } else {
                showToast(`${t.dashboard.importError}: ${res.error}`, 'error');
            }
        } catch {
            showToast(t.dashboard.importError, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const title = target === 'items' ? t.dashboard.importTitle : t.patterns.importTitle;
    const description = target === 'items' ? t.dashboard.importDesc : t.patterns.importDesc;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md w-full">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
                    {title}
                </h3>

                <div className="mb-6">
                    <p
                        className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: description }}
                    />

                    <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            accept=".jsonl"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        {file ? (
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {file.name}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 text-sm">
                                {t.dashboard.filePlaceholder}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        disabled={isLoading}
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={!file || isLoading}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 transition-colors font-medium min-w-[100px]"
                    >
                        {isLoading ? t.dashboard.importing : t.common.import}
                    </button>
                </div>
            </div>
        </div>
    );
}