"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SlideProps } from "../../types"

export const BusinessModelSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">BUSINESS MODEL</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      <p className="text-zinc-500 mb-10">{content?.model}</p>

      <div className="grid grid-cols-3 gap-6 mb-10">
        {content?.pricing?.map((tier: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-6 rounded-2xl border-2",
              i === 1 ? "bg-accent/5 border-accent shadow-lg" : "bg-zinc-50 border-zinc-200"
            )}
          >
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{tier.tier}</h3>
            <p className="text-2xl font-bold text-accent mb-4">{tier.price}</p>
            <ul className="space-y-2">
              {tier.features?.map((f: string, j: number) => (
                <li key={j} className="text-sm text-zinc-600 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {Object.entries(content?.metrics || {}).map(([key, value], i) => (
          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">{key}</p>
            <p className="text-2xl font-bold text-zinc-900">{value as string}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)
