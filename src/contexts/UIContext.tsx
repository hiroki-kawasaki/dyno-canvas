'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { switchLanguage } from '@actions/settings';
import { dictionary } from '@lib/i18n';
import { Language, ToastMessage, ToastType } from '@/types';

interface ModalConfig {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}

interface UIContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: typeof dictionary['en'];
    showToast: (message: string, type?: ToastType) => void;
    confirm: (title: string, message: ReactNode, onConfirm: () => void) => void;
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    theme: 'system' | 'light' | 'dark';
    setTheme: (theme: 'system' | 'light' | 'dark') => void;
    accountId: string;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({
    children,
    initialLanguage,
    initialSidebarOpen = true,
    accountId = 'Unknown'
}: {
    children: ReactNode,
    initialLanguage?: Language,
    initialSidebarOpen?: boolean,
    accountId?: string
}) {
    const [language, setLanguageState] = useState<Language>(initialLanguage || 'en');
    const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
    const [theme, setThemeState] = useState<'system' | 'light' | 'dark'>('system');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [modal, setModal] = useState<ModalConfig>({
        isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }
    });

    const setLanguage = useCallback(async (lang: Language) => {
        setLanguageState(lang);
        await switchLanguage(lang);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(prev => {
            const next = !prev;
            document.cookie = `sidebar-open=${next}; path=/; max-age=31536000`;
            return next;
        });
    }, []);

    const setTheme = useCallback((t: 'system' | 'light' | 'dark') => {
        setThemeState(t);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', theme);
            if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [theme]);

    useEffect(() => {
        const stored = localStorage.getItem('theme') as 'system' | 'light' | 'dark';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (stored) setThemeState(stored);
    }, []);

    const t = dictionary[language];

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 3000);
    }, []);

    const confirm = useCallback((title: string, message: ReactNode, onConfirm: () => void) => {
        setModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setModal(prev => ({ ...prev, isOpen: false }));
            },
            onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
        });
    }, []);

    return (
        <UIContext.Provider value={{
            language, setLanguage, t, showToast, confirm,
            sidebarOpen, toggleSidebar,
            theme, setTheme,
            accountId
        }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`px-4 py-3 rounded shadow-lg text-white text-sm animate-fade-in-up ${toast.type === 'success' ? 'bg-green-600' :
                        toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
                        }`}>
                        {toast.message}
                    </div>
                ))}
            </div>
            {modal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{modal.title}</h3>
                        <div className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{modal.message}</div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={modal.onCancel}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                {t.common.cancel}
                            </button>
                            <button
                                onClick={modal.onConfirm}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded"
                            >
                                {t.common.confirm}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
}

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within UIProvider');
    return context;
};