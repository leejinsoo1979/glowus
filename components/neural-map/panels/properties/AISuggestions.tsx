'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Check, X, ChevronDown, ChevronUp, Sparkles, Info } from 'lucide-react'
import { PropertyType, propertyTypeLabels } from './types'

export interface RecommendedProperty {
  key: string
  value: unknown
  type: PropertyType
  confidence: number
  reason: string
}

export interface AnalysisResult {
  properties: RecommendedProperty[]
  summary: string
  relatedTopics: string[]
}

interface AISuggestionsProps {
  result: AnalysisResult
  onAccept: (property: RecommendedProperty) => void
  onAcceptAll: () => void
  onDismiss: () => void
  className?: string
}

export function AISuggestions({
  result,
  onAccept,
  onAcceptAll,
  onDismiss,
  className,
}: AISuggestionsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set())

  const handleAccept = (prop: RecommendedProperty) => {
    setAcceptedKeys(prev => new Set(prev).add(prop.key))
    onAccept(prop)
  }

  const pendingProperties = result.properties.filter(p => !acceptedKeys.has(p.key))

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500'
    if (confidence >= 0.8) return 'text-blue-500'
    return 'text-yellow-500'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High'
    if (confidence >= 0.8) return 'Medium'
    return 'Low'
  }

  const formatValue = (value: unknown, type: PropertyType): string => {
    if (value === null || value === undefined) return '-'
    if (Array.isArray(value)) {
      if (type === 'tags') return value.map(v => `#${v}`).join(' ')
      if (type === 'link') return value.map(v => `[[${v}]]`).join(', ')
      return value.join(', ')
    }
    if (type === 'checkbox') return value ? 'Yes' : 'No'
    if (type === 'link' && typeof value === 'string') return `[[${value}]]`
    return String(value)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'border border-blue-200 dark:border-blue-800',
        'bg-blue-50/50 dark:bg-blue-900/20',
        'rounded-lg overflow-hidden',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-100/50 dark:bg-blue-900/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            AI Suggestions
          </span>
          <span className="text-xs text-blue-500">
            ({pendingProperties.length} recommendations)
          </span>
        </div>
        <div className="flex items-center gap-1">
          {pendingProperties.length > 0 && (
            <button
              onClick={onAcceptAll}
              className={cn(
                'px-2 py-1 text-xs rounded',
                'bg-blue-500 text-white',
                'hover:bg-blue-600 transition-colors'
              )}
            >
              Accept All
            </button>
          )}
          <button
            onClick={onDismiss}
            className={cn(
              'p-1 rounded',
              'text-blue-400 hover:text-blue-600',
              'hover:bg-blue-100 dark:hover:bg-blue-800/50'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 요약 */}
      {result.summary && (
        <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-800">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {result.summary}
          </p>
        </div>
      )}

      {/* 추천 Properties */}
      <div className="divide-y divide-blue-200 dark:divide-blue-800">
        {pendingProperties.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-gray-500">
            All suggestions have been applied
          </div>
        ) : (
          pendingProperties.map((prop, index) => (
            <div key={prop.key} className="px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Property 이름과 타입 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {prop.key}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
                      {propertyTypeLabels[prop.type]}
                    </span>
                    <span className={cn('text-xs', getConfidenceColor(prop.confidence))}>
                      {Math.round(prop.confidence * 100)}%
                    </span>
                  </div>

                  {/* 값 미리보기 */}
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {formatValue(prop.value, prop.type)}
                  </div>

                  {/* 이유 (확장 시) */}
                  <AnimatePresence>
                    {expandedIndex === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 p-2 bg-white dark:bg-gray-800 rounded text-xs text-gray-500 dark:text-gray-400"
                      >
                        <div className="flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{prop.reason}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className={cn(
                      'p-1 rounded',
                      'text-gray-400 hover:text-gray-600',
                      'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {expandedIndex === index ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleAccept(prop)}
                    className={cn(
                      'p-1 rounded',
                      'text-green-500 hover:text-green-600',
                      'hover:bg-green-100 dark:hover:bg-green-900/30'
                    )}
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 관련 주제 */}
      {result.relatedTopics && result.relatedTopics.length > 0 && (
        <div className="px-3 py-2 border-t border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10">
          <div className="text-xs text-gray-500 mb-1">Related Topics:</div>
          <div className="flex flex-wrap gap-1">
            {result.relatedTopics.map((topic, i) => (
              <span
                key={i}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  'bg-blue-100 dark:bg-blue-800/50',
                  'text-blue-600 dark:text-blue-300'
                )}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
