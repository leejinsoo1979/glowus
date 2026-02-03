"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import type { SlideProps } from "../../types"

export const ProductSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">PRODUCT</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      {subtitle && <p className="text-zinc-500 mb-8">{subtitle}</p>}

      <div className="grid grid-cols-2 gap-6">
        {content?.items?.map((item: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-50 border border-zinc-200 rounded-xl p-6"
          >
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">{item.icon || '🚀'}</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{item.title}</h3>
            <p className="text-sm text-zinc-600">{item.description}</p>
          </motion.div>
        ))}
      </div>

      {content?.points && (
        <ul className="mt-6 space-y-3">
          {content.points.map((point: string, i: number) => (
            <li key={i} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <span className="text-zinc-700">{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
)
