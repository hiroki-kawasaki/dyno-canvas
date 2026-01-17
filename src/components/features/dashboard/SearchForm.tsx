import React from 'react';
import { GlobalSecondaryIndexDescription } from '@aws-sdk/client-dynamodb';
import { AccessPatternConfig } from '@/types';
import { Dictionary } from '@lib/i18n';

interface SearchFormProps {
    mode: 'free' | 'pattern';
    loading: boolean;
    error: string;
    t: Dictionary;

    // Free Search Props
    indexInput: string;
    setIndexInput: (val: string) => void;
    pkInput: string;
    setPkInput: (val: string) => void;
    skInput: string;
    setSkInput: (val: string) => void;
    gsis: GlobalSecondaryIndexDescription[];

    // Pattern Search Props
    patterns: AccessPatternConfig[];
    patternId?: string;
    handlePatternChange: (val: string) => void;
    patternParams: Record<string, string>;
    setPatternParams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    patternsLoading: boolean;
    currentPattern?: AccessPatternConfig;
    dynamicFormFields: { name: string; required: boolean; }[];

    onSearch: (e: React.FormEvent) => void;
}

export default function SearchForm({
    mode,
    loading,
    error,
    t,
    indexInput,
    setIndexInput,
    pkInput,
    setPkInput,
    skInput,
    setSkInput,
    gsis,
    patterns,
    patternId,
    handlePatternChange,
    patternParams,
    setPatternParams,
    patternsLoading,
    currentPattern,
    dynamicFormFields,
    onSearch
}: SearchFormProps) {

    const showSearchControls = mode === 'free' || (mode === 'pattern' && !!currentPattern);

    return (
        <div className="relative z-20">
            {mode === 'pattern' && patterns.length === 0 && !patternsLoading ? (
                <div className="flex-1 p-3 text-sm text-red-600 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400 rounded flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    {t.dashboard.noPatterns}
                </div>
            ) : (
                <form onSubmit={onSearch} className="flex gap-4 items-end flex-wrap">
                    {mode === 'free' ? (
                        <>
                            <div className="flex flex-col flex-1 min-w-[120px] max-w-[150px]">
                                <label className="text-xs text-gray-500 mb-1">{t.dashboard.index}</label>
                                <select
                                    className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                    value={indexInput}
                                    onChange={(e) => setIndexInput(e.target.value)}
                                >
                                    <option value="">{t.dashboard.tableBase}</option>
                                    {gsis.map(g => (
                                        <option key={g.IndexName} value={g.IndexName}>{g.IndexName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col flex-1 min-w-[200px]">
                                <label className="text-xs text-gray-500 mb-1">
                                    {t.dashboard.pk}
                                    <span className="ml-1 font-mono text-gray-400">
                                        ({mode === 'free' && indexInput && gsis.find(g => g.IndexName === indexInput)?.KeySchema?.find(k => k.KeyType === 'HASH')?.AttributeName || 'PK'})
                                    </span>
                                </label>
                                <input
                                    className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                    placeholder="e.g. USER#123"
                                    value={pkInput}
                                    onChange={(e) => setPkInput(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col flex-1 min-w-[200px]">
                                <label className="text-xs text-gray-500 mb-1">
                                    {t.dashboard.sk}
                                    <span className="ml-1 font-mono text-gray-400">
                                        ({mode === 'free' && indexInput && gsis.find(g => g.IndexName === indexInput)?.KeySchema?.find(k => k.KeyType === 'RANGE')?.AttributeName || 'SK'})
                                    </span>
                                </label>
                                <input
                                    className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                    placeholder="e.g. ORDER#"
                                    value={skInput}
                                    onChange={(e) => setSkInput(e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col w-80">
                                <label className="text-xs text-gray-500 mb-1">{t.dashboard.selectPattern}</label>
                                {patternsLoading ? (
                                    <div className="p-2 text-sm text-gray-500">{t.dashboard.patternLoading}</div>
                                ) : (
                                    <select
                                        className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        value={patternId || ''}
                                        onChange={(e) => handlePatternChange(e.target.value)}
                                    >
                                        <option value="" disabled>{t.dashboard.selectPattern}</option>
                                        {patterns.map(p => (
                                            <option key={p.id} value={p.id}>{p.label}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {dynamicFormFields.map(field => (
                                <div key={field.name} className="flex flex-col flex-1 min-w-[150px]">
                                    <label className="text-xs text-gray-500 flex gap-1 mb-1">
                                        {field.name}
                                        {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        className="border p-2 rounded w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm"
                                        placeholder={`Value`}
                                        value={patternParams[field.name] || ''}
                                        onChange={(e) => setPatternParams(prev => ({
                                            ...prev,
                                            [field.name]: e.target.value
                                        }))}
                                        required={field.required}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {showSearchControls && (
                        <button
                            type="submit"
                            disabled={loading || (mode === 'pattern' && !currentPattern)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors h-[38px]"
                        >
                            {loading ? t.dashboard.searching : t.dashboard.search}
                        </button>
                    )}
                </form>
            )}
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
            {currentPattern && mode === 'pattern' && (
                <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                    <span className="font-bold">PK:</span> {currentPattern.pkFormat} <span className="mx-2">|</span> <span className="font-bold">SK:</span> {currentPattern.skFormat || '(none)'}
                    {currentPattern.indexName && <span className="ml-2 font-mono text-blue-600 dark:text-blue-400">[Index: {currentPattern.indexName}]</span>}
                    {currentPattern.description && <span className="ml-2 text-gray-500">- {currentPattern.description}</span>}
                </div>
            )}
        </div>
    );
}
