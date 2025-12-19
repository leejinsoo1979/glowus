'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

/**
 * 새 세션 생성 페이지
 *
 * UUID를 생성하고 해당 세션룸으로 리다이렉트합니다.
 */
export default function NewSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'meeting'

  useEffect(() => {
    // 새 세션 ID 생성
    const sessionId = uuidv4()

    // 세션룸으로 리다이렉트
    router.replace(`/dashboard-group/messenger/session/${sessionId}?mode=${mode}`)
  }, [router, mode])

  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-neutral-600 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-400 text-sm">세션을 생성하는 중...</p>
      </div>
    </div>
  )
}
