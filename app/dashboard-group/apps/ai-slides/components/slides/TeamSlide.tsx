"use client"

import { motion } from "framer-motion"
import { User } from "lucide-react"
import type { SlideProps } from "../../types"

export const TeamSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white p-10 overflow-auto">
    <div className="max-w-5xl mx-auto">
      <p className="text-accent text-xs font-semibold tracking-widest mb-3">TEAM</p>
      <h2 className="text-3xl font-bold text-zinc-900 mb-10">{title}</h2>

      <div className="grid grid-cols-3 gap-8">
        {content?.founders?.map((founder: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div className="w-28 h-28 bg-gradient-to-br from-accent to-accent/70 rounded-full mx-auto mb-5 flex items-center justify-center shadow-lg">
              <User className="w-14 h-14 text-white" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">{founder.name}</h3>
            <p className="text-accent text-sm font-semibold mb-2">{founder.role}</p>
            <p className="text-zinc-500 text-sm">{founder.background}</p>
          </motion.div>
        ))}
      </div>

      {content?.hiringPlan && (
        <div className="mt-10 bg-zinc-50 border border-zinc-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-zinc-700 mb-2">📋 채용 계획</h4>
          <p className="text-sm text-zinc-600">{content.hiringPlan}</p>
        </div>
      )}
    </div>
  </div>
)
