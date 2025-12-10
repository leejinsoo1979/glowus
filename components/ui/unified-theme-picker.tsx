'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react'

export function UnifiedThemePicker() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { accentColor, setAccentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply accent color on mount and change
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
    )
  }

  const currentColor = accentColors.find((c) => c.id === accentColor)

  const themeModes = [
    { id: 'light', name: '라이트', icon: Sun },
    { id: 'dark', name: '다크', icon: Moon },
    { id: 'system', name: '시스템', icon: Monitor },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="테마 설정"
      >
        {/* Color indicator dot */}
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-800"
          style={{ backgroundColor: currentColor?.color }}
        />
        <Palette className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700/50 py-3 z-50 overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* Theme Mode Section */}
            <div className="px-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                테마 모드
              </h3>
              <div className="flex gap-1.5">
                {themeModes.map((mode) => {
                  const Icon = mode.icon
                  const isActive = theme === mode.id
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setTheme(mode.id)
                        setIsOpen(false)
                      }}
                      className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        isActive
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-gray-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-100 border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{mode.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Accent Color Section */}
            <div className="px-4 pt-3">
              <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                강조 색상
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {accentColors.map((color) => {
                  const isActive = accentColor === color.id
                  return (
                    <motion.button
                      key={color.id}
                      onClick={() => {
                        setAccentColor(color.id)
                        setIsOpen(false)
                      }}
                      className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-gray-100 dark:bg-zinc-800 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                      }`}
                      style={
                        isActive ? { ['--tw-ring-color' as string]: color.color } : undefined
                      }
                      whileTap={{ scale: 0.95 }}
                      title={color.name}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105"
                        style={{ backgroundColor: color.color }}
                      >
                        {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-[9px] text-zinc-500 dark:text-zinc-500 font-medium">
                        {color.name}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Preview Bar */}
            <div className="px-4 pt-3 mt-2 border-t border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">미리보기</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-1.5 rounded-full"
                    style={{ backgroundColor: currentColor?.color }}
                  />
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: currentColor?.color }}
                  >
                    Accent
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
