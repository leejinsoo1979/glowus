"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const SolutionSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">SOLUTION</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">
        {subtitle?.split(' ').map((word, i) => (
          <span key={i} className={word.includes('AI') || word.includes('자동화') ? 'text-accent' : ''}>
            {word}{' '}
          </span>
        ))}
      </h2>
      <p className="text-zinc-500 mb-12 max-w-3xl">{content?.mainDesc}</p>

      <div className="grid grid-cols-3 gap-8">
        {content?.features?.map((feature: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-accent/10 rounded-2xl mx-auto mb-5 flex items-center justify-center">
              <span className="text-4xl">{feature.icon}</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{feature.title}</h3>
            <p className="text-sm text-zinc-600">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
)
