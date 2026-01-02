/**
 * Neural Map API Hook
 * CRUD operations for neural map data
 */

import { useCallback, useState } from 'react'
import { useNeuralMapStore } from './store'
import type { NeuralNode, NeuralEdge, NeuralFile, NodeType, EdgeType, StorageMode } from './types'

interface CreateNodeParams {
  type: NodeType
  title: string
  summary?: string
  content?: string
  tags?: string[]
  importance?: number
  parentId?: string
  position?: { x: number; y: number; z: number }
}

interface CreateEdgeParams {
  sourceId: string
  targetId: string
  type: EdgeType
  weight?: number
  label?: string
  bidirectional?: boolean
}

interface AnalyzeResult {
  success: boolean
  concepts: Array<{
    title: string
    summary: string
    type: string
    tags: string[]
    importance: number
  }>
  nodes: NeuralNode[]
  edges: NeuralEdge[]
  message?: string
}

export function useNeuralMapApi(mapId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addNode, updateNode, deleteNode, addEdge, deleteEdge, addFile, removeFile } = useNeuralMapStore()

  // 노드 생성
  const createNode = useCallback(async (params: CreateNodeParams): Promise<NeuralNode | null> => {
    if (!mapId) return null

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create node')
      }

      const node = await res.json()
      addNode(node)
      return node
    } catch (err) {
      console.error('Create node error:', err)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, addNode])

  // 노드 수정
  const editNode = useCallback(async (nodeId: string, updates: Partial<NeuralNode>): Promise<NeuralNode | null> => {
    if (!mapId) return null

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, ...updates }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update node')
      }

      const node = await res.json()
      updateNode(nodeId, node)
      return node
    } catch (err) {
      console.error('Update node error:', err)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, updateNode])

  // 노드 삭제
  const removeNode = useCallback(async (nodeId: string): Promise<boolean> => {
    if (!mapId) return false

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/nodes?nodeId=${nodeId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete node')
      }

      deleteNode(nodeId)
      return true
    } catch (err) {
      console.error('Delete node error:', err)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, deleteNode])

  // 엣지 생성
  const createEdge = useCallback(async (params: CreateEdgeParams): Promise<NeuralEdge | null> => {
    if (!mapId) return null

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create edge')
      }

      const edge = await res.json()
      addEdge(edge)
      return edge
    } catch (err) {
      console.error('Create edge error:', err)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, addEdge])

  // 엣지 삭제
  const removeEdge = useCallback(async (edgeId: string): Promise<boolean> => {
    if (!mapId) return false

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/edges?edgeId=${edgeId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete edge')
      }

      deleteEdge(edgeId)
      return true
    } catch (err) {
      console.error('Delete edge error:', err)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, deleteEdge])

  // 🔥 storageMode 가져오기
  const storageMode = useNeuralMapStore((s) => s.storageMode)

  // 파일 업로드 (path: 폴더 내 상대 경로)
  // 🔥 storageMode에 따라 다른 처리:
  // - local: 파일 업로드 없이 경로 참조만 저장
  // - supabase: Supabase Storage에 업로드
  // - gcs: Google Cloud Storage에 업로드
  const uploadFile = useCallback(async (
    file: File,
    path?: string,
    options?: {
      localPath?: string  // 🔥 로컬 절대 경로 (Electron에서 제공)
      overrideStorageMode?: StorageMode  // 🔥 개별 파일 저장 모드 오버라이드
    }
  ): Promise<NeuralFile | null> => {
    if (!mapId) return null

    const effectiveStorageMode = options?.overrideStorageMode || storageMode

    setIsSubmitting(true)
    try {
      const formData = new FormData()

      // 🔥 LOCAL 모드: 파일 업로드 없이 메타데이터만 전송
      if (effectiveStorageMode === 'local') {
        const localPath = options?.localPath || (file as any).path || path
        if (!localPath) {
          console.error('[uploadFile] LOCAL mode requires localPath')
          throw new Error('LOCAL mode requires localPath')
        }

        formData.append('storageMode', 'local')
        formData.append('localPath', localPath)
        formData.append('fileName', file.name)
        formData.append('fileSize', String(file.size))
        if (path) {
          formData.append('path', path)
        }

        console.log('[uploadFile] LOCAL mode - storing path reference only:', localPath)
      } else {
        // 🔥 SUPABASE / GCS 모드: 실제 파일 업로드
        formData.append('storageMode', effectiveStorageMode)

        // Explicitly check for Electron fakeFile vs real File
        if (!(file instanceof File) && (file as any).text) {
          console.log('[uploadFile] Using Electron fakeFile compatibility mode for:', (file as any).name);
          formData.append('file', file as any, (file as any).name)
        } else {
          formData.append('file', file)
        }

        if (path) {
          formData.append('path', path)
        }

        console.log('[uploadFile] Sending request for:', file.name, 'size:', file.size, 'mode:', effectiveStorageMode)
      }

      const res = await fetch(`/api/neural-map/${mapId}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('[uploadFile] Server error for', file.name, ':', error)
        throw new Error(error.error || 'Failed to upload file')
      }

      const uploadedFile = await res.json()
      console.log('[uploadFile] Success:', file.name, uploadedFile)
      addFile(uploadedFile)
      return uploadedFile
    } catch (err) {
      console.error('[uploadFile] Upload failed for', file.name, ':', err)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, addFile, storageMode])

  // 파일 삭제
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    if (!mapId) return false

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/files?fileId=${fileId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete file')
      }

      removeFile(fileId)
      return true
    } catch (err) {
      console.error('Delete file error:', err)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, removeFile])

  // 맵 저장 (view state, theme 등)
  const saveMapState = useCallback(async (updates: { title?: string; themeId?: string; viewState?: unknown }): Promise<boolean> => {
    if (!mapId) return false

    try {
      const res = await fetch(`/api/neural-map/${mapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      return res.ok
    } catch (err) {
      console.error('Save map state error:', err)
      return false
    }
  }, [mapId])

  // 파일 분석 및 노드 자동 생성 (옵시디언 스타일)
  const analyzeFile = useCallback(async (fileId: string): Promise<AnalyzeResult | null> => {
    if (!mapId) return null

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to analyze file')
      }

      const result: AnalyzeResult = await res.json()

      // 생성된 노드들을 스토어에 추가
      if (result.nodes) {
        result.nodes.forEach(node => addNode(node))
      }

      // 생성된 엣지들을 스토어에 추가
      if (result.edges) {
        result.edges.forEach(edge => addEdge(edge))
      }

      return result
    } catch (err) {
      console.error('Analyze file error:', err)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [mapId, addNode, addEdge])

  return {
    isSubmitting,
    createNode,
    editNode,
    removeNode,
    createEdge,
    removeEdge,
    uploadFile,
    deleteFile,
    saveMapState,
    analyzeFile,
  }
}
