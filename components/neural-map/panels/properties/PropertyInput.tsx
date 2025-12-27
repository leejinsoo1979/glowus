'use client'

import { useState, useCallback, useRef, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { X, Plus, Calendar } from 'lucide-react'
import { PropertyType } from './types'
import { LinkAutocomplete } from './LinkAutocomplete'

interface PropertyInputProps {
  type: PropertyType
  value: unknown
  onChange: (value: unknown) => void
}

export function PropertyInput({ type, value, onChange }: PropertyInputProps) {
  switch (type) {
    case 'text':
      return <TextInput value={value as string} onChange={onChange} />
    case 'number':
      return <NumberInput value={value as number} onChange={onChange} />
    case 'checkbox':
      return <CheckboxInput value={value as boolean} onChange={onChange} />
    case 'date':
      return <DateInput value={value as string} onChange={onChange} />
    case 'datetime':
      return <DateTimeInput value={value as string} onChange={onChange} />
    case 'tags':
      return <TagsInput value={value as string[]} onChange={onChange} />
    case 'list':
      return <ListInput value={value as string[]} onChange={onChange} />
    case 'link':
      return <LinkInput value={value} onChange={onChange} />
    case 'select':
      return <TextInput value={value as string} onChange={onChange} />
    default:
      return <TextInput value={String(value ?? '')} onChange={onChange} />
  }
}

// Text 입력
function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full px-2 py-1 text-sm rounded',
        'bg-transparent border border-transparent',
        'hover:border-gray-300 dark:hover:border-gray-600',
        'focus:border-blue-500 focus:outline-none',
        'text-gray-800 dark:text-gray-200'
      )}
      placeholder="Empty"
    />
  )
}

// Number 입력
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'w-full px-2 py-1 text-sm rounded',
        'bg-transparent border border-transparent',
        'hover:border-gray-300 dark:hover:border-gray-600',
        'focus:border-blue-500 focus:outline-none',
        'text-gray-800 dark:text-gray-200'
      )}
    />
  )
}

// Checkbox 입력
function CheckboxInput({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center',
        value
          ? 'bg-blue-500 border-blue-500 text-white'
          : 'border-gray-300 dark:border-gray-600'
      )}
    >
      {value && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

// Date 입력
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Calendar className="w-3.5 h-3.5 text-gray-400" />
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'flex-1 px-2 py-1 text-sm rounded',
          'bg-transparent border border-transparent',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'focus:border-blue-500 focus:outline-none',
          'text-gray-800 dark:text-gray-200'
        )}
      />
    </div>
  )
}

// DateTime 입력
function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Calendar className="w-3.5 h-3.5 text-gray-400" />
      <input
        type="datetime-local"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'flex-1 px-2 py-1 text-sm rounded',
          'bg-transparent border border-transparent',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'focus:border-blue-500 focus:outline-none',
          'text-gray-800 dark:text-gray-200'
        )}
      />
    </div>
  )
}

// Tags 입력 (배열)
function TagsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputValue, setInputValue] = useState('')
  const tags = Array.isArray(value) ? value : []

  const addTag = useCallback(() => {
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      onChange([...tags, inputValue.trim()])
      setInputValue('')
    }
  }, [inputValue, tags, onChange])

  const removeTag = useCallback((index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }, [tags, onChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag, index) => (
        <span
          key={index}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          )}
        >
          {tag}
          <button
            onClick={() => removeTag(index)}
            className="hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder="Add..."
        className={cn(
          'flex-1 min-w-[60px] px-1 py-0.5 text-xs rounded',
          'bg-transparent border-none outline-none',
          'text-gray-800 dark:text-gray-200',
          'placeholder:text-gray-400'
        )}
      />
    </div>
  )
}

// List 입력 (배열)
function ListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputValue, setInputValue] = useState('')
  const items = Array.isArray(value) ? value : []

  const addItem = useCallback(() => {
    if (inputValue.trim()) {
      onChange([...items, inputValue.trim()])
      setInputValue('')
    }
  }, [inputValue, items, onChange])

  const removeItem = useCallback((index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }, [items, onChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
  }

  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <span className="text-xs text-gray-400">-</span>
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item}</span>
          <button
            onClick={() => removeItem(index)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Plus className="w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addItem}
          placeholder="Add item..."
          className={cn(
            'flex-1 px-1 py-0.5 text-sm rounded',
            'bg-transparent border-none outline-none',
            'text-gray-800 dark:text-gray-200',
            'placeholder:text-gray-400'
          )}
        />
      </div>
    </div>
  )
}

// Link 입력 ([[문서]] 형태) - 자동완성 포함
function LinkInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  // [[]] 빈 마커는 필터링
  const rawLinks = Array.isArray(value) ? value : (value ? [value] : [])
  const links = rawLinks.filter(l => l !== '[[]]' && l !== '')
  const [inputValue, setInputValue] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const addLink = useCallback((linkName?: string) => {
    const name = linkName || inputValue.trim()
    if (name) {
      // [[]] 형태로 감싸기
      const link = `[[${name}]]`
      const newLinks = [...links, link]
      onChange(newLinks.length === 1 ? newLinks[0] : newLinks)
      setInputValue('')
      setShowAutocomplete(false)
    }
  }, [inputValue, links, onChange])

  const removeLink = useCallback((index: number) => {
    const newLinks = links.filter((_, i) => i !== index)
    // 모두 삭제되면 [[]] 마커 유지 (link 타입 보존)
    onChange(newLinks.length === 1 ? newLinks[0] : (newLinks.length === 0 ? '[[]]' : newLinks))
  }, [links, onChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 자동완성이 열려있으면 LinkAutocomplete에서 전역으로 처리
    if (showAutocomplete) return

    if (e.key === 'Enter') {
      e.preventDefault()
      addLink()
    }
  }

  const handleSelect = useCallback((fileName: string) => {
    addLink(fileName)
    inputRef.current?.focus()
  }, [addLink])

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {links.map((link, index) => (
        <div key={index} className="flex items-center gap-1">
          <span className={cn(
            'text-sm text-purple-600 dark:text-purple-400',
            'hover:underline cursor-pointer'
          )}>
            {String(link)}
          </span>
          <button
            onClick={() => removeLink(index)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1 relative">
        <span className="text-xs text-gray-400">[[</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowAutocomplete(true)
          }}
          onFocus={() => setShowAutocomplete(true)}
          onKeyDown={handleKeyDown}
          placeholder="Link to..."
          className={cn(
            'flex-1 px-1 py-0.5 text-sm rounded',
            'bg-transparent border-none outline-none',
            'text-purple-600 dark:text-purple-400',
            'placeholder:text-gray-400'
          )}
        />
        <span className="text-xs text-gray-400">]]</span>
      </div>

      {/* 자동완성 모달 */}
      <LinkAutocomplete
        isOpen={showAutocomplete}
        onClose={() => setShowAutocomplete(false)}
        onSelect={handleSelect}
        searchQuery={inputValue}
      />
    </div>
  )
}
