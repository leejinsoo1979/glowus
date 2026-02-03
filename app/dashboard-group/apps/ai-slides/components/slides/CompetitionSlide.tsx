"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import type { SlideProps } from "../../types"

export const CompetitionSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">COMPETITION</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      {subtitle && <p className="text-zinc-500 mb-8">{subtitle}</p>}

      {content?.points && (
        <div className="space-y-4">
          {content.points.map((point: string, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl p-4"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-zinc-800 font-medium">{point}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  </div>
)
