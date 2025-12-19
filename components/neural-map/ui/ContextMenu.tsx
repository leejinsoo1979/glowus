'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NodeType } from '@/lib/neural-map/types'
import {
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Copy,
  Link,
  Unlink,
  Maximize2,
  Pin,
  PinOff,
  Plus,
  Folder,
  FileText,
  Lightbulb,
  CheckSquare,
  User,
  Zap,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface MenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  submenu?: MenuItem[]
  onClick?: () => void
}

interface ContextMenuProps {
  position: { x: number; y: number } | null
  node?: NeuralNode | null
  onClose: () => void
  onAddNode?: (type: NodeType, position?: { x: number; y: number }) => void
  onEditNode?: (node: NeuralNode) => void
  onDeleteNode?: (nodeId: string) => void
  onDuplicateNode?: (node: NeuralNode) => void
  onConnectNodes?: (sourceId: string) => void
}

// ============================================
// Node Type Icons
// ============================================

const NODE_TYPE_ICONS: Record<NodeType, React.ReactNode> = {
  self: <User className="w-4 h-4" />,
  concept: <Lightbulb className="w-4 h-4" />,
  project: <Folder className="w-4 h-4" />,
  doc: <FileText className="w-4 h-4" />,
  idea: <Lightbulb className="w-4 h-4" />,
  decision: <CheckSquare className="w-4 h-4" />,
  memory: <Zap className="w-4 h-4" />,
  task: <CheckSquare className="w-4 h-4" />,
  person: <User className="w-4 h-4" />,
  insight: <Zap className="w-4 h-4" />,
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  self: '중심',
  concept: '개념',
  project: '프로젝트',
  doc: '문서',
  idea: '아이디어',
  decision: '의사결정',
  memory: '기억',
  task: '할일',
  person: '사람',
  insight: '인사이트',
}

// ============================================
// Context Menu Component
// ============================================

export function ContextMenu({
  position,
  node,
  onClose,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onDuplicateNode,
  onConnectNodes,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)

  // Store actions
  const updateNode = useNeuralMapStore((s) => s.updateNode)
  const deleteNode = useNeuralMapStore((s) => s.deleteNode)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const expandNode = useNeuralMapStore((s) => s.expandNode)
  const collapseNode = useNeuralMapStore((s) => s.collapseNode)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let x = position.x
      let y = position.y

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10
      }

      menuRef.current.style.left = `${x}px`
      menuRef.current.style.top = `${y}px`
    }
  }, [position])

  // Handle menu item click
  const handleItemClick = useCallback(
    (item: MenuItem) => {
      if (item.disabled || item.submenu) return
      item.onClick?.()
      onClose()
    },
    [onClose]
  )

  // Handle submenu hover
  const handleSubmenuHover = useCallback(
    (itemId: string, itemRect: DOMRect) => {
      setActiveSubmenu(itemId)
      setSubmenuPosition({
        x: itemRect.right,
        y: itemRect.top,
      })
    },
    []
  )

  if (!position) return null

  // Build menu items based on context
  const menuItems: MenuItem[] = node
    ? buildNodeMenu(node, {
        onEdit: () => onEditNode?.(node),
        onDelete: () => {
          if (node.type !== 'self') {
            deleteNode(node.id)
            onDeleteNode?.(node.id)
          }
        },
        onDuplicate: () => onDuplicateNode?.(node),
        onFocus: () => focusOnNode(node.id),
        onTogglePin: () => updateNode(node.id, { pinned: !node.pinned }),
        onToggleExpand: () => (node.expanded ? collapseNode(node.id) : expandNode(node.id)),
        onConnect: () => onConnectNodes?.(node.id),
        selectedCount: selectedNodeIds.length,
      })
    : buildBackgroundMenu({
        onAddNode: (type) => onAddNode?.(type, position),
      })

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="py-1">
        {menuItems.map((item, index) =>
          item.separator ? (
            <div key={`sep-${index}`} className="h-px bg-zinc-700 my-1" />
          ) : (
            <button
              key={item.id}
              className={`
                w-full px-3 py-2 flex items-center gap-3 text-sm text-left
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'}
                ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-200'}
              `}
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
              onMouseEnter={(e) => {
                if (item.submenu) {
                  handleSubmenuHover(item.id, e.currentTarget.getBoundingClientRect())
                } else {
                  setActiveSubmenu(null)
                }
              }}
            >
              {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-zinc-500">{item.shortcut}</span>
              )}
              {item.submenu && <span className="text-zinc-500">▶</span>}
            </button>
          )
        )}
      </div>

      {/* Submenu */}
      {activeSubmenu && submenuPosition && (
        <Submenu
          items={menuItems.find((i) => i.id === activeSubmenu)?.submenu || []}
          position={submenuPosition}
          onItemClick={handleItemClick}
        />
      )}
    </div>,
    document.body
  )
}

