'use client'
import { useState } from 'react';
import { useUI } from '@/contexts/UIContext';
import { EnvMode } from '@actions/settings';
import { exportTable, deleteTable } from '@actions/dynamodb';
import ImportModal from '@components/shared/ImportModal';
import { useRouter } from 'next/navigation';

interface SettingsContentProps {
    settings: {
        mode: EnvMode;
        region: string;
        language: 'en' | 'ja';
    };
    systemStatus: {
        isLocalAvailable: boolean;
        availableRegions: string[];
    };
    adminTableExists: boolean;
    adminTableName: string;
}

export default function SettingsContent({ settings, systemStatus, adminTableExists, adminTableName, accountId }: SettingsContentProps & { accountId: string }) {
    const { t, showToast, confirm } = useUI();
    const router = useRouter();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleExportAdmin = async () => {
        setIsExporting(true);
        try {
            const res = await exportTable(adminTableName);
            if (res.success && res.data) {
                const blob = new Blob([res.data], { type: 'application/x-jsonlines' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${adminTableName}_export.jsonl`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(t.dashboard.exportSuccess, 'success');
            } else {
                showToast(`${t.dashboard.exportError}: ${res.error}`, 'error');
            }
        } catch {
            showToast(t.dashboard.exportError, 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAdminTable = () => {
        confirm(t.settings.deleteAdminTable, t.settings.deleteAdminTableConfirm, async () => {
            setIsDeleting(true);
            try {
                const res = await deleteTable(adminTableName);
                if (res.success) {
                    showToast(t.settings.adminTableDeleted, 'success');
                    router.refresh();
                } else {
                    showToast(`${t.common.error}: ${res.error}`, 'error');
                }
            } catch {
                showToast(t.common.error, 'error');
            } finally {
                setIsDeleting(false);
            }
        });
    };
    return (
        <main className="w-full p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t.sidebar.settings}</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{t.settings.envInfo}</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-600 dark:text-gray-400">{t.settings.mode}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${settings.mode === 'local'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                            {settings.mode === 'local' ? 'LOCAL' : `AWS (${accountId})`}
                        </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-600 dark:text-gray-400">{t.settings.region}</span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">{settings.region}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-600 dark:text-gray-400">{t.settings.local}</span>
                        <span className={`text-sm ${systemStatus.isLocalAvailable ? 'text-green-600' : 'text-red-500'}`}>
                            {systemStatus.isLocalAvailable ? t.settings.available : t.settings.unavailable}
                        </span>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t.settings.switchEnvDesc}
                    </p>
                </div>
            </div>

            {adminTableExists && (
                <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{t.settings.adminManagement}</h3>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t.home.systemManagementDesc}
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors flex items-center gap-2 text-sm"
                            >
                                {t.common.import}
                            </button>
                            <button
                                onClick={handleExportAdmin}
                                disabled={isExporting}
                                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                            >
                                {isExporting && '...'} {t.common.export}
                            </button>

                            {settings.mode === 'local' && (
                                <button
                                    onClick={handleDeleteAdminTable}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors flex items-center gap-2 text-sm disabled:opacity-50 ml-auto"
                                >
                                    {t.settings.deleteAdminTable}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <ImportModal
                    tableName={adminTableName}
                    onClose={() => setIsImportModalOpen(false)}
                    onSuccess={() => {
                        setIsImportModalOpen(false);
                        router.refresh();
                        showToast(t.home.adminDataImported, "success");
                    }}
                    target="items"
                />
            )}
        </main>
    );
}

