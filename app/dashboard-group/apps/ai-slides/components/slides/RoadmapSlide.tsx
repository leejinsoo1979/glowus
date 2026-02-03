"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const RoadmapSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">ROADMAP</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title}</h2>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-accent/20" />

        <div className="space-y-6">
          {content?.timeline?.map((item: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-6 relative"
            >
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white font-bold text-sm z-10 flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl p-5">
                <p className="text-xs text-accent font-semibold mb-1">{item.date}</p>
                <p className="font-bold text-zinc-900">{item.title}</p>
                {item.description && (
                  <p className="text-sm text-zinc-600 mt-1">{item.description}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </div>
)
