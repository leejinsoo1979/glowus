'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  Palette,
  Sun,
  Moon,
  Check,
} from 'lucide-react'

type ThemeMode = 'light' | 'dark'

const themeModes: { id: ThemeMode; name: string; icon: typeof Sun }[] = [
  { id: 'light', name: '라이트', icon: Sun },
  { id: 'dark', name: '다크', icon: Moon },
]

export function ThemeDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const { accentColor, setAccentColor } = useThemeStore()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
        <Palette className="w-5 h-5" />
      </button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-colors ${
          isDark
            ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="테마 설정"
      >
        <Palette className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Dropdown */}
            <motion.div
              className={`absolute right-0 mt-2 w-72 backdrop-blur-xl rounded-2xl shadow-2xl py-3 z-50 overflow-hidden ${
                isDark
                  ? 'bg-zinc-900/95 border border-zinc-700/50'
                  : 'bg-white/95 border border-zinc-200'
              }`}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {/* Theme Mode Section */}
              <div className={`px-4 pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  테마 모드
                </h3>
                <div className="flex gap-2">
                  {themeModes.map((themeMode) => {
                    const Icon = themeMode.icon
                    const isActive = theme === themeMode.id
                    return (
                      <button
                        key={themeMode.id}
                        onClick={() => {
                          setTheme(themeMode.id)
                          setIsOpen(false)
                        }}
                        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all border ${
                          isActive
                            ? 'bg-accent/20 text-accent border-accent/30'
                            : isDark
                              ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border-transparent'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border-transparent'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{themeMode.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Accent Color Section */}
              <div className="px-4 pt-3">
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  강조 색상
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {accentColors.map((color) => {
                    const isActive = accentColor === color.id
                    return (
                      <button
                        key={color.id}
                        onClick={() => {
                          setAccentColor(color.id)
                          setIsOpen(false)
                        }}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                          isActive
                            ? isDark
                              ? 'bg-zinc-800 ring-2 ring-offset-2 ring-offset-zinc-900'
                              : 'bg-zinc-100 ring-2 ring-offset-2 ring-offset-white'
                            : isDark
                              ? 'hover:bg-zinc-800/50'
                              : 'hover:bg-zinc-100'
                        }`}
                        style={
                          isActive ? { ['--tw-ring-color' as string]: color.color } : undefined
                        }
                        title={color.name}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                          style={{ backgroundColor: color.color }}
                        >
                          {isActive && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {color.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className={`px-4 pt-4 mt-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>미리보기</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-16 h-2 rounded-full"
                      style={{
                        backgroundColor: accentColors.find((c) => c.id === accentColor)?.color,
                      }}
                    />
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: accentColors.find((c) => c.id === accentColor)?.color,
                      }}
                    >
                      Primary
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
