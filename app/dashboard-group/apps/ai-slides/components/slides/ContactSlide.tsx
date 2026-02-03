"use client"

import type { SlideProps } from "../../types"

export const ContactSlide = ({ content, title, subtitle }: SlideProps) => (
  <div className="h-full bg-white flex flex-col items-center justify-center p-10">
    <div className="w-24 h-1 bg-accent mx-auto mb-8" />
    <h2 className="text-5xl font-bold text-zinc-900 mb-10">Thank You</h2>
    <div className="text-center space-y-3">
      {content?.name && <p className="text-xl text-zinc-800 font-medium">{content.name} | {content.title}</p>}
      <div className="flex items-center justify-center gap-6 mt-6 text-zinc-600">
        {content?.email && <span className="flex items-center gap-2">📧 {content.email}</span>}
        {content?.phone && <span className="flex items-center gap-2">📞 {content.phone}</span>}
      </div>
      {content?.website && <p className="text-accent font-medium mt-4">🌐 {content.website}</p>}
    </div>
  </div>
)
