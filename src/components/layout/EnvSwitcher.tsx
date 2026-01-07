'use client'

import { useTransition } from 'react';
import { switchEnvMode } from '@/actions/settings';

interface Props {
    currentMode: 'aws' | 'local';
}

export default function EnvSwitcher({ currentMode }: Props) {
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        const nextMode = currentMode === 'aws' ? 'local' : 'aws';
        startTransition(async () => {
            await switchEnvMode(nextMode);
        });
    };

    return (
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full border border-gray-200 dark:border-gray-700">
            <span className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${currentMode === 'aws' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500'}`}>
                AWS
            </span>

            <button
                onClick={handleToggle}
                disabled={isPending}
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-gray-300 dark:bg-gray-600"
            >
                <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${currentMode === 'local' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                />
            </button>

            <span className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${currentMode === 'local' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500'}`}>
                Local
            </span>
        </div>
    );
}