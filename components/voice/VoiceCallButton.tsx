'use client'

import { useState } from 'react'
import { Phone } from 'lucide-react'
import { motion } from 'framer-motion'
import VoiceCallPanel from './VoiceCallPanel'

interface VoiceCallButtonProps {
  agentName?: string
  agentAvatar?: string
  systemPrompt?: string
  voice?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function VoiceCallButton({
  agentName = 'AI 어시스턴트',
  agentAvatar,
  systemPrompt,
  voice = 'Kore',
  className = '',
  size = 'md',
}: VoiceCallButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`
          ${sizeClasses[size]}
          flex items-center justify-center
          bg-gradient-to-r from-green-500 to-emerald-600
          hover:from-green-600 hover:to-emerald-700
          text-white rounded-full shadow-lg
          shadow-green-500/30 hover:shadow-green-500/50
          transition-all duration-200
          ${className}
        `}
        aria-label="음성 통화 시작"
      >
        <Phone className={iconSizes[size]} />
      </motion.button>

      <VoiceCallPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        agentName={agentName}
        agentAvatar={agentAvatar}
        systemPrompt={systemPrompt}
        voice={voice}
      />
    </>
  )
}
