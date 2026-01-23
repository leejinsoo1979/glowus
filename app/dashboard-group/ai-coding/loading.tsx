import { Loader2 } from 'lucide-react'

export default function AICodingLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-zinc-900">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-zinc-400 text-sm">AI 코딩 로딩 중...</span>
      </div>
    </div>
  )
}
