'use client'

import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-zinc-400 text-sm">AI 슬라이드 로딩 중...</p>
      </div>
    </div>
  )
}
