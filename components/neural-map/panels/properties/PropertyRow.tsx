'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { GripVertical, Trash2, Copy, Clipboard, Scissors } from 'lucide-react'
import { PropertyInput } from './PropertyInput'
import { PropertyType, propertyTypeLabels } from './types'

interface PropertyRowProps {
  propertyKey: string
  value: unknown
  type: PropertyType
  onChange: (value: unknown) => void
  onDelete: () => void
  onTypeChange: (type: PropertyType) => void
}

export function PropertyRow({
  propertyKey,
  value,
  type,
  onChange,
  onDelete,
  onTypeChange,
}: PropertyRowProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
        setShowTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify({ [propertyKey]: value }))
    setShowMenu(false)
  }

  const handleCut = () => {
    navigator.clipboard.writeText(JSON.stringify({ [propertyKey]: value }))
    onDelete()
    setShowMenu(false)
  }

  return (
    <div className="flex items-center gap-3 group relative min-w-0">
      {/* 타입 변경 버튼 (≡ 아이콘) */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'p-1 rounded',
            'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
          title="Property options"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* 컨텍스트 메뉴 */}
        {showMenu && (
          <div className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'rounded-md shadow-lg',
            'py-1 min-w-[140px]'
          )}>
            {/* Property type 서브메뉴 */}
            <div
              className="relative"
              onMouseEnter={() => setShowTypeMenu(true)}
              onMouseLeave={() => setShowTypeMenu(false)}
            >
              <button
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'flex items-center justify-between'
                )}
              >
                <span>Property type</span>
                <span className="text-gray-400">▶</span>
              </button>

              {/* 타입 선택 서브메뉴 */}
              {showTypeMenu && (
                <div className={cn(
                  'absolute left-full top-0 ml-1',
                  'bg-white dark:bg-gray-800',
                  'border border-gray-200 dark:border-gray-700',
                  'rounded-md shadow-lg',
                  'py-1 min-w-[120px]'
                )}>
                  {(Object.keys(propertyTypeLabels) as PropertyType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onTypeChange(t)
                        setShowMenu(false)
                        setShowTypeMenu(false)
                      }}
                      className={cn(
                        'w-full px-3 py-1.5 text-left text-sm',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        'flex items-center gap-2',
                        type === t && 'text-blue-500'
                      )}
                    >
                      {type === t && <span>✓</span>}
                      <span className={type !== t ? 'ml-4' : ''}>{propertyTypeLabels[t]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Cut */}
            <button
              onClick={handleCut}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'flex items-center gap-2'
              )}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cut</span>
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'flex items-center gap-2'
              )}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Remove */}
            <button
              onClick={() => {
                onDelete()
                setShowMenu(false)
              }}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'text-red-500 flex items-center gap-2'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        )}
      </div>

      {/* Property Key */}
      <div className="w-28 flex-shrink-0">
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate block">
          {propertyKey}
        </span>
      </div>

      {/* Property Value */}
      <div className="flex-1 min-w-[120px]">
        <PropertyInput
          type={type}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
