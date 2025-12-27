'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Plus, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'
import { PropertyRow } from './PropertyRow'
import { PropertyTypeSelect } from './PropertyTypeSelect'
import { AISuggestions, RecommendedProperty, AnalysisResult } from './AISuggestions'
import {
  PropertyType,
  detectPropertyType,
  getDefaultValue,
  propertyTypeLabels
} from './types'
import matter from 'gray-matter'

interface PropertiesPanelProps {
  content: string // 전체 마크다운 내용 (frontmatter 포함)
  onUpdate: (newContent: string) => void
  className?: string
}

export function PropertiesPanel({
  content,
  onUpdate,
  className,
}: PropertiesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [properties, setProperties] = useState<Record<string, unknown>>({})
  const [bodyContent, setBodyContent] = useState('')
  const [showTypeSelect, setShowTypeSelect] = useState(false)
  const [newPropertyKey, setNewPropertyKey] = useState('')

  // AI 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // content에서 frontmatter 파싱
  useEffect(() => {
    try {
      const parsed = matter(content)
      setProperties(parsed.data || {})
      setBodyContent(parsed.content)
    } catch (e) {
      // 파싱 실패 시 빈 properties
      setProperties({})
      setBodyContent(content)
    }
  }, [content])

  // properties 변경 시 content 업데이트
  const updateProperties = useCallback((newProps: Record<string, unknown>) => {
    setProperties(newProps)
    // gray-matter로 다시 직렬화
    const newContent = matter.stringify(bodyContent, newProps)
    onUpdate(newContent)
  }, [bodyContent, onUpdate])

  // 단일 property 업데이트
  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    updateProperties({
      ...properties,
      [key]: value
    })
  }, [properties, updateProperties])

  // property 삭제
  const handlePropertyDelete = useCallback((key: string) => {
    const newProps = { ...properties }
    delete newProps[key]
    updateProperties(newProps)
  }, [properties, updateProperties])

  // property 타입 변경
  const handleTypeChange = useCallback((key: string, newType: PropertyType) => {
    const newValue = getDefaultValue(newType)
    updateProperties({
      ...properties,
      [key]: newValue
    })
  }, [properties, updateProperties])

  // 새 property 추가
  const handleAddProperty = useCallback((type: PropertyType) => {
    // 이름이 없으면 타입 이름으로 자동 생성
    let key = newPropertyKey.trim()
    if (!key) {
      // 타입 이름 사용: text, number, checkbox, ...
      // 이미 존재하면 text2, text3, ... 형태로
      if (properties[type] === undefined) {
        key = type
      } else {
        let counter = 2
        while (properties[`${type}${counter}`] !== undefined) {
          counter++
        }
        key = `${type}${counter}`
      }
    }

    if (properties[key] !== undefined) {
      alert('이미 존재하는 키입니다')
      return
    }
    updateProperties({
      ...properties,
      [key]: getDefaultValue(type)
    })
    setNewPropertyKey('')
    setShowTypeSelect(false)
  }, [newPropertyKey, properties, updateProperties])

  // AI 분석 실행
  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing) return

    // 본문이 너무 짧으면 분석 불가
    if (bodyContent.trim().length < 50) {
      setAnalysisError('Content too short for analysis (min 50 characters)')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)
    setAnalysisResult(null)

    try {
      const response = await fetch('/api/neural-map/analyze-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: bodyContent,
          existingProperties: properties
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      if (data.success && data.data) {
        setAnalysisResult(data.data)
      } else {
        throw new Error('Invalid response')
      }
    } catch (error) {
      console.error('AI analysis error:', error)
      setAnalysisError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [bodyContent, properties, isAnalyzing])

  // AI 추천 수락
  const handleAcceptSuggestion = useCallback((prop: RecommendedProperty) => {
    updateProperties({
      ...properties,
      [prop.key]: prop.value
    })
  }, [properties, updateProperties])

  // 모든 AI 추천 수락
  const handleAcceptAllSuggestions = useCallback(() => {
    if (!analysisResult) return

    const newProps = { ...properties }
    for (const prop of analysisResult.properties) {
      if (!(prop.key in newProps)) {
        newProps[prop.key] = prop.value
      }
    }
    updateProperties(newProps)
    setAnalysisResult(null)
  }, [analysisResult, properties, updateProperties])

  // AI 추천 닫기
  const handleDismissSuggestions = useCallback(() => {
    setAnalysisResult(null)
    setAnalysisError(null)
  }, [])

  const propertyEntries = Object.entries(properties)

  return (
    <div className={cn(
      'border-b border-gray-200 dark:border-gray-700',
      className
    )}>
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Properties
          </span>
          {propertyEntries.length > 0 && (
            <span className="text-xs text-gray-400">
              ({propertyEntries.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* AI 분석 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleAnalyze()
            }}
            disabled={isAnalyzing}
            className={cn(
              'p-1.5 rounded text-xs flex items-center gap-1',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'text-gray-600 dark:text-gray-400',
              isAnalyzing && 'opacity-50 cursor-not-allowed'
            )}
            title="AI 분석"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>AI</span>
          </button>
          {/* 추가 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowTypeSelect(true)
            }}
            className={cn(
              'p-1.5 rounded',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'text-gray-600 dark:text-gray-400'
            )}
            title="Add property"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Properties 목록 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* AI 분석 에러 */}
              {analysisError && (
                <div className="p-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded">
                  {analysisError}
                </div>
              )}

              {/* AI 추천 결과 */}
              {analysisResult && (
                <AISuggestions
                  result={analysisResult}
                  onAccept={handleAcceptSuggestion}
                  onAcceptAll={handleAcceptAllSuggestions}
                  onDismiss={handleDismissSuggestions}
                />
              )}

              {/* 기존 Properties */}
              {propertyEntries.length === 0 && !analysisResult ? (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
                  No properties. Click + to add or AI to analyze.
                </div>
              ) : (
                <div className="space-y-1">
                  {propertyEntries.map(([key, value]) => (
                    <PropertyRow
                      key={key}
                      propertyKey={key}
                      value={value}
                      type={detectPropertyType(value)}
                      onChange={(newValue) => handlePropertyChange(key, newValue)}
                      onDelete={() => handlePropertyDelete(key)}
                      onTypeChange={(newType) => handleTypeChange(key, newType)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 타입 선택 모달 */}
      <PropertyTypeSelect
        isOpen={showTypeSelect}
        onClose={() => {
          setShowTypeSelect(false)
          setNewPropertyKey('')
        }}
        onSelect={handleAddProperty}
        propertyKey={newPropertyKey}
        onKeyChange={setNewPropertyKey}
      />
    </div>
  )
}
