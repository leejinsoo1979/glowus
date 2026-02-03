"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const FinancialsSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">FINANCIALS</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title}</h2>

      <div className="grid grid-cols-4 gap-4">
        {content?.metrics?.map((metric: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-center"
          >
            <p className="text-xs text-zinc-500 mb-2">{metric.label}</p>
            <p className="text-2xl font-bold text-accent">{metric.value}</p>
            {metric.description && (
              <p className="text-xs text-zinc-500 mt-1">{metric.description}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </div>
)
