/**
 * Properties ↔ Neural Map 양방향 동기화 훅
 *
 * 핵심 기능:
 * 1. [[위키링크]] 파싱 → Graph Edge 자동 생성
 * 2. 대상 노드가 없으면 Stub 노드 자동 생성
 * 3. 링크 삭제 시 Edge 자동 제거
 * 4. 파일 ↔ 노드 매핑 자동 처리
 */

import { useCallback, useEffect, useRef } from 'react'
import { useNeuralMapStore } from './store'
import { extractLinkTargets } from './markdown-parser'
import type { NeuralEdge, NeuralNode } from './types'
import matter from 'gray-matter'

// ============================================
// 유틸리티 함수
// ============================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

const normalizeTitle = (title: string): string => {
  return title.toLowerCase().replace(/\.md$/i, '').trim()
}

// ============================================
// 링크 추출 함수
// ============================================

/**
 * Properties (frontmatter)에서 [[링크]] 추출
 */
function extractLinksFromProperties(properties: Record<string, unknown>): string[] {
  const links: string[] = []
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g

  for (const value of Object.values(properties)) {
    if (value === null || value === undefined) continue

    const valueStr = Array.isArray(value) ? value.join(' ') : String(value)
    let match
    while ((match = wikiLinkRegex.exec(valueStr)) !== null) {
      links.push(match[1])
    }
  }

  return [...new Set(links)]
}

/**
 * 전체 콘텐츠에서 모든 [[링크]] 추출 (frontmatter + body)
 */
function extractAllLinks(content: string): string[] {
  // Frontmatter 파싱
  let properties: Record<string, unknown> = {}
  try {
    const parsed = matter(content)
    properties = parsed.data || {}
  } catch {
    // frontmatter 파싱 실패 시 무시
  }

  const propertyLinks = extractLinksFromProperties(properties)
  const bodyLinks = extractLinkTargets(content)

  return [...new Set([...propertyLinks, ...bodyLinks])]
}

// ============================================
// 노드 찾기/생성 함수
// ============================================

/**
 * 이름으로 노드 찾기 (대소문자 무시, .md 확장자 무시)
 */
function findNodeByName(nodes: NeuralNode[], name: string): NeuralNode | undefined {
  const normalized = normalizeTitle(name)
  return nodes.find(node => normalizeTitle(node.title) === normalized)
}

/**
 * 파일 ID로 노드 찾기
 */
function findNodeByFileId(nodes: NeuralNode[], fileId: string): NeuralNode | undefined {
  return nodes.find(node => node.sourceRef?.fileId === fileId)
}

/**
 * 파일 경로로 노드 찾기
 */
function findNodeByPath(nodes: NeuralNode[], filePath: string): NeuralNode | undefined {
  const normalized = normalizeTitle(filePath)
  return nodes.find(node => {
    if (node.sourceRef?.fileId) return false // 파일 노드는 fileId로 찾아야 함
    return normalizeTitle(node.title) === normalized
  })
}

/**
 * Stub 노드 생성 (링크 대상이 없을 때)
 */
function createStubNode(title: string, parentId?: string): NeuralNode {
  const now = new Date().toISOString()
  return {
    id: `stub-${generateId()}`,
    type: 'doc',
    title: title,
    summary: `📝 "${title}" - 아직 생성되지 않은 문서`,
    tags: ['stub', 'wiki-link'],
    importance: 3,
    parentId,
    expanded: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  }
}

// ============================================
// 메인 훅
// ============================================

interface UsePropertiesSyncOptions {
  fileId?: string
  filePath?: string
  fileName?: string
  enabled?: boolean
}

interface SyncResult {
  addedEdges: string[]
  removedEdges: string[]
  createdStubNodes: string[]
}

/**
 * Properties ↔ Neural Map 양방향 동기화 훅
 */
export function usePropertiesSync(options: UsePropertiesSyncOptions = {}) {
  const { fileId, filePath, fileName, enabled = true } = options

  // Store 접근
  const graph = useNeuralMapStore(s => s.graph)
  const addNode = useNeuralMapStore(s => s.addNode)
  const addEdge = useNeuralMapStore(s => s.addEdge)
  const deleteEdge = useNeuralMapStore(s => s.deleteEdge)

  // 상태 추적
  const prevLinksRef = useRef<Set<string>>(new Set())
  const isSyncingRef = useRef(false)
  const initializedRef = useRef(false)

  /**
   * 현재 파일의 노드 ID 찾기 (여러 방법 시도)
   */
  const getCurrentNodeId = useCallback((): string | undefined => {
    if (!graph) {
      console.log('[PropertiesSync] getCurrentNodeId: graph is null')
      return undefined
    }

    // 1. fileId로 찾기
    if (fileId) {
      const node = findNodeByFileId(graph.nodes, fileId)
      if (node) {
        console.log(`[PropertiesSync] Found node by fileId: ${node.id}`)
        return node.id
      }
    }

    // 2. filePath로 찾기
    if (filePath) {
      const node = findNodeByPath(graph.nodes, filePath)
      if (node) {
        console.log(`[PropertiesSync] Found node by filePath: ${node.id}`)
        return node.id
      }
    }

    // 3. fileName으로 찾기
    if (fileName) {
      const node = findNodeByName(graph.nodes, fileName)
      if (node) {
        console.log(`[PropertiesSync] Found node by fileName: ${node.id}`)
        return node.id
      }
    }

    console.log('[PropertiesSync] getCurrentNodeId: No node found', { fileId, filePath, fileName })
    return undefined
  }, [graph, fileId, filePath, fileName])

  /**
   * 링크 대상 노드 찾기 또는 Stub 생성
   */
  const findOrCreateTargetNode = useCallback((linkName: string): NeuralNode | null => {
    if (!graph) return null

    // 기존 노드 찾기
    const existingNode = findNodeByName(graph.nodes, linkName)
    if (existingNode) {
      return existingNode
    }

    // Stub 노드 생성
    console.log(`[PropertiesSync] Creating stub node for: "${linkName}"`)
    const stubNode = createStubNode(linkName, graph.rootNodeId)
    addNode(stubNode)

    return stubNode
  }, [graph, addNode])

  /**
   * 콘텐츠 변경 시 Graph 동기화
   */
  const syncToGraph = useCallback((
    content: string,
    sourceNodeId?: string
  ): SyncResult => {
    const result: SyncResult = {
      addedEdges: [],
      removedEdges: [],
      createdStubNodes: []
    }

    if (!graph || isSyncingRef.current) {
      console.log('[PropertiesSync] syncToGraph: skipped', { hasGraph: !!graph, isSyncing: isSyncingRef.current })
      return result
    }

    // sourceNodeId 결정
    const nodeId = sourceNodeId || getCurrentNodeId()
    if (!nodeId) {
      console.log('[PropertiesSync] syncToGraph: no source node ID')
      return result
    }

    isSyncingRef.current = true
    console.log(`[PropertiesSync] Starting sync for node: ${nodeId}`)

    try {
      // 현재 콘텐츠에서 링크 추출
      const currentLinks = new Set(extractAllLinks(content))
      const previousLinks = prevLinksRef.current

      console.log(`[PropertiesSync] Links - Current: [${[...currentLinks].join(', ')}], Previous: [${[...previousLinks].join(', ')}]`)

      // 새로 추가된 링크
      const addedLinks = [...currentLinks].filter(link => !previousLinks.has(link))

      // 삭제된 링크
      const removedLinks = [...previousLinks].filter(link => !currentLinks.has(link))

      // 새 링크 처리 → Edge 생성
      for (const linkName of addedLinks) {
        const targetNode = findOrCreateTargetNode(linkName)

        if (!targetNode) {
          console.warn(`[PropertiesSync] Failed to find/create target for: ${linkName}`)
          continue
        }

        if (targetNode.id === nodeId) {
          console.log(`[PropertiesSync] Skipping self-reference: ${linkName}`)
          continue
        }

        // 이미 존재하는 edge 확인
        const existingEdge = graph.edges.find(
          e => e.source === nodeId && e.target === targetNode.id && e.type === 'references'
        )

        if (existingEdge) {
          console.log(`[PropertiesSync] Edge already exists: ${nodeId} → ${targetNode.id}`)
          continue
        }

        // 새 Edge 생성
        const newEdge: NeuralEdge = {
          id: `edge-${generateId()}`,
          source: nodeId,
          target: targetNode.id,
          type: 'references',
          weight: 0.6,
          bidirectional: false,
          label: 'links to',
          createdAt: new Date().toISOString()
        }

        addEdge(newEdge)
        result.addedEdges.push(newEdge.id)

        // Stub 노드였으면 기록
        if (targetNode.tags?.includes('stub')) {
          result.createdStubNodes.push(targetNode.id)
        }

        console.log(`[PropertiesSync] ✅ Created edge: ${nodeId} → ${targetNode.id} (${linkName})`)
      }

      // 삭제된 링크 처리 → Edge 제거
      for (const linkName of removedLinks) {
        const targetNode = findNodeByName(graph.nodes, linkName)

        if (!targetNode) continue

        const edgeToRemove = graph.edges.find(
          e => e.source === nodeId && e.target === targetNode.id && e.type === 'references'
        )

        if (edgeToRemove) {
          deleteEdge(edgeToRemove.id)
          result.removedEdges.push(edgeToRemove.id)
          console.log(`[PropertiesSync] ❌ Removed edge: ${nodeId} → ${targetNode.id} (${linkName})`)
        }
      }

      // 상태 업데이트
      prevLinksRef.current = currentLinks

      console.log(`[PropertiesSync] Sync complete:`, {
        addedEdges: result.addedEdges.length,
        removedEdges: result.removedEdges.length,
        createdStubNodes: result.createdStubNodes.length
      })

    } catch (error) {
      console.error('[PropertiesSync] Error during sync:', error)
    } finally {
      isSyncingRef.current = false
    }

    return result
  }, [graph, getCurrentNodeId, findOrCreateTargetNode, addEdge, deleteEdge])

  /**
   * 초기화 - 기존 콘텐츠의 링크를 prevLinksRef에 설정
   */
  const initializeLinks = useCallback((content: string) => {
    if (initializedRef.current) return

    const links = extractAllLinks(content)
    prevLinksRef.current = new Set(links)
    initializedRef.current = true

    console.log(`[PropertiesSync] Initialized with ${links.length} links:`, links)
  }, [])

  /**
   * 리셋
   */
  const reset = useCallback(() => {
    prevLinksRef.current = new Set()
    initializedRef.current = false
    console.log('[PropertiesSync] Reset')
  }, [])

  /**
   * 연결된 노드 목록 가져오기
   */
  const getConnectedNodes = useCallback((sourceNodeId?: string): NeuralNode[] => {
    if (!graph) return []

    const nodeId = sourceNodeId || getCurrentNodeId()
    if (!nodeId) return []

    const outgoingEdges = graph.edges.filter(e => e.source === nodeId)
    return outgoingEdges
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter((n): n is NeuralNode => n !== undefined)
  }, [graph, getCurrentNodeId])

  /**
   * Backlinks 가져오기 (이 노드를 참조하는 노드들)
   */
  const getBacklinks = useCallback((targetNodeId?: string): NeuralNode[] => {
    if (!graph) return []

    const nodeId = targetNodeId || getCurrentNodeId()
    if (!nodeId) return []

    const incomingEdges = graph.edges.filter(e => e.target === nodeId)
    return incomingEdges
      .map(e => graph.nodes.find(n => n.id === e.source))
      .filter((n): n is NeuralNode => n !== undefined)
  }, [graph, getCurrentNodeId])

  return {
    // 동기화
    syncToGraph,
    initializeLinks,
    reset,

    // 조회
    getCurrentNodeId,
    getConnectedNodes,
    getBacklinks,

    // 상태
    isEnabled: enabled,
    hasGraph: !!graph,
    isInitialized: initializedRef.current,
  }
}

// ============================================
// 자동 동기화 훅
// ============================================

/**
 * 콘텐츠 변경 시 자동으로 Graph 동기화
 */
export function useAutoPropertiesSync(
  content: string,
  options: {
    fileId?: string
    filePath?: string
    fileName?: string
    enabled?: boolean
  } = {}
) {
  const { fileId, filePath, fileName, enabled = true } = options

  const {
    syncToGraph,
    initializeLinks,
    hasGraph,
    getCurrentNodeId
  } = usePropertiesSync({ fileId, filePath, fileName, enabled })

  const prevContentRef = useRef<string>('')
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !hasGraph) {
      console.log('[AutoSync] Disabled or no graph', { enabled, hasGraph })
      return
    }

    const nodeId = getCurrentNodeId()

    // 초기화 (첫 로드 시)
    if (!hasInitializedRef.current && content) {
      console.log('[AutoSync] Initializing...')
      initializeLinks(content)
      hasInitializedRef.current = true
      prevContentRef.current = content

      // 초기 동기화도 실행 (기존 링크에 대한 edge 생성)
      if (nodeId) {
        syncToGraph(content, nodeId)
      }
      return
    }

    // 콘텐츠 변경 감지
    if (content !== prevContentRef.current) {
      console.log('[AutoSync] Content changed, syncing...')

      if (nodeId) {
        syncToGraph(content, nodeId)
      } else {
        console.log('[AutoSync] No node ID found, skipping sync')
      }

      prevContentRef.current = content
    }
  }, [content, enabled, hasGraph, getCurrentNodeId, initializeLinks, syncToGraph])

  // cleanup
  useEffect(() => {
    return () => {
      hasInitializedRef.current = false
    }
  }, [fileId, filePath, fileName])
}
