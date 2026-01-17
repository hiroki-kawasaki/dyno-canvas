'use client'

import { useEffect } from 'react'
import { useUI } from '@/contexts/UIContext'

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const { t } = useUI()

    useEffect(() => {
        console.error(error)
    }, [error])

    const isAuthError =
        error.name === 'UnrecognizedClientException' ||
        error.name === 'InvalidSignatureException' ||
        error.name === 'AuthFailure' ||
        error.name === 'CredentialsError' ||
        error.name === 'AccessDeniedException' ||
        error.name === 'ExpiredTokenException' ||
        error.message?.toLowerCase().includes('security token') ||
        error.message?.toLowerCase().includes('credential') ||
        error.message?.toLowerCase().includes('auth');

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center">
            <div className="p-4 rounded-full">
                <span className="material-symbols-outlined text-5xl text-red-600 dark:text-red-400">
                    {isAuthError ? 'lock_person' : 'error'}
                </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                {isAuthError ? t.common.authError : t.common.error}
            </h2>

            <div className="max-w-xl bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-8 overflow-auto max-h-48 w-full font-mono text-sm text-gray-700 dark:text-gray-300">
                {error.message}
            </div>

            {!isAuthError && (
                <button
                    onClick={reset}
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900"
                >
                    {t.common.tryAgain}
                </button>
            )}
        </div>
    )
}
