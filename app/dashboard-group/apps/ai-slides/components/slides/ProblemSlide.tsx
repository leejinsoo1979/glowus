"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { SlideProps } from "../../types"

export const ProblemSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">PROBLEM</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h2>
      <p className="text-zinc-500 mb-10">{subtitle}</p>

      <div className="grid grid-cols-3 gap-6 mb-10">
        {content?.issues?.map((issue: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-6 rounded-xl border-2",
              i === 0 ? "bg-red-50 border-red-200" :
              i === 1 ? "bg-orange-50 border-orange-200" :
              "bg-purple-50 border-purple-200"
            )}
          >
            <div className="text-3xl mb-4">{issue.icon}</div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{issue.title}</h3>
            <p className="text-sm text-zinc-600">{issue.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
            <span className="text-xl font-bold">PRO</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-1">TARGET CUSTOMER</p>
            <p className="text-sm text-zinc-800 font-medium">{content?.targetCustomer}</p>
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <span className="text-xl">📈</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-1">MARKET OPPORTUNITY</p>
            <p className="text-sm text-zinc-800 font-medium">{content?.opportunity}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)
