"use client"

import { Check } from "lucide-react"
import type { SlideProps } from "../../types"

interface DefaultSlideProps extends SlideProps {
  type: string
}

export const DefaultSlide = ({ content, title, subtitle, type }: DefaultSlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">{type.toUpperCase().replace('-', ' ')}</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      {subtitle && <p className="text-zinc-500 mb-8">{subtitle}</p>}

      {/* 새 콘텐츠 구조 지원 */}
      {content?.points && (
        <ul className="space-y-3 mb-6">
          {content.points.map((point: string, i: number) => (
            <li key={i} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <span className="text-zinc-700">{point}</span>
            </li>
          ))}
        </ul>
      )}

      {content?.items && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {content.items.map((item: any, i: number) => (
            <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
              <h3 className="font-bold text-zinc-900 mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-600">{item.description}</p>
            </div>
          ))}
        </div>
      )}

      {content?.metrics && (
        <div className="grid grid-cols-3 gap-4">
          {content.metrics.map((metric: any, i: number) => (
            <div key={i} className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent">{metric.value}</p>
              <p className="text-xs text-zinc-600">{metric.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)
