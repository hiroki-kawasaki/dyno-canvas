'use client'

import {
    useState,
    useEffect,
    useCallback
} from 'react';
import {
    GlobalSecondaryIndexDescription,
    TimeToLiveDescription
} from '@aws-sdk/client-dynamodb';
import {
    upsertAccessPattern,
    deleteAccessPattern,
    exportAccessPatterns,
    getTableDetails,
    createGSI,
    deleteGSI,
    updateTTL
} from '@actions/dynamodb';
import ImportModal from '@components/shared/ImportModal';
import { useUI } from '@/contexts/UIContext';
import { AccessPatternConfig } from '@/types';

interface Props {
    tableName: string;
    patterns: AccessPatternConfig[];
    onClose: () => void;
    onUpdate: () => void;
    limit: number;
    setLimit: (val: number) => void;
    readOnly?: boolean;
}

export default function TableSettings({
    tableName,
    patterns,
    onClose,
    onUpdate,
    limit,
    setLimit,
    readOnly = false
}: Props) {
    const { t, showToast, confirm } = useUI();
    const [activeTab, setActiveTab] = useState<'details' | 'patterns' | 'search'>('search');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<AccessPatternConfig>>({});
    const [isLoadingPattern, setIsLoadingPattern] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [loadingDetails, setLoadingDetails] = useState(false);
    const [gsis, setGsis] = useState<GlobalSecondaryIndexDescription[]>([]);
    const [ttl, setTtl] = useState<TimeToLiveDescription | undefined>(undefined);
    const [isLocal, setIsLocal] = useState(false);

    const [isTtlModalOpen, setIsTtlModalOpen] = useState(false);
    const [ttlAttribute, setTtlAttribute] = useState('expireAt');

    const [isCreatingGsi, setIsCreatingGsi] = useState(false);
    const [newGsi, setNewGsi] = useState({ indexName: '', pk: '', sk: '' });

    const loadTableDetails = useCallback(async () => {
        setLoadingDetails(true);
        const res = await getTableDetails(tableName);
        if (res.success && res.table) {
            setGsis(res.table.GlobalSecondaryIndexes || []);
            setTtl(res.ttl);
            setIsLocal(!!res.isLocal);
        } else {
            showToast(res.error || t.common.error, 'error');
        }
        setLoadingDetails(false);
    }, [tableName, showToast, t]);

    useEffect(() => {
        if (activeTab === 'details') {
            loadTableDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEdit = (pattern: AccessPatternConfig) => {
        setEditingId(pattern.id);
        setFormData(pattern);
    };

    const handleNew = () => {
        setEditingId('__NEW__');
        setFormData({ id: '', label: '', description: '', pkFormat: '', skFormat: '' });
    };

    const handleSavePattern = async () => {
        if (!formData.id || !formData.label || !formData.pkFormat) {
            showToast(t.patterns.requiredFields, 'error');
            return;
        }
        setIsLoadingPattern(true);
        const isNew = editingId === '__NEW__';
        const res = await upsertAccessPattern(tableName, formData as AccessPatternConfig, !isNew);
        setIsLoadingPattern(false);

        if (res.success) {
            showToast(t.patterns.saveSuccess, 'success');
            setEditingId(null);
            onUpdate();
        } else {
            if (res.error === 'PatternAlreadyExists') {
                showToast(t.patterns.patternExists, 'error');
            } else {
                showToast(`${t.common.error}: ${res.error}`, 'error');
            }
        }
    };

    const handleDeletePattern = (id: string) => {
        confirm(t.common.confirm, t.patterns.deleteConfirm, async () => {
            setIsLoadingPattern(true);
            const res = await deleteAccessPattern(tableName, id);
            setIsLoadingPattern(false);
            if (res.success) {
                showToast(t.common.success, 'success');
                onUpdate();
            } else {
                showToast(t.common.error, 'error');
            }
        });
    };

    const handleExport = async () => {
        confirm(
            t.dashboard.exportConfirmTitle,
            t.patterns.exportConfirmMessage.replace('{count}', patterns.length.toString()),
            async () => {
                setIsExporting(true);
                const res = await exportAccessPatterns(tableName);
                setIsExporting(false);

                if (res.success && res.data) {
                    const blob = new Blob([res.data], { type: 'application/x-jsonlines' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const now = new Date();
                    const timestamp = now.toISOString().replace(/[:.]/g, '-');
                    a.download = `access-pattern_${timestamp}.jsonl`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast(t.dashboard.exportSuccess, 'success');
                } else {
                    showToast(`${t.dashboard.exportError}: ${res.error}`, 'error');
                }
            }
        );
    };

    const handleCreateGSI = async () => {
        if (!newGsi.indexName || !newGsi.pk) return;
        setIsLoadingPattern(true);
        const res = await createGSI(tableName, newGsi.indexName, newGsi.pk, newGsi.sk || undefined);
        setIsLoadingPattern(false);
        if (res.success) {
            showToast(t.tableSettings.gsiCreated, 'success');
            setNewGsi({ indexName: '', pk: '', sk: '' });
            setIsCreatingGsi(false);
            loadTableDetails();
        } else {
            showToast(`${t.common.error}: ${res.error}`, 'error');
        }
    };

    const handleDeleteGSI = (indexName: string) => {
        confirm(t.common.confirm, t.tableSettings.deleteGsiConfirm.replace('{indexName}', indexName), async () => {
            const res = await deleteGSI(tableName, indexName);
            if (res.success) {
                showToast(t.tableSettings.gsiDeleted, 'success');
                loadTableDetails();
            } else {
                showToast(`${t.common.error}: ${res.error}`, 'error');
            }
        });
    };

    const handleToggleTTL = async () => {
        const isEnabled = ttl?.TimeToLiveStatus === 'ENABLED';
        if (isEnabled) {
            confirm(t.common.confirm, t.tableSettings.disableTtl + "?", async () => {
                const res = await updateTTL(tableName, false, ttl.AttributeName || 'expireAt');
                if (res.success) {
                    showToast(t.tableSettings.ttlUpdated, 'success');
                    loadTableDetails();
                } else {
                    showToast(`${t.common.error}: ${res.error}`, 'error');
                }
            });
        } else {
            setTtlAttribute('expireAt');
            setIsTtlModalOpen(true);
        }
    };

    const handleEnableTtlSubmit = async () => {
        if (!ttlAttribute) return;
        setIsLoadingPattern(true);
        const res = await updateTTL(tableName, true, ttlAttribute);
        setIsLoadingPattern(false);
        setIsTtlModalOpen(false);

        if (res.success) {
            showToast(t.tableSettings.ttlUpdated, 'success');
            loadTableDetails();
        } else {
            showToast(`${t.common.error}: ${res.error}`, 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-7xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold">
                        {t.tableSettings.title.replace('{tableName}', tableName)}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => {
                            setActiveTab('details');
                            loadTableDetails();
                        }}
                    >
                        {t.tableSettings.tabDetails}
                    </button>
                    <button
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'patterns' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => setActiveTab('patterns')}
                    >
                        {t.tableSettings.tabPatterns}
                    </button>
                    <button
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'search' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => setActiveTab('search')}
                    >
                        {t.dashboard.searchSettings}
                    </button>
                </div>

                <div className="flex-grow overflow-hidden flex flex-col">
                    {activeTab === 'search' ? (
                        <div className="p-6 overflow-y-auto">
                            <h3 className="text-lg font-semibold mb-4">{t.dashboard.searchSettings}</h3>
                            <div className="bg-white dark:bg-gray-900 border p-4 rounded-lg">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.dashboard.displayCount}</label>
                                <div className="space-y-2">
                                    {[100, 250, 500, 1000].map((val) => (
                                        <div key={val} className="flex items-center">
                                            <input
                                                id={`limit-${val}`}
                                                name="limit-radio"
                                                type="radio"
                                                checked={limit === val}
                                                onChange={() => setLimit(val)}
                                                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`limit-${val}`} className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {val}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'details' ? (
                        <div className="p-6 overflow-y-auto space-y-8">
                            {loadingDetails ? (
                                <div className="text-center py-8 text-gray-500">{t.common.loading}</div>
                            ) : (
                                <>
                                    <section>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-semibold">{t.tableSettings.gsi}</h3>
                                            {!readOnly && (
                                                <button
                                                    onClick={() => setIsCreatingGsi(!isCreatingGsi)}
                                                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                                                >
                                                    {isCreatingGsi ? t.common.cancel : `${t.tableSettings.createGsi}`}
                                                </button>
                                            )}
                                        </div>

                                        {isCreatingGsi && (
                                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded mb-4 border border-blue-100 dark:border-blue-900">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Index Name</label>
                                                        <input
                                                            className="w-full border p-2 rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                            value={newGsi.indexName}
                                                            onChange={e => setNewGsi({ ...newGsi, indexName: e.target.value })}
                                                            placeholder="GSI1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t.tableSettings.pk}</label>
                                                        <input
                                                            className="w-full border p-2 rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                            value={newGsi.pk}
                                                            onChange={e => setNewGsi({ ...newGsi, pk: e.target.value })}
                                                            placeholder="GSI1PK"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t.tableSettings.sk} (Optional)</label>
                                                        <input
                                                            className="w-full border p-2 rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                            value={newGsi.sk}
                                                            onChange={e => setNewGsi({ ...newGsi, sk: e.target.value })}
                                                            placeholder="GSI1SK"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handleCreateGSI}
                                                        className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center justify-center"
                                                        disabled={!newGsi.indexName || !newGsi.pk}
                                                    >
                                                        {t.createTable.create}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {gsis.length === 0 ? (
                                            <p className="text-gray-500 text-sm italic">{t.tableSettings.noGsi}</p>
                                        ) : (
                                            <div className="bg-white dark:bg-gray-900 border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                                                        <tr>
                                                            <th className="p-3 font-medium">Index Name</th>
                                                            <th className="p-3 font-medium">Schema</th>
                                                            <th className="p-3 font-medium">Status</th>
                                                            <th className="p-3 font-medium text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {gsis.map(gsi => (
                                                            <tr key={gsi.IndexName}>
                                                                <td className="p-3 font-medium">{gsi.IndexName}</td>
                                                                <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                                                    PK: {gsi.KeySchema?.find(k => k.KeyType === 'HASH')?.AttributeName}
                                                                    {gsi.KeySchema?.find(k => k.KeyType === 'RANGE') && (
                                                                        <span className="ml-2">| SK: {gsi.KeySchema?.find(k => k.KeyType === 'RANGE')?.AttributeName}</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold
                                                                        ${gsi.IndexStatus === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                        {gsi.IndexStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right">

                                                                    {isLocal && !readOnly && (
                                                                        <button
                                                                            onClick={() => handleDeleteGSI(gsi.IndexName!)}
                                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                                                                            title={t.tableSettings.deleteGsi}
                                                                        >
                                                                            {t.tableSettings.deleteGsi}
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <h3 className="text-lg font-semibold mb-4">{t.tableSettings.ttl}</h3>
                                        <div className="bg-white dark:bg-gray-900 border p-4 rounded-lg flex justify-between items-center">
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">{t.tableSettings.ttlStatus}</div>
                                                <div className="font-medium text-lg flex items-center gap-2">
                                                    {ttl?.TimeToLiveStatus === 'ENABLED' ? (
                                                        <span className="text-green-600 flex items-center gap-1">
                                                            ● {t.tableSettings.ttlEnabled}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 flex items-center gap-1">
                                                            ○ {t.tableSettings.ttlDisabled}
                                                        </span>
                                                    )}
                                                </div>
                                                {ttl?.AttributeName && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Attribute: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{ttl.AttributeName}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {!readOnly && (
                                                <button
                                                    onClick={handleToggleTTL}
                                                    className={`px-4 py-2 rounded text-sm font-bold text-white transition-colors flex items-center justify-center 
                                                    ${ttl?.TimeToLiveStatus === 'ENABLED' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                                                >
                                                    {ttl?.TimeToLiveStatus === 'ENABLED' ? t.tableSettings.disableTtl : t.tableSettings.enableTtl}
                                                </button>
                                            )}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                    ) : (
                        <div className="flex-grow flex overflow-hidden">
                            <div className="w-1/3 min-w-[300px] border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-2 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col">
                                {!readOnly && (
                                    <button
                                        onClick={handleNew}
                                        className="w-full mb-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-bold shadow-sm transition-colors flex items-center justify-center"
                                    >
                                        {t.patterns.new}
                                    </button>
                                )}

                                <div className="space-y-1 flex-grow overflow-y-auto">
                                    {patterns.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4 italic">
                                            {t.dashboard.noPatterns}
                                        </p>
                                    ) : (
                                        patterns.map(p => (
                                            <div
                                                key={p.id}
                                                className={`flex justify-between items-center p-2 rounded border transition-colors ${editingId === p.id
                                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                                                    }`}
                                            >
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    className="text-left flex-grow truncate text-sm"
                                                >
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{p.label}</div>
                                                    <div className="text-xs text-gray-500 font-mono opacity-70">{p.id}</div>
                                                </button>
                                                {!readOnly && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeletePattern(p.id);
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                    {!readOnly && (
                                        <button
                                            onClick={() => setIsImportModalOpen(true)}
                                            className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-1.5 rounded font-medium transition-colors flex items-center justify-center"
                                        >
                                            {t.common.import}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleExport}
                                        disabled={isExporting || patterns.length === 0}
                                        className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-1.5 rounded font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {isExporting && '...'} {t.common.export}
                                    </button>
                                </div>
                            </div>

                            <div className="w-3/4 p-6 overflow-y-auto">
                                {editingId ? (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">
                                            {editingId === '__NEW__' ? t.patterns.new : t.common.detail}
                                        </h3>
                                        <div className="grid gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.id} *</label>
                                                <input
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                                                    value={formData.id}
                                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                                    disabled={editingId !== '__NEW__'}
                                                    placeholder="unique-id"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.label} *</label>
                                                <input
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700"
                                                    value={formData.label}
                                                    onChange={e => setFormData({ ...formData, label: e.target.value })}
                                                    placeholder="Label"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.description}</label>
                                                <textarea
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                                                    value={formData.description}
                                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.pkFormat} *</label>
                                                <input
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                                                    value={formData.pkFormat}
                                                    onChange={e => setFormData({ ...formData, pkFormat: e.target.value })}
                                                    placeholder="PREFIX#{userId}"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">{t.patterns.variableHint}</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.skFormat}</label>
                                                <input
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                                                    value={formData.skFormat || ''}
                                                    onChange={e => setFormData({ ...formData, skFormat: e.target.value })}
                                                    placeholder="SORT#{date}"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.patterns.indexName}</label>
                                                <input
                                                    className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                                                    value={formData.indexName || ''}
                                                    onChange={e => setFormData({ ...formData, indexName: e.target.value })}
                                                    placeholder="GSI1"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-6">
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                                            >
                                                {t.common.cancel}
                                            </button>
                                            {!readOnly && (
                                                <button
                                                    onClick={handleSavePattern}
                                                    disabled={isLoadingPattern}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                                                >
                                                    {isLoadingPattern ? t.common.saving : t.common.save}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <p>{t.patterns.selectPrompt}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {
                isImportModalOpen && (
                    <ImportModal
                        tableName={tableName}
                        onClose={() => setIsImportModalOpen(false)}
                        onSuccess={() => {
                            setIsImportModalOpen(false);
                            onUpdate();
                        }}
                        target="patterns"
                    />
                )
            }

            {
                isTtlModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
                            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{t.tableSettings.enableTtl}</h3>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t.tableSettings.ttlAttribute}
                                </label>
                                <input
                                    className="w-full border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={ttlAttribute}
                                    onChange={(e) => setTtlAttribute(e.target.value)}
                                    placeholder="expireAt"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    UNIX timestamp (seconds) attribute
                                </p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsTtlModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center"
                                >
                                    {t.common.cancel}
                                </button>
                                <button
                                    onClick={handleEnableTtlSubmit}
                                    disabled={isLoadingPattern || !ttlAttribute}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 transition-colors flex items-center justify-center"
                                >
                                    {isLoadingPattern ? t.common.saving : t.tableSettings.enableTtl}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}