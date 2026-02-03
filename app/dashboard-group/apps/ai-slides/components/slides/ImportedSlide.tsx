"use client"

import { cn } from "@/lib/utils"
import type { SlideProps } from "../../types"

export const ImportedSlide = ({
  content,
  title,
  subtitle,
  images,
  backgroundColor
}: SlideProps) => (
  <div
    className="h-full p-10 overflow-auto"
    style={{ backgroundColor: backgroundColor || '#FFFFFF' }}
  >
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      {subtitle && <p className="text-zinc-500 mb-8">{subtitle}</p>}

      {/* Images Grid */}
      {images && images.length > 0 && (
        <div className={cn(
          "mb-8",
          images.length === 1 ? "flex justify-center" : "grid gap-6",
          images.length === 2 && "grid-cols-2",
          images.length >= 3 && "grid-cols-2 md:grid-cols-3"
        )}>
          {images.map((img) => (
            <div
              key={img.id}
              className="relative rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-sm"
            >
              <img
                src={img.dataUrl}
                alt=""
                className="w-full h-auto max-h-[400px] object-contain"
              />
            </div>
          ))}
        </div>
      )}

      {/* Text Content */}
      {content?.points && content.points.length > 0 && (
        <div className="space-y-3">
          {content.points.map((point: string, i: number) => (
            <p key={i} className="text-zinc-700 text-lg">
              • {point}
            </p>
          ))}
        </div>
      )}
    </div>
  </div>
)
