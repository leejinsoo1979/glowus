"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const TractionSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">TRACTION</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title}</h2>

      <div className="grid grid-cols-3 gap-6">
        {content?.metrics?.map((metric: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-6 text-center"
          >
            <p className="text-3xl font-bold text-accent mb-2">{metric.value}</p>
            <p className="text-sm font-semibold text-zinc-700 mb-1">{metric.label}</p>
            {metric.description && (
              <p className="text-xs text-zinc-500">{metric.description}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </div>
)
