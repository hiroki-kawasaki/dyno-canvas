'use client'

import {
    useState,
    useEffect,
    useCallback
} from 'react';
import { useRouter } from 'next/navigation';
import {
    marshall,
    unmarshall
} from "@aws-sdk/util-dynamodb";
import Editor from '@monaco-editor/react';
import {
    updateItem,
    replaceItem,
    createItem
} from '@actions/dynamodb';
import { sortDynamoItemKeys } from '@lib/utils';
import { useUI } from '@/contexts/UIContext';
import { DynamoItem } from '@/types';

interface ItemEditorProps {
    tableName: string;
    initialData: DynamoItem;
    onClose?: () => void;
    isCreateMode?: boolean;
    readOnly?: boolean;
}

type EditorMode = 'simple' | 'dynamo';

export default function ItemEditor({
    tableName,
    initialData,
    onClose,
    isCreateMode = false,
    readOnly = false
}: ItemEditorProps) {
    const { t, showToast, confirm } = useUI();
    const router = useRouter();

    const [mode, setMode] = useState<EditorMode>('simple');
    const [jsonValue, setJsonValue] = useState('');
    const [isValid, setIsValid] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [canSwitchToSimple, setCanSwitchToSimple] = useState(true);

    const hasSetType = useCallback((obj: unknown): boolean => {
        if (obj instanceof Set) return true;
        if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
                if (hasSetType(value)) return true;
            }
        }
        return false;
    }, []);

    const checkSimpleAvailability = useCallback((val: string) => {
        try {
            const obj = JSON.parse(val);
            if (mode === 'dynamo') {
                const unmarshalled = unmarshall(obj);
                setCanSwitchToSimple(!hasSetType(unmarshalled));
            } else {
                setCanSwitchToSimple(true);
            }
        } catch {
            setCanSwitchToSimple(false);
        }
    }, [mode, hasSetType]);

    useEffect(() => {
        checkSimpleAvailability(jsonValue);
    }, [jsonValue, checkSimpleAvailability]);

    const formatJson = useCallback((jsonStr: string) => {
        try {
            const parsed = JSON.parse(jsonStr);
            return JSON.stringify(parsed, null, 4);
        } catch {
            return jsonStr;
        }
    }, []);

    useEffect(() => {
        const sortedData = sortDynamoItemKeys(initialData);
        const containsSets = hasSetType(sortedData);

        if (containsSets) {
            setMode('dynamo');
            const marshalled = marshall(sortedData, {
                removeUndefinedValues: true,
                convertClassInstanceToMap: false
            });
            setJsonValue(JSON.stringify(marshalled, null, 4));
            setCanSwitchToSimple(false);
        } else {
            setMode('simple');
            setJsonValue(JSON.stringify(sortedData, null, 4));
            setCanSwitchToSimple(true);
        }
    }, [initialData, hasSetType]);

    const handleEditorChange = (value: string | undefined) => {
        const val = value || '';
        setJsonValue(val);
        try {
            JSON.parse(val);
            setIsValid(true);
        } catch {
            setIsValid(false);
            setCanSwitchToSimple(false);
        }
    };

    const handleModeSwitch = (newMode: EditorMode) => {
        if (newMode === mode) return;

        try {
            const currentObj = JSON.parse(jsonValue);

            if (newMode === 'simple') {
                const unmarshalled = unmarshall(currentObj);
                if (hasSetType(unmarshalled)) {
                    return;
                }
                setJsonValue(JSON.stringify(sortDynamoItemKeys(unmarshalled as DynamoItem), null, 4));
            } else {
                const marshalled = marshall(currentObj, { removeUndefinedValues: true, convertClassInstanceToMap: false });
                setJsonValue(JSON.stringify(marshalled, null, 4));
            }
            setMode(newMode);
        } catch {
            showToast(t.editor.invalidJson, 'error');
        }
    };

    const handleFormat = () => {
        setJsonValue(prev => formatJson(prev));
    };

    const performSave = async (parsedItem: DynamoItem, isReplace: boolean) => {
        setIsSaving(true);
        try {
            let res;
            if (isCreateMode) {
                res = await createItem(tableName, parsedItem);
            } else if (isReplace) {
                res = await replaceItem(tableName, { PK: initialData.PK, SK: initialData.SK }, parsedItem);
            } else {
                res = await updateItem(tableName, parsedItem);
            }

            if (res.success) {
                showToast(t.editor.saveSuccess, 'success');
                if (isCreateMode) {
                    router.push(`/tables/${tableName}/item?pk=${encodeURIComponent(parsedItem.PK)}&sk=${encodeURIComponent(parsedItem.SK)}`);
                } else if (onClose) {
                    onClose();
                }
            } else {
                if (res.error === 'ItemAlreadyExists') {
                    showToast(t.editor.itemExists, 'error');
                } else {
                    showToast(`${t.editor.saveError}: ${res.error || 'Unknown'}`, 'error');
                }
            }
        } catch {
            showToast(t.editor.saveError, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = () => {
        if (!isValid) return;

        try {
            let parsedItem: DynamoItem;
            const rawObj = JSON.parse(jsonValue);

            if (mode === 'dynamo') {
                parsedItem = unmarshall(rawObj) as DynamoItem;
            } else {
                parsedItem = rawObj as DynamoItem;
            }

            if (!parsedItem.PK || !parsedItem.SK) {
                showToast(t.editor.missingKeys, 'error');
                return;
            }

            if (isCreateMode) {
                performSave(parsedItem, false);
            } else {
                if (parsedItem.PK !== initialData.PK || parsedItem.SK !== initialData.SK) {
                    confirm(
                        t.editor.pkSkChanged,
                        t.editor.pkSkChangedDesc,
                        () => performSave(parsedItem, true)
                    );
                } else {
                    performSave(parsedItem, false);
                }
            }
        } catch {
            showToast(t.editor.invalidJson, 'error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white p-4 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold whitespace-nowrap">{t.editor.title}</h3>

                    <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                        <button
                            onClick={() => handleModeSwitch('simple')}
                            disabled={!canSwitchToSimple}
                            className={`px-3 py-1 text-xs rounded transition-colors flex items-center justify-center ${mode === 'simple' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                            {t.editor.jsonSimple}
                        </button>
                        <button
                            onClick={() => handleModeSwitch('dynamo')}
                            className={`px-3 py-1 text-xs rounded transition-colors flex items-center justify-center ${mode === 'dynamo' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t.editor.jsonDynamo}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!isValid && <span className="text-red-500 text-sm mr-2">{t.editor.invalidJson}</span>}

                    <button
                        onClick={handleFormat}
                        disabled={!isValid}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                        title={t.editor.format}
                    >
                        {t.editor.format}
                    </button>

                    {!readOnly && (
                        <button
                            onClick={handleSave}
                            disabled={!isValid || isSaving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-bold transition-colors text-sm min-w-[80px] flex items-center justify-center"
                        >
                            {isSaving ? t.common.saving : t.common.save}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-grow border border-gray-700 rounded overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage="json"
                    value={jsonValue}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                        readOnly: readOnly,
                        minimap: { enabled: false },
                        formatOnPaste: true,
                        automaticLayout: true,
                        tabSize: 4,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on'
                    }}
                />
            </div>
        </div>
    );
}