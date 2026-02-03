'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

// 앱 페이지 공통 로딩 fallback
function AppLoadingFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-zinc-400 text-sm">로딩 중...</p>
      </div>
    </div>
  )
}

export default function AppsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<AppLoadingFallback />}>
      {children}
    </Suspense>
  )
}
