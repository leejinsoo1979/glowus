/**
 * Graph Builder Web Worker
 * Offloads heavy graph construction from main thread
 */

import type { NeuralNode, NeuralEdge, NeuralGraph, NeuralFile } from '../types'

export interface GraphBuilderInput {
  files: NeuralFile[]
  themeId?: string
}

export interface GraphBuilderOutput {
  graph: NeuralGraph
  stats: {
    nodeCount: number
    edgeCount: number
    elapsed: number
  }
}

const generateId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const normalizePath = (path?: string) =>
  path && typeof path === 'string'
    ? path.replace(/\\+/g, '/').replace(/^\/+/, '') || undefined
    : undefined

function buildGraph(input: GraphBuilderInput): GraphBuilderOutput {
  const startTime = performance.now()
  const { files, themeId } = input

  if (!files || files.length === 0) {
    return {
      graph: {
        version: '2.0',
        userId: '',
        rootNodeId: '',
        title: 'Empty Project',
        nodes: [],
        edges: [],
        clusters: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewState: {
          activeTab: 'map' as const,
          expandedNodeIds: [],
          pinnedNodeIds: [],
          selectedNodeIds: [],
          cameraPosition: { x: 0, y: 0, z: 0 },
          cameraTarget: { x: 0, y: 0, z: 0 },
        },
        themeId: themeId || 'cosmic-dark',
      },
      stats: { nodeCount: 0, edgeCount: 0, elapsed: 0 }
    }
  }

  const edgeTracker = new Set<string>()
  const firstPath = files[0]?.path || files[0]?.name
  const projectName = firstPath?.split('/')[0] || 'My Project'

  const addUniqueEdge = (edge: NeuralEdge, edges: NeuralEdge[]) => {
    const pairId = [edge.source, edge.target].sort().join('-')
    if (edge.type === 'parent_child' || !edgeTracker.has(pairId)) {
      edges.push(edge)
      if (edge.type !== 'parent_child') edgeTracker.add(pairId)
      return true
    }
    return false
  }

  const resolvePath = (
    fromPath: string,
    importPath: string,
    fileNodeMap: Map<string, string>
  ): string | null => {
    if (!importPath) return null

    if (importPath.startsWith('.')) {
      const fromDir = fromPath.includes('/')
        ? fromPath.substring(0, fromPath.lastIndexOf('/'))
        : ''
      const parts = fromDir ? fromDir.split('/') : []
      const importParts = importPath.split('/')

      for (const part of importParts) {
        if (part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
      }

      const resolved = parts.join('/')
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py']

      for (const ext of extensions) {
        if (fileNodeMap.has(resolved + ext)) return resolved + ext
        if (fileNodeMap.has(resolved + '/index' + ext)) return resolved + '/index' + ext
      }
    } else {
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py']
      for (const ext of extensions) {
        if (fileNodeMap.has(importPath + ext)) return importPath + ext
        if (fileNodeMap.has(projectName + '/' + importPath + ext))
          return projectName + '/' + importPath + ext
      }
    }
    return null
  }

  // Create root node
  const rootNode: NeuralNode = {
    id: 'node-root',
    type: 'self',
    title: projectName,
    summary: `${files.length}개 파일`,
    tags: ['project'],
    importance: 10,
    expanded: true,
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const nodes: NeuralNode[] = [rootNode]
  const edges: NeuralEdge[] = []
  const folderMap = new Map<string, string>()
  folderMap.set('', rootNode.id)
  const fileNodeMap = new Map<string, string>()

  // Collect all folder paths
  const allFolderPaths = new Set<string>()
  files.forEach((file: NeuralFile) => {
    const filePath = normalizePath(file.path) || file.name
    const parts = filePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      allFolderPaths.add(parts.slice(0, i).join('/'))
    }
  })

  // Create folder nodes (sorted by depth)
  Array.from(allFolderPaths)
    .sort((a, b) => a.split('/').length - b.split('/').length)
    .forEach((folderPath) => {
      if (folderPath === projectName) {
        folderMap.set(folderPath, rootNode.id)
        return
      }

      const folderId = generateId()
      const folderName = folderPath.split('/').pop() || folderPath
      const parentPath = folderPath.includes('/')
        ? folderPath.substring(0, folderPath.lastIndexOf('/'))
        : ''

      nodes.push({
        id: folderId,
        type: 'folder' as any,
        title: folderName,
        summary: `폴더: ${folderPath}`,
        tags: ['folder'],
        importance: 7,
        parentId: folderMap.get(parentPath) || rootNode.id,
        expanded: true,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      folderMap.set(folderPath, folderId)

      addUniqueEdge(
        {
          id: generateId(),
          source: folderMap.get(parentPath) || rootNode.id,
          target: folderId,
          type: 'parent_child',
          weight: 0.1,
          bidirectional: false,
          createdAt: new Date().toISOString(),
        },
        edges
      )
    })

  // Create file nodes
  files.forEach((file: NeuralFile) => {
    const fileId = generateId()
    const filePath = normalizePath(file.path) || file.name
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    const fileType =
      ['tsx', 'ts', 'js', 'jsx'].includes(ext)
        ? 'code'
        : ext === 'css' || ext === 'scss'
        ? 'style'
        : ext === 'json' || ext === 'env'
        ? 'config'
        : ext === 'md'
        ? 'doc'
        : 'file'

    const parentPath = filePath.includes('/')
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : ''
    const parentId = folderMap.get(parentPath) || rootNode.id

    nodes.push({
      id: fileId,
      type: fileType as any,
      title: file.name,
      summary: filePath,
      tags: [ext, fileType],
      importance: 5,
      parentId,
      expanded: true,
      pinned: false,
      createdAt: file.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceRef: { fileId: file.id, kind: file.type as any },
    })

    fileNodeMap.set(filePath, fileId)

    addUniqueEdge(
      {
        id: generateId(),
        source: parentId,
        target: fileId,
        type: 'parent_child',
        weight: 0.1,
        bidirectional: false,
        createdAt: new Date().toISOString(),
      },
      edges
    )
  })

  // Parse HTML/CSS selectors for relationship detection
  const htmlSelectors = new Map<string, Set<string>>()
  const cssSelectors = new Map<string, Set<string>>()

  files.forEach((file: NeuralFile) => {
    const content = (file as any).content || ''
    if (!content) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const filePath = normalizePath(file.path) || file.name

    if (ext === 'html' || ext === 'htm') {
      const idRegex = /id=["']([^"']+)["']/gi
      const classRegex = /class=["']([^"']+)["']/gi
      const sels = new Set<string>()
      let m
      while ((m = idRegex.exec(content))) sels.add(m[1])
      while ((m = classRegex.exec(content)))
        m[1].split(/\s+/).forEach((c: string) => c && sels.add(c))
      if (sels.size > 0) htmlSelectors.set(filePath, sels)
    } else if (ext === 'css' || ext === 'scss') {
      const classRegex = /\.([a-zA-Z0-9_-]+)/g
      const idRegex = /#([a-zA-Z0-9_-]+)/g
      const sels = new Set<string>()
      let m
      while ((m = classRegex.exec(content))) sels.add(m[1])
      while ((m = idRegex.exec(content))) sels.add(m[1])
      if (sels.size > 0) cssSelectors.set(filePath, sels)
    }
  })

  // Create import/reference edges
  files.forEach((file: NeuralFile) => {
    const content = (file as any).content || ''
    if (!content) return
    const filePath = normalizePath(file.path) || file.name
    const sourceId = fileNodeMap.get(filePath)
    if (!sourceId) return

    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      // Parse JS/TS imports
      const jsImportRegex = /(?:import|from|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g
      let m
      while ((m = jsImportRegex.exec(content))) {
        const targetPath = resolvePath(filePath, m[1], fileNodeMap)
        if (targetPath && fileNodeMap.has(targetPath)) {
          addUniqueEdge(
            {
              id: generateId(),
              source: sourceId,
              target: fileNodeMap.get(targetPath)!,
              type: 'imports',
              label: 'import',
              weight: 0.8,
              bidirectional: false,
              createdAt: new Date().toISOString(),
            },
            edges
          )
        }
      }

      // Check HTML selector references
      htmlSelectors.forEach((sels, hPath) => {
        const tId = fileNodeMap.get(hPath)
        if (!tId || tId === sourceId) return
        for (const s of Array.from(sels)) {
          if (content.includes(s)) {
            addUniqueEdge(
              {
                id: generateId(),
                source: sourceId,
                target: tId,
                type: 'semantic',
                label: 'functional',
                weight: 0.3,
                bidirectional: true,
                createdAt: new Date().toISOString(),
              },
              edges
            )
            break
          }
        }
      })
    }

    if (ext === 'html' || ext === 'htm') {
      // Check CSS selector references
      cssSelectors.forEach((sels, cPath) => {
        const tId = fileNodeMap.get(cPath)
        if (!tId || tId === sourceId) return
        const htmlSels = htmlSelectors.get(filePath)
        if (!htmlSels) return
        for (const s of Array.from(sels)) {
          if (htmlSels.has(s)) {
            addUniqueEdge(
              {
                id: generateId(),
                source: sourceId,
                target: tId,
                type: 'semantic',
                label: 'style',
                weight: 0.5,
                bidirectional: true,
                createdAt: new Date().toISOString(),
              },
              edges
            )
            break
          }
        }
      })
    }
  })

  const graphData: NeuralGraph = {
    version: '2.0',
    userId: '',
    rootNodeId: rootNode.id,
    title: projectName,
    nodes,
    edges,
    clusters: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewState: {
      activeTab: 'map',
      expandedNodeIds: [rootNode.id],
      pinnedNodeIds: [],
      selectedNodeIds: [],
      cameraPosition: { x: 0, y: 0, z: 0 },
      cameraTarget: { x: 0, y: 0, z: 0 },
    },
    themeId: themeId || 'cosmic-dark',
  }

  const elapsed = performance.now() - startTime

  return {
    graph: graphData,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      elapsed: Math.round(elapsed),
    },
  }
}

// Worker message handler
self.onmessage = (e: MessageEvent<GraphBuilderInput>) => {
  try {
    const result = buildGraph(e.data)
    self.postMessage({ success: true, ...result })
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export {}
