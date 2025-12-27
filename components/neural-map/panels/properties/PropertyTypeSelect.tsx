'use client'

import { useRef, useEffect, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { PropertyType, propertyTypeLabels, getDefaultValue } from './types'

interface PropertyTypeSelectProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: PropertyType) => void
  propertyKey: string
  onKeyChange: (key: string) => void
}

const typeIcons: Record<PropertyType, string> = {
  text: 'Aa',
  number: '#',
  checkbox: '[]',
  date: 'D',
  datetime: 'DT',
  tags: '#',
  list: '-',
  link: '[[',
  select: 'v',
}

export function PropertyTypeSelect({
  isOpen,
  onClose,
  onSelect,
  propertyKey,
  onKeyChange,
}: PropertyTypeSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSelect = (type: PropertyType) => {
    // 바로 적용 - property name 없어도 OK (자동 생성됨)
    onSelect(type)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 백드롭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* 모달 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
              'bg-white dark:bg-gray-800',
              'border border-gray-200 dark:border-gray-700',
              'rounded-lg shadow-xl',
              'w-[280px]'
            )}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Add property
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Property name 입력 */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={propertyKey}
                onChange={(e) => onKeyChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Property name"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded',
                  'bg-gray-50 dark:bg-gray-900',
                  'border border-gray-200 dark:border-gray-700',
                  'focus:border-blue-500 focus:outline-none',
                  'text-gray-800 dark:text-gray-200',
                  'placeholder:text-gray-400'
                )}
              />
            </div>

            {/* 타입 선택 */}
            <div className="p-2 max-h-[300px] overflow-y-auto">
              <div className="text-xs text-gray-400 px-2 py-1">Select type</div>
              {(Object.keys(propertyTypeLabels) as PropertyType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleSelect(type)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm rounded',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'flex items-center gap-3',
                    'text-gray-700 dark:text-gray-300'
                  )}
                >
                  <span className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-xs',
                    'bg-gray-100 dark:bg-gray-700',
                    'text-gray-500 dark:text-gray-400',
                    'font-mono'
                  )}>
                    {typeIcons[type]}
                  </span>
                  <span>{propertyTypeLabels[type]}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
