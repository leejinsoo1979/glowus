"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { SlideProps } from "../../types"

export const MarketSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">MARKET OPPORTUNITY</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title} <span className="text-zinc-500 font-normal">{subtitle}</span></h2>

      <div className="flex items-end justify-center gap-10 mb-10">
        {[
          { ...content?.tam, color: 'bg-blue-500', height: 'h-56' },
          { ...content?.sam, color: 'bg-emerald-500', height: 'h-40' },
          { ...content?.som, color: 'bg-accent', height: 'h-28' }
        ].map((market, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: i * 0.2 }}
            className="text-center origin-bottom"
          >
            <div className={cn("w-36 rounded-t-2xl shadow-lg", market.height, market.color, "flex items-center justify-center")}>
              <span className="text-2xl font-bold text-white">{market.value}</span>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-b-2xl w-36">
              <p className="text-xs font-semibold text-zinc-700">{market.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{market.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2 rounded-full text-sm font-semibold">
          📈 {content?.cagr}
        </span>
      </div>
    </div>
  </div>
)
