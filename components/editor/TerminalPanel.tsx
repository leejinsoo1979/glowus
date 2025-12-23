"use client"

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Terminal as TerminalIcon, X, ChevronDown, Plus, Trash2, Maximize2, Minimize2, SplitSquareHorizontal } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { TerminalInstance } from '@/lib/neural-map/types'

// xterm을 동적으로 import (SSR 비활성화) - 로딩 상태 없이 즉시 렌더링
const XTermComponent = dynamic(() => import('./XTermWrapper'), {
  ssr: false,
  loading: () => null  // 로딩 중에는 아무것도 표시하지 않음 (애니메이션 방지)
})

// TerminalInstance imported from types

interface TerminalPanelProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onExecute?: (command: string) => Promise<string>
  height?: number
  onHeightChange?: (height: number) => void
  className?: string
}

export interface TerminalPanelRef {
  write: (text: string, terminalId?: string) => void
}

export const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>(({
  isOpen,
  onToggle,
  onClose,
  onExecute,
  height = 250,
  onHeightChange,
  className = '',
}, ref) => {
  // 기본 셸 이름 (macOS: zsh, Linux: bash, Windows: powershell)
  const getDefaultShell = () => {
    if (typeof window !== 'undefined') {
      const platform = navigator.platform.toLowerCase()
      if (platform.includes('mac')) return 'zsh'
      if (platform.includes('win')) return 'pwsh'
      return 'bash'
    }
    return 'zsh'
  }

  // Global Store Access
  const terminals = useNeuralMapStore(s => s.terminals)
  const activeTerminalId = useNeuralMapStore(s => s.activeTerminalId)
  const activeGroupId = useNeuralMapStore(s => s.activeGroupId)

  const addTerminalAction = useNeuralMapStore(s => s.addTerminal)
  const removeTerminalAction = useNeuralMapStore(s => s.removeTerminal)
  const splitTerminalAction = useNeuralMapStore(s => s.splitTerminal)
  const setActiveTerminal = useNeuralMapStore(s => s.setActiveTerminal)
  const updateTerminal = useNeuralMapStore(s => s.updateTerminal)
  const setTerminals = useNeuralMapStore(s => s.setTerminals)

  // Track if initialization has been done
  const isInitializedRef = useRef(false)

  // Initialize defaults if empty (runs once)
  useEffect(() => {
    if (isInitializedRef.current) return
    if (terminals.length === 0) {
      const initialId = '1'
      const initialGroupId = '1'
      setTerminals([
        { id: initialId, name: 'Terminal', shell: getDefaultShell(), cwd: '', groupId: initialGroupId },
      ])
      setActiveTerminal(initialId)
    }
    isInitializedRef.current = true
  }, [terminals.length, setTerminals, setActiveTerminal])

  // Local derived state aliases for compatibility
  const activeTerminal = activeTerminalId || (terminals[0]?.id ?? '1')


  // Expose write method (RESTORATION)
  useImperativeHandle(ref, () => ({
    write: (text: string, terminalId?: string) => {
      const targetId = terminalId || activeTerminal
      window.dispatchEvent(new CustomEvent('terminal-write', {
        detail: { id: targetId, text }
      }))
    }
  }))
  const [isResizing, setIsResizing] = useState(false)
  const [panelHeight, setPanelHeight] = useState(height)
  const [isMaximized, setIsMaximized] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(160)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)

  // 현재 활성 그룹의 터미널들 (분할된 터미널들)
  const splitTerminals = terminals.filter(t => t.groupId === activeGroupId)
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; terminalId: string } | null>(null)
  // 이름 변경 모달
  const [renameModal, setRenameModal] = useState<{ terminalId: string; currentName: string } | null>(null)
  const [renameInput, setRenameInput] = useState('')
  // 드래그 앤 드롭 상태
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // 분할 터미널 너비 상태
  const [splitWidths, setSplitWidths] = useState<Record<string, number>>({})
  const [resizingSplitIndex, setResizingSplitIndex] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const splitStartXRef = useRef(0)
  const splitStartWidthsRef = useRef<number[]>([])
  const resizeRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // 상단 드래그 리사이즈 핸들러 (높이 조절)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = panelHeight
  }, [panelHeight])


  // 높이 리사이즈 이벤트
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const delta = startYRef.current - e.clientY
      const newHeight = Math.min(Math.max(startHeightRef.current + delta, 150), window.innerHeight - 200)
      setPanelHeight(newHeight)
      onHeightChange?.(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onHeightChange])

  // 사이드바 너비 리사이즈 이벤트
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return

      // 오른쪽 사이드바이므로: 왼쪽으로 드래그하면 넓어지고, 오른쪽으로 드래그하면 좁아짐
      const delta = startXRef.current - e.clientX
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, 80), window.innerWidth * 0.5)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
    }

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingSidebar])

  // 분할 터미널 리사이즈 핸들러
  const handleSplitResizeStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingSplitIndex(index)
    splitStartXRef.current = e.clientX

    if (splitContainerRef.current) {
      const children = splitContainerRef.current.children
      const widths: number[] = []
      for (let i = 0; i < children.length; i++) {
        widths.push((children[i] as HTMLElement).offsetWidth)
      }
      splitStartWidthsRef.current = widths
    }
  }, [])

  // 분할 터미널 리사이즈 이벤트
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingSplitIndex === null) return

      const delta = e.clientX - splitStartXRef.current
      const startWidths = splitStartWidthsRef.current

      if (startWidths.length < 2) return

      const leftIndex = resizingSplitIndex
      const rightIndex = resizingSplitIndex + 1

      const minWidth = 100
      const leftNewWidth = Math.max(startWidths[leftIndex] + delta, minWidth)
      const rightNewWidth = Math.max(startWidths[rightIndex] - delta, minWidth)

      const totalWidth = startWidths.reduce((a, b) => a + b, 0)
      const newWidths: Record<string, number> = {}

      splitTerminals.forEach((terminal, i) => {
        if (i === leftIndex) {
          newWidths[terminal.id] = (leftNewWidth / totalWidth) * 100
        } else if (i === rightIndex) {
          newWidths[terminal.id] = (rightNewWidth / totalWidth) * 100
        } else {
          newWidths[terminal.id] = (startWidths[i] / totalWidth) * 100
        }
      })

      setSplitWidths(newWidths)
    }

    const handleMouseUp = () => {
      setResizingSplitIndex(null)
    }

    if (resizingSplitIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingSplitIndex, splitTerminals])

  // 새 터미널 추가 (새 그룹)
  const addTerminal = () => {
    const newId = String(Date.now())
    const newGroupId = newId
    const newTerminal: TerminalInstance = {
      id: newId,
      name: 'Terminal',
      shell: getDefaultShell(),
      cwd: '',
      groupId: newGroupId,
    }
    addTerminalAction(newTerminal)
  }

  // 터미널 분할 (같은 그룹에 추가)
  const splitTerminal = (terminalId: string) => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal) return

    const newId = String(Date.now())
    const newTerminal: TerminalInstance = {
      id: newId,
      name: 'Terminal',
      shell: getDefaultShell(),
      cwd: '',
      groupId: terminal.groupId, // 같은 그룹!
    }
    splitTerminalAction(terminalId, newTerminal)
  }

  // 터미널 제거 (Kill Terminal)
  const removeTerminal = (id: string) => {
    removeTerminalAction(id)
  }

  // 터미널 선택 (그룹도 함께 변경)
  const selectTerminal = (id: string) => {
    setActiveTerminal(id)
  }

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, terminalId: string) => {
    setDraggedId(terminalId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', terminalId)
  }

  const handleDragOver = (e: React.DragEvent, terminalId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedId !== terminalId) {
      setDragOverId(terminalId)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const draggedIndex = terminals.findIndex(t => t.id === draggedId)
    const targetIndex = terminals.findIndex(t => t.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newTerminals = [...terminals]
    const [removed] = newTerminals.splice(draggedIndex, 1)
    newTerminals.splice(targetIndex, 0, removed)

    setTerminals(newTerminals)
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // 터미널 이름 변경
  const renameTerminal = (id: string, newName: string) => {
    updateTerminal(id, { customName: newName })
    setRenameModal(null)
    setRenameInput('')
  }

  // 우클릭 컨텍스트 메뉴 열기
  const handleContextMenu = (e: React.MouseEvent, terminalId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, terminalId })
  }

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // 셸 정보 이벤트 리스너
  // updateTerminal은 store 내부에서 ID 존재 여부를 체크하므로 별도 검증 불필요
  useEffect(() => {
    const handleShellInfo = (e: Event) => {
      const event = e as CustomEvent
      const { id, shell, cwd, pid } = event.detail
      updateTerminal(id, { shell, cwd, pid })
    }

    const handleCwdUpdate = (e: Event) => {
      const event = e as CustomEvent
      const { id, cwd } = event.detail
      updateTerminal(id, { cwd })
    }

    window.addEventListener('terminal-shell-info', handleShellInfo)
    window.addEventListener('terminal-cwd-update', handleCwdUpdate)

    return () => {
      window.removeEventListener('terminal-shell-info', handleShellInfo)
      window.removeEventListener('terminal-cwd-update', handleCwdUpdate)
    }
  }, [updateTerminal])

  const toggleMaximize = () => {
    if (isMaximized) {
      setPanelHeight(250)
    } else {
      setPanelHeight(window.innerHeight - 100)
    }
    setIsMaximized(!isMaximized)
  }

  // 터미널 리스트 렌더링 (VS Code 스타일 + 그룹핑 + 드래그 앤 드롭)
  const renderTerminalList = (): JSX.Element[] => {
    // 그룹별로 터미널 정리
    const groupMap = new Map<string, TerminalInstance[]>()
    const groupOrder: string[] = []

    terminals.forEach((terminal) => {
      if (!groupMap.has(terminal.groupId)) {
        groupMap.set(terminal.groupId, [])
        groupOrder.push(terminal.groupId)
      }
      groupMap.get(terminal.groupId)!.push(terminal)
    })

    const elements: JSX.Element[] = []

    groupOrder.forEach((groupId) => {
      const groupTerminals = groupMap.get(groupId)!
      const isSplit = groupTerminals.length > 1
      const isGroupActive = activeGroupId === groupId

      if (isSplit) {
        // 분할된 그룹: 트리 구조로 바로 표시 (VS Code 스타일 - 헤더 없음)
        groupTerminals.forEach((terminal, index) => {
          const isActive = activeTerminal === terminal.id
          const isDragging = draggedId === terminal.id
          const isDragOver = dragOverId === terminal.id
          const isLast = index === groupTerminals.length - 1

          elements.push(
            <div
              key={terminal.id}
              draggable
              onDragStart={(e) => handleDragStart(e, terminal.id)}
              onDragOver={(e) => handleDragOver(e, terminal.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, terminal.id)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-1 px-2 py-1.5 cursor-grab text-xs transition-all
                ${isActive ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-white border-l-2 border-accent' : 'text-zinc-600 dark:text-[#cccccc] hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 border-l-2 border-transparent'}
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'border-t-2 border-accent' : ''}
              `}
              onClick={() => selectTerminal(terminal.id)}
              onContextMenu={(e) => handleContextMenu(e, terminal.id)}
            >
              {/* 트리 라인 */}
              <span className="text-zinc-400 dark:text-[#555] text-[11px] font-mono w-3 shrink-0">
                {index === 0 ? '┌' : isLast ? '└' : '├'}
              </span>
              <div className="w-4 h-4 border border-zinc-400 dark:border-[#666] rounded-[3px] flex items-center justify-center shrink-0">
                <TerminalIcon className="w-2.5 h-2.5" />
              </div>
              <span className={`flex-1 truncate ${terminal.shell ? '' : 'text-zinc-500 dark:text-[#888888]'}`}>
                {terminal.customName || terminal.shell || terminal.name}
              </span>
              {/* hover 시에만 아이콘들 표시 */}
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    splitTerminal(terminal.id)
                  }}
                  className="p-0.5 hover:bg-zinc-300 dark:hover:bg-[#3c3c3c] rounded"
                  title="Split Terminal"
                >
                  <SplitSquareHorizontal className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTerminal(terminal.id)
                  }}
                  className="p-0.5 hover:bg-zinc-300 dark:hover:bg-[#3c3c3c] rounded"
                  title="Kill Terminal"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })
      } else {
        // 단일 터미널
        const terminal = groupTerminals[0]
        const isActive = activeTerminal === terminal.id
        const isDragging = draggedId === terminal.id
        const isDragOver = dragOverId === terminal.id

        elements.push(
          <div
            key={terminal.id}
            draggable
            onDragStart={(e) => handleDragStart(e, terminal.id)}
            onDragOver={(e) => handleDragOver(e, terminal.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, terminal.id)}
            onDragEnd={handleDragEnd}
            className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-grab text-xs transition-all
              ${isActive ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-white border-l-2 border-accent' : 'text-zinc-600 dark:text-[#cccccc] hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 border-l-2 border-transparent'}
              ${isDragging ? 'opacity-50' : ''}
              ${isDragOver ? 'border-t-2 border-accent' : ''}
            `}
            onClick={() => selectTerminal(terminal.id)}
            onContextMenu={(e) => handleContextMenu(e, terminal.id)}
          >
            <div className="w-4 h-4 border border-zinc-400 dark:border-[#666] rounded-[3px] flex items-center justify-center shrink-0">
              <TerminalIcon className="w-2.5 h-2.5" />
            </div>
            <span className={`flex-1 truncate ${terminal.shell ? '' : 'text-zinc-500 dark:text-[#888888]'}`}>
              {terminal.customName || terminal.shell || terminal.name}
            </span>
            {/* hover 시에만 아이콘들 표시 */}
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  splitTerminal(terminal.id)
                }}
                className="p-0.5 hover:bg-zinc-300 dark:hover:bg-[#3c3c3c] rounded"
                title="Split Terminal"
              >
                <SplitSquareHorizontal className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTerminal(terminal.id)
                }}
                className="p-0.5 hover:bg-zinc-300 dark:hover:bg-[#3c3c3c] rounded"
                title="Kill Terminal"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
      }
    })

    return elements
  }

  // 터미널 상태 유지를 위해 DOM에서 제거하지 않고 CSS로 숨김 처리
  // XTerm 컴포넌트가 언마운트되면 히스토리/상태가 사라지므로 hidden 클래스 사용
  return (
    <div
      ref={panelRef}
      className={`terminal-panel flex flex-col bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 relative ${className} ${!isOpen ? 'hidden' : ''}`}
      style={{ height: '100%', transition: 'none', animation: 'none', willChange: 'auto' }}
      aria-hidden={!isOpen}
    >
      {/* 리사이즈 핸들 */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="absolute -top-1 left-0 right-0 h-3 cursor-ns-resize z-50 group"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 group-hover:bg-accent" />
      </div>

      {/* 탭 바 */}
      <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 h-[35px] select-none">
        {/* 패널 타입 탭 */}
        <div className="flex items-center h-full">
          <button className="px-3 h-full text-xs text-zinc-500 dark:text-[#888888] border-b-2 border-transparent hover:text-zinc-900 dark:hover:text-white">
            문제
          </button>
          <button className="px-3 h-full text-xs text-zinc-500 dark:text-[#888888] border-b-2 border-transparent hover:text-zinc-900 dark:hover:text-white">
            출력
          </button>
          <button className="px-3 h-full text-xs text-zinc-900 dark:text-white border-b-2 border-accent">
            터미널
          </button>
          <button className="px-3 h-full text-xs text-zinc-500 dark:text-[#888888] border-b-2 border-transparent hover:text-zinc-900 dark:hover:text-white">
            디버그 콘솔
          </button>
        </div>

        <div className="flex-1" />

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-0.5 mr-2">
          <button
            onClick={addTerminal}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#1a1a1a] rounded text-zinc-500 dark:text-[#888888] hover:text-zinc-900 dark:hover:text-white"
            title="새 터미널"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleMaximize}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#1a1a1a] rounded text-zinc-500 dark:text-[#888888] hover:text-zinc-900 dark:hover:text-white"
            title={isMaximized ? "복원" : "최대화"}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#1a1a1a] rounded text-zinc-500 dark:text-[#888888] hover:text-zinc-900 dark:hover:text-white"
            title="패널 숨기기"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#1a1a1a] rounded text-zinc-500 dark:text-[#888888] hover:text-zinc-900 dark:hover:text-white"
            title="패널 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden" style={{ transition: 'none', animation: 'none' }}>
        {/* 분할된 터미널들 (같은 그룹은 나란히 표시) */}
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
          {splitTerminals.map((terminal, index) => {
            const widthPercent = splitWidths[terminal.id] ?? (100 / splitTerminals.length)
            return (
              <div
                key={terminal.id}
                className={`relative h-full min-w-[100px] ${activeTerminal === terminal.id ? 'ring-1 ring-accent/30 ring-inset' : ''}`}
                style={{ width: `${widthPercent}%`, flex: 'none' }}
                onClick={() => setActiveTerminal(terminal.id)}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {/* 분할 리사이즈 핸들 (첫 번째 제외) */}
                {index > 0 && (
                  <div
                    onMouseDown={(e) => handleSplitResizeStart(e, index - 1)}
                    className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize z-30 group hover:bg-accent/30"
                  >
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-zinc-300 dark:bg-[#333] group-hover:bg-accent" />
                  </div>
                )}
                <XTermComponent
                  onExecute={onExecute}
                  tabId={terminal.id}
                />
              </div>
            )
          })}
        </div>



        {/* 우측 트리 사이드바 */}
        <div
          className="relative bg-zinc-100 dark:bg-zinc-900 flex flex-col overflow-hidden"
          style={{ width: sidebarWidth, transition: 'none' }}
        >
          {/* 리사이즈 핸들 (투명, 오버레이) */}
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizingSidebar(true)
              startXRef.current = e.clientX
              startWidthRef.current = sidebarWidth
            }}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-zinc-500/10 transition-colors"
            title="Drag to resize"
          />

          {/* 리스트 헤더 */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-[#888888] uppercase tracking-wider">터미널</span>
            <button
              onClick={addTerminal}
              className="p-0.5 hover:bg-zinc-200 dark:hover:bg-[#1a1a1a] rounded text-zinc-500 dark:text-[#888888] hover:text-zinc-900 dark:hover:text-white"
              title="새 터미널"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* 터미널 리스트 */}
          <div className="flex-1 overflow-y-auto overscroll-contain py-1">
            {renderTerminalList()}
          </div>
        </div>
      </div>

      {/* 컨텍스트 메뉴 (VS Code 스타일) */}
      {contextMenu && (
        <div
          className="fixed bg-zinc-100 dark:bg-[#252526] border border-zinc-300 dark:border-[#454545] rounded-md shadow-xl py-1 z-[100] min-w-[240px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Split Terminal */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-[#cccccc] hover:bg-accent/20 dark:hover:bg-[#094771] flex items-center justify-between"
            onClick={() => {
              splitTerminal(contextMenu.terminalId)
              setContextMenu(null)
            }}
          >
            <span>Split Terminal</span>
            <span className="text-zinc-500 dark:text-[#888888] text-xs">⌘\</span>
          </button>

          {/* Move Terminal into Editor Area */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 dark:text-[#6e6e6e] cursor-not-allowed flex items-center justify-between"
            disabled
          >
            <span>Move Terminal into Editor Area</span>
          </button>

          {/* Move Terminal into New Window */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 dark:text-[#6e6e6e] cursor-not-allowed flex items-center justify-between"
            disabled
          >
            <span>Move Terminal into New Window</span>
          </button>

          <div className="h-px bg-zinc-300 dark:bg-[#454545] my-1" />

          {/* Change Color... */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-[#cccccc] hover:bg-accent/20 dark:hover:bg-[#094771] flex items-center justify-between"
            onClick={() => setContextMenu(null)}
          >
            <span>Change Color...</span>
          </button>

          {/* Change Icon... */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-[#cccccc] hover:bg-accent/20 dark:hover:bg-[#094771] flex items-center justify-between"
            onClick={() => setContextMenu(null)}
          >
            <span>Change Icon...</span>
          </button>

          {/* Rename... */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-[#cccccc] hover:bg-accent/20 dark:hover:bg-[#094771] flex items-center justify-between"
            onClick={() => {
              const terminal = terminals.find(t => t.id === contextMenu.terminalId)
              if (terminal) {
                setRenameModal({ terminalId: terminal.id, currentName: terminal.name })
                setRenameInput(terminal.customName || terminal.shell || terminal.name)
              }
              setContextMenu(null)
            }}
          >
            <span>Rename...</span>
            <span className="text-zinc-500 dark:text-[#888888] text-xs">↵</span>
          </button>

          {/* Toggle Size to Content Width */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 dark:text-[#6e6e6e] cursor-not-allowed flex items-center justify-between"
            disabled
          >
            <span>Toggle Size to Content Width</span>
            <span className="text-zinc-500 dark:text-[#888888] text-xs">⌥Z</span>
          </button>

          <div className="h-px bg-zinc-300 dark:bg-[#454545] my-1" />

          {/* Kill Terminal */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-[#cccccc] hover:bg-accent/20 dark:hover:bg-[#094771] flex items-center justify-between"
            onClick={() => {
              removeTerminal(contextMenu.terminalId)
              setContextMenu(null)
            }}
          >
            <span>Kill Terminal</span>
            <span className="text-zinc-500 dark:text-[#888888] text-xs">⌘⌫</span>
          </button>
        </div>
      )}

      {/* 이름 변경 모달 */}
      {renameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-[#252526] border border-zinc-300 dark:border-[#454545] rounded-lg p-4 w-[300px]">
            <h3 className="text-sm text-zinc-900 dark:text-white mb-3">터미널 이름 변경</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameInput.trim()) {
                  renameTerminal(renameModal.terminalId, renameInput.trim())
                } else if (e.key === 'Escape') {
                  setRenameModal(null)
                  setRenameInput('')
                }
              }}
              className="w-full px-3 py-2 bg-zinc-100 dark:bg-[#3c3c3c] border border-accent rounded text-sm text-zinc-900 dark:text-white outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setRenameModal(null)
                  setRenameInput('')
                }}
                className="px-3 py-1.5 text-sm text-zinc-600 dark:text-[#cccccc] hover:bg-zinc-200 dark:hover:bg-[#3c3c3c] rounded"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (renameInput.trim()) {
                    renameTerminal(renameModal.terminalId, renameInput.trim())
                  }
                }}
                className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent/90"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
