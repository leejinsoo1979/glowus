import { Loader2 } from 'lucide-react'

export default function NeuronsLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-[#050510]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <span className="text-zinc-400 text-sm">뉴런 맵 로딩 중...</span>
      </div>
    </div>
  )
}
