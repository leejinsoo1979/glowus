'use client'

import { CheckCircle, Eye, XCircle, Minus } from 'lucide-react'

interface MatchScoreBadgeProps {
  score?: number | null
  action?: 'apply' | 'watch' | 'skip' | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function MatchScoreBadge({
  score,
  action,
  size = 'md',
  showLabel = false
}: MatchScoreBadgeProps) {
  // 점수가 없으면 표시 안함
  if (score === null || score === undefined) {
    return null
  }

  // 크기별 스타일
  const sizeStyles = {
    sm: {
      container: 'px-1.5 py-0.5 text-xs',
      icon: 'w-3 h-3'
    },
    md: {
      container: 'px-2 py-1 text-sm',
      icon: 'w-4 h-4'
    },
    lg: {
      container: 'px-3 py-1.5 text-base',
      icon: 'w-5 h-5'
    }
  }

  // 점수별 스타일 - 다크 테마에 어울리는 색상
  const getStyle = () => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/40',
        text: 'text-emerald-400',
        icon: <CheckCircle className={sizeStyles[size].icon} />,
        label: '적극 추천'
      }
    }
    if (score >= 60) {
      return {
        bg: 'bg-sky-500/20',
        border: 'border-sky-500/40',
        text: 'text-sky-400',
        icon: <Eye className={sizeStyles[size].icon} />,
        label: '검토 권장'
      }
    }
    if (score >= 40) {
      return {
        bg: 'bg-slate-500/20',
        border: 'border-slate-500/40',
        text: 'text-slate-400',
        icon: <Minus className={sizeStyles[size].icon} />,
        label: '보통'
      }
    }
    return {
      bg: 'bg-zinc-600/20',
      border: 'border-zinc-600/40',
      text: 'text-zinc-500',
      icon: <XCircle className={sizeStyles[size].icon} />,
      label: '비권장'
    }
  }

  const style = getStyle()

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full
        ${style.bg} ${style.border} ${style.text}
        ${sizeStyles[size].container}
        border font-medium
      `}
      title={`적합도: ${score}점 - ${style.label}`}
    >
      {style.icon}
      <span>{score}</span>
      {showLabel && (
        <span className="ml-1 opacity-80">{style.label}</span>
      )}
    </div>
  )
}

export default MatchScoreBadge