// ============================================
// Submenu Component
// ============================================

interface SubmenuProps {
  items: MenuItem[]
  position: { x: number; y: number }
  onItemClick: (item: MenuItem) => void
}

function Submenu({ items, position, onItemClick }: SubmenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Adjust position
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      if (position.x + rect.width > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width - 200}px`
      }
    }
  }, [position])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="py-1">
        {items.map((item) => (
          <button
            key={item.id}
            className={`
              w-full px-3 py-2 flex items-center gap-3 text-sm text-left
              ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'}
              text-zinc-200
            `}
            disabled={item.disabled}
            onClick={() => onItemClick(item)}
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Menu Builders
// ============================================

function buildNodeMenu(
  node: NeuralNode,
  actions: {
    onEdit: () => void
    onDelete: () => void
    onDuplicate: () => void
    onFocus: () => void
    onTogglePin: () => void
    onToggleExpand: () => void
    onConnect: () => void
    selectedCount: number
  }
): MenuItem[] {
  const isSelf = node.type === 'self'

  return [
    {
      id: 'edit',
      label: '편집',
      icon: <Edit3 className="w-4 h-4" />,
      shortcut: 'Enter',
      onClick: actions.onEdit,
    },
    {
      id: 'focus',
      label: '포커스',
      icon: <Maximize2 className="w-4 h-4" />,
      shortcut: 'F',
      onClick: actions.onFocus,
    },
    {
      id: 'separator1',
      label: '',
      separator: true,
    },
    {
      id: 'pin',
      label: node.pinned ? '고정 해제' : '위치 고정',
      icon: node.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: actions.onTogglePin,
    },
    {
      id: 'expand',
      label: node.expanded ? '접기' : '펼치기',
      icon: node.expanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
      onClick: actions.onToggleExpand,
    },
    {
      id: 'separator2',
      label: '',
      separator: true,
    },
    {
      id: 'connect',
      label: '연결 추가',
      icon: <Link className="w-4 h-4" />,
      onClick: actions.onConnect,
    },
    {
      id: 'duplicate',
      label: '복제',
      icon: <Copy className="w-4 h-4" />,
      shortcut: '⌘D',
      disabled: isSelf,
      onClick: actions.onDuplicate,
    },
    {
      id: 'separator3',
      label: '',
      separator: true,
    },
    {
      id: 'delete',
      label: actions.selectedCount > 1 ? `${actions.selectedCount}개 삭제` : '삭제',
      icon: <Trash2 className="w-4 h-4" />,
      shortcut: 'Del',
      danger: true,
      disabled: isSelf,
      onClick: actions.onDelete,
    },
  ]
}

function buildBackgroundMenu(actions: {
  onAddNode: (type: NodeType) => void
}): MenuItem[] {
  const nodeTypes: NodeType[] = ['concept', 'project', 'doc', 'idea', 'decision', 'task', 'person']

  return [
    {
      id: 'add-node',
      label: '노드 추가',
      icon: <Plus className="w-4 h-4" />,
      submenu: nodeTypes.map((type) => ({
        id: `add-${type}`,
        label: NODE_TYPE_LABELS[type],
        icon: NODE_TYPE_ICONS[type],
        onClick: () => actions.onAddNode(type),
      })),
    },
  ]
}

export default ContextMenu
