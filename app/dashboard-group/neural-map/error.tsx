'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex flex-col items-center max-w-md text-center space-y-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>

                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    Neural Map Error
                </h2>

                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Something went wrong while loading the map.
                    <br />
                    <span className="font-mono text-xs opacity-75 mt-2 block">
                        {error.message || 'Unknown error occurred'}
                    </span>
                </p>

                <button
                    onClick={reset}
                    className="px-4 py-2 mt-4 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:opacity-90 transition-opacity"
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
