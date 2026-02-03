"use client"

import { motion } from "framer-motion"
import type { SlideProps } from "../../types"

export const CoverSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full flex flex-col items-center justify-center bg-white p-12">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="w-24 h-1 bg-accent mx-auto mb-12" />
      <h1 className="text-5xl font-bold text-zinc-900 mb-4 tracking-tight">{title}</h1>
      <p className="text-2xl text-zinc-500 mb-6">{subtitle}</p>
      <p className="text-xl text-accent font-medium mb-16">{content?.tagline}</p>
      <div className="text-sm text-zinc-500 space-y-1">
        <p className="font-medium text-zinc-700">{content?.presenter}</p>
        <p>{content?.date}</p>
      </div>
    </motion.div>
  </div>
)
