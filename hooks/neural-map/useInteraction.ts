'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode } from '@/lib/neural-map/types'

interface UseInteractionOptions {
  onNodeDoubleClick?: (node: NeuralNode) => void
  onNodeContextMenu?: (node: NeuralNode, position: { x: number; y: number }) => void
  onBackgroundContextMenu?: (position: { x: number; y: number }) => void
  onSelectionChange?: (nodeIds: string[]) => void
}

interface InteractionState {
  isDragging: boolean
  isSelecting: boolean
  dragStartPosition: { x: number; y: number } | null
  selectionBox: { start: { x: number; y: number }; end: { x: number; y: number } } | null
}

export function useInteraction(options: UseInteractionOptions = {}) {
  const {
    onNodeDoubleClick,
    onNodeContextMenu,
    onBackgroundContextMenu,
    onSelectionChange,
  } = options

  // Store actions
  const selectNode = useNeuralMapStore((s) => s.selectNode)
  const selectNodes = useNeuralMapStore((s) => s.selectNodes)
  const deselectAll = useNeuralMapStore((s) => s.deselectAll)
  const setHoveredNode = useNeuralMapStore((s) => s.setHoveredNode)
  const deleteNode = useNeuralMapStore((s) => s.deleteNode)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const resetCamera = useNeuralMapStore((s) => s.resetCamera)
  const undo = useNeuralMapStore((s) => s.undo)
  const redo = useNeuralMapStore((s) => s.redo)
  const graph = useNeuralMapStore((s) => s.graph)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)

  // Local state ref
  const stateRef = useRef<InteractionState>({
    isDragging: false,
    isSelecting: false,
    dragStartPosition: null,
    selectionBox: null,
  })

  // Track modifier keys
  const modifiersRef = useRef({
    shift: false,
    ctrl: false,
    meta: false,
    alt: false,
  })

  // Handle node click with modifier support
  const handleNodeClick = useCallback(
    (nodeId: string, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
      const isMultiSelect = event?.shiftKey || event?.ctrlKey || event?.metaKey
      selectNode(nodeId, isMultiSelect)
    },
    [selectNode]
  )

  // Handle node double click
  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      if (!graph) return
      const node = graph.nodes.find((n) => n.id === nodeId)
      if (node) {
        focusOnNode(nodeId)
        onNodeDoubleClick?.(node)
      }
    },
    [graph, focusOnNode, onNodeDoubleClick]
  )

  // Handle node hover
  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNode(nodeId)
    },
    [setHoveredNode]
  )

  // Handle background click (deselect)
  const handleBackgroundClick = useCallback(() => {
    if (!modifiersRef.current.shift && !modifiersRef.current.ctrl && !modifiersRef.current.meta) {
      deselectAll()
    }
  }, [deselectAll])

  // Handle context menu on node
  const handleNodeRightClick = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (!graph) return
      const node = graph.nodes.find((n) => n.id === nodeId)
      if (node) {
        // Select the node if not already selected
        if (!selectedNodeIds.includes(nodeId)) {
          selectNode(nodeId, false)
        }
        onNodeContextMenu?.(node, position)
      }
    },
    [graph, selectedNodeIds, selectNode, onNodeContextMenu]
  )

  // Handle context menu on background
  const handleBackgroundRightClick = useCallback(
    (position: { x: number; y: number }) => {
      onBackgroundContextMenu?.(position)
    },
    [onBackgroundContextMenu]
  )

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    selectedNodeIds.forEach((id) => {
      // Don't delete the self node
      const node = graph?.nodes.find((n) => n.id === id)
      if (node && node.type !== 'self') {
        deleteNode(id)
      }
    })
  }, [selectedNodeIds, graph, deleteNode])

  // Select all nodes
  const selectAllNodes = useCallback(() => {
    if (!graph) return
    selectNodes(graph.nodes.map((n) => n.id))
  }, [graph, selectNodes])

  // Focus on selected node
  const focusOnSelected = useCallback(() => {
    if (selectedNodeIds.length === 1) {
      focusOnNode(selectedNodeIds[0])
    }
  }, [selectedNodeIds, focusOnNode])

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Update modifiers
      modifiersRef.current = {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
      }

      // Don't handle if focus is on input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Handle shortcuts
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedNodeIds.length > 0) {
            e.preventDefault()
            deleteSelectedNodes()
          }
          break

        case 'a':
        case 'A':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            selectAllNodes()
          }
          break

        case 'Escape':
          deselectAll()
          break

        case 'f':
        case 'F':
          if (selectedNodeIds.length === 1) {
            e.preventDefault()
            focusOnSelected()
          }
          break

        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            resetCamera()
          }
          break

        case 'z':
        case 'Z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break

        case 'y':
        case 'Y':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            redo()
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      modifiersRef.current = {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedNodeIds, deleteSelectedNodes, selectAllNodes, deselectAll, focusOnSelected, resetCamera, undo, redo])

  // Notify selection changes
  useEffect(() => {
    onSelectionChange?.(selectedNodeIds)
  }, [selectedNodeIds, onSelectionChange])

  return {
    // Click handlers
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeHover,
    handleBackgroundClick,
    handleNodeRightClick,
    handleBackgroundRightClick,

    // Actions
    deleteSelectedNodes,
    selectAllNodes,
    focusOnSelected,

    // State
    selectedNodeIds,
    modifiers: modifiersRef.current,
  }
}

// Keyboard shortcuts help
export const KEYBOARD_SHORTCUTS = [
  { key: 'Delete / Backspace', action: '선택한 노드 삭제' },
  { key: '⌘/Ctrl + A', action: '모든 노드 선택' },
  { key: 'Escape', action: '선택 해제' },
  { key: 'F', action: '선택한 노드에 포커스' },
  { key: 'R', action: '카메라 리셋' },
  { key: '⌘/Ctrl + Z', action: '실행 취소' },
  { key: '⌘/Ctrl + Shift + Z', action: '다시 실행' },
  { key: 'Shift/Ctrl + 클릭', action: '다중 선택' },
]
