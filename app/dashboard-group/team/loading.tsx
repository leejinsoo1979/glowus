import { Loader2 } from 'lucide-react'

export default function TeamLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-zinc-400 text-sm">팀 로딩 중...</span>
      </div>
    </div>
  )
}
