"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const InvestmentSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">INVESTMENT</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title}</h2>

      <div className="grid grid-cols-3 gap-8 mb-10">
        {[
          { label: '라운드', value: content?.round },
          { label: '투자금액', value: content?.amount },
          { label: '밸류에이션', value: content?.valuation }
        ].filter(d => d.value).map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-8 text-center"
          >
            <p className="text-xs text-zinc-500 font-semibold uppercase mb-3">{item.label}</p>
            <p className="text-3xl font-bold text-accent">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {content?.progress && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-zinc-700 mb-2">진행 현황</h4>
          <p className="text-sm text-zinc-600">{content.progress}</p>
        </div>
      )}
    </div>
  </div>
)
