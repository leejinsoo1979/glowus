'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Dynamic import for React Flow component to avoid SSR issues
const SchemaFlow = dynamic(
  () => import('./schema/SchemaFlow'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    ),
  }
)

interface SchemaViewProps {
  className?: string
}

export function SchemaView({ className }: SchemaViewProps) {
  return (
    <div className={cn('w-full h-full bg-zinc-50 dark:bg-zinc-950', className)}>
      <SchemaFlow className="w-full h-full" />
    </div>
  )
}
