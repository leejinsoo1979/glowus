'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  collapsed?: boolean
  href?: string
  className?: string
  animated?: boolean
}

const sizeConfig = {
  sm: {
    text: 'text-lg',
  },
  md: {
    text: 'text-xl',
  },
  lg: {
    text: 'text-2xl',
  },
  xl: {
    text: 'text-3xl',
  },
}

export function Logo({
  size = 'md',
  collapsed = false,
  href = '/dashboard-group',
  className,
  animated = true,
}: LogoProps) {
  const config = sizeConfig[size]
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const logoContent = (
    <motion.div
      className={cn('flex items-baseline', className)}
      whileHover={animated ? { scale: 1.02 } : undefined}
      whileTap={animated ? { scale: 0.98 } : undefined}
    >
      {collapsed ? (
        <span className={cn('font-black tracking-tight text-accent', config.text)}>
          G
        </span>
      ) : (
        <>
          <span className={cn('font-black tracking-tight text-accent', config.text)}>
            Glow
          </span>
          <span className={cn('font-black tracking-tight', isDark ? 'text-zinc-100' : 'text-zinc-900', config.text)}>
            US
          </span>
        </>
      )}
    </motion.div>
  )

  if (href) {
    return <Link href={href}>{logoContent}</Link>
  }

  return logoContent
}

// Minimal version for small spaces
export function LogoMini({ className }: { className?: string }) {
  return (
    <motion.span
      className={cn('font-black tracking-tight text-accent text-xl', className)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      G
    </motion.span>
  )
}

// Wordmark only version
export function LogoWordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const textSize = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  return (
    <div className={cn('flex items-baseline', className)}>
      <span className={cn('font-black tracking-tight text-accent', textSize[size])}>
        Glow
      </span>
      <span className={cn('font-black tracking-tight', isDark ? 'text-zinc-100' : 'text-zinc-900', textSize[size])}>
        US
      </span>
    </div>
  )
}
