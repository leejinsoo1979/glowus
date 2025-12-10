'use client'

import { useEffect, useState } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useThemeStore, accentColors } from '@/stores/themeStore'

function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply accent color CSS variables
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const selectedAccent = accentColors.find((c) => c.id === accentColor)
    if (selectedAccent) {
      root.style.setProperty('--accent-color', selectedAccent.color)
      root.style.setProperty('--accent-color-hover', selectedAccent.hoverColor)
      root.style.setProperty('--accent-color-rgb', selectedAccent.rgb)
    }
  }, [accentColor, mounted])

  return <>{children}</>
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AccentColorProvider>
        {children}
      </AccentColorProvider>
    </NextThemesProvider>
  )
}
