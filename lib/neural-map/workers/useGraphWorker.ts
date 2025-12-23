/**
 * Graph Worker Hook
 * Provides async graph building via Web Worker
 * SSR-safe implementation
 */

import { useCallback, useRef } from 'react'
import type { NeuralFile, NeuralGraph } from '../types'

export interface GraphWorkerResult {
  graph: NeuralGraph
  stats: {
    nodeCount: number
    edgeCount: number
    elapsed: number
  }
}

export interface GraphWorkerError {
  success: false
  error: string
}

let workerInstance: Worker | null = null

function getWorker(): Worker | null {
  // SSR guard
  if (typeof window === 'undefined') {
    return null
  }

  if (!workerInstance) {
    // Create worker with inline script URL
    const workerCode = `
      const generateId = () => 'node-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      const normalizePath = (path) =>
        path && typeof path === 'string'
          ? path.replace(/\\\\+/g, '/').replace(/^\\/+/, '') || undefined
          : undefined;

      function buildGraph(input) {
        const startTime = performance.now();
        const { files, themeId, projectPath, linkedProjectName } = input;

        // 프로젝트명 결정: linkedProjectName > projectPath 폴더명 > 'My Project'
        const getProjectName = () => {
          if (linkedProjectName) return linkedProjectName;
          if (projectPath) {
            const parts = projectPath.replace(/\\\\/g, '/').split('/');
            return parts[parts.length - 1] || parts[parts.length - 2] || 'My Project';
          }
          return 'My Project';
        };

        if (!files || files.length === 0) {
          const projectName = getProjectName();
          const rootNode = {
            id: 'node-root',
            type: 'self',
            title: projectName,
            summary: '빈 프로젝트',
            tags: ['project'],
            importance: 10,
            expanded: true,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return {
            graph: {
              version: '2.0',
              userId: '',
              rootNodeId: rootNode.id,
              title: projectName,
              nodes: [rootNode],
              edges: [],
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
            },
            stats: { nodeCount: 1, edgeCount: 0, elapsed: Math.round(performance.now() - startTime) }
          };
        }

        const edgeTracker = new Set();
        const projectName = getProjectName();

        const addUniqueEdge = (edge, edges) => {
          const pairId = [edge.source, edge.target].sort().join('-');
          if (edge.type === 'parent_child' || !edgeTracker.has(pairId)) {
            edges.push(edge);
            if (edge.type !== 'parent_child') edgeTracker.add(pairId);
            return true;
          }
          return false;
        };

        const resolvePath = (fromPath, importPath, fileNodeMap) => {
          if (!importPath) return null;
          if (importPath.startsWith('.')) {
            const fromDir = fromPath.includes('/') ? fromPath.substring(0, fromPath.lastIndexOf('/')) : '';
            const parts = fromDir ? fromDir.split('/') : [];
            const importParts = importPath.split('/');
            for (const part of importParts) {
              if (part === '.') continue;
              if (part === '..') parts.pop();
              else parts.push(part);
            }
            const resolved = parts.join('/');
            const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py'];
            for (const ext of extensions) {
              if (fileNodeMap.has(resolved + ext)) return resolved + ext;
              if (fileNodeMap.has(resolved + '/index' + ext)) return resolved + '/index' + ext;
            }
          } else {
            const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py'];
            for (const ext of extensions) {
              if (fileNodeMap.has(importPath + ext)) return importPath + ext;
              if (fileNodeMap.has(projectName + '/' + importPath + ext))
                return projectName + '/' + importPath + ext;
            }
          }
          return null;
        };

        const rootNode = {
          id: 'node-root',
          type: 'self',
          title: projectName,
          summary: files.length + '개 파일',
          tags: ['project'],
          importance: 10,
          expanded: true,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const nodes = [rootNode];
        const edges = [];
        const folderMap = new Map();
        folderMap.set('', rootNode.id);
        const fileNodeMap = new Map();

        // Collect folders
        const allFolderPaths = new Set();
        files.forEach((file) => {
          const filePath = normalizePath(file.path) || file.name;
          const parts = filePath.split('/');
          for (let i = 1; i < parts.length; i++) {
            allFolderPaths.add(parts.slice(0, i).join('/'));
          }
        });

        // Create folder nodes
        Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length)
          .forEach((folderPath) => {
            if (folderPath === projectName) {
              folderMap.set(folderPath, rootNode.id);
              return;
            }
            const folderId = generateId();
            const folderName = folderPath.split('/').pop() || folderPath;
            const parentPath = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : '';
            nodes.push({
              id: folderId, type: 'folder', title: folderName, summary: '폴더: ' + folderPath,
              tags: ['folder'], importance: 7, parentId: folderMap.get(parentPath) || rootNode.id,
              expanded: true, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            });
            folderMap.set(folderPath, folderId);
            addUniqueEdge({
              id: generateId(), source: folderMap.get(parentPath) || rootNode.id, target: folderId,
              type: 'parent_child', weight: 0.1, bidirectional: false, createdAt: new Date().toISOString(),
            }, edges);
          });

        // Create file nodes
        files.forEach((file) => {
          const fileId = generateId();
          const filePath = normalizePath(file.path) || file.name;
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const fileType = ['tsx', 'ts', 'js', 'jsx'].includes(ext) ? 'code' :
            ext === 'css' || ext === 'scss' ? 'style' : ext === 'json' || ext === 'env' ? 'config' : ext === 'md' ? 'doc' : 'file';
          const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
          const parentId = folderMap.get(parentPath) || rootNode.id;
          nodes.push({
            id: fileId, type: fileType, title: file.name, summary: filePath,
            tags: [ext, fileType], importance: 5, parentId, expanded: true, pinned: false,
            createdAt: file.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
            sourceRef: { fileId: file.id, kind: file.type }
          });
          fileNodeMap.set(filePath, fileId);
          addUniqueEdge({
            id: generateId(), source: parentId, target: fileId, type: 'parent_child',
            weight: 0.1, bidirectional: false, createdAt: new Date().toISOString(),
          }, edges);
        });

        // Parse selectors
        const htmlSelectors = new Map();
        const cssSelectors = new Map();
        files.forEach((file) => {
          const content = file.content || '';
          if (!content) return;
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const filePath = normalizePath(file.path) || file.name;
          if (ext === 'html' || ext === 'htm') {
            const sels = new Set();
            let m;
            const idRegex = /id=["']([^"']+)["']/gi;
            const classRegex = /class=["']([^"']+)["']/gi;
            while ((m = idRegex.exec(content))) sels.add(m[1]);
            while ((m = classRegex.exec(content))) m[1].split(/\\s+/).forEach((c) => c && sels.add(c));
            if (sels.size > 0) htmlSelectors.set(filePath, sels);
          } else if (ext === 'css' || ext === 'scss') {
            const sels = new Set();
            let m;
            const classRegex = /\\.([a-zA-Z0-9_-]+)/g;
            const idRegex = /#([a-zA-Z0-9_-]+)/g;
            while ((m = classRegex.exec(content))) sels.add(m[1]);
            while ((m = idRegex.exec(content))) sels.add(m[1]);
            if (sels.size > 0) cssSelectors.set(filePath, sels);
          }
        });

        // Create import edges
        files.forEach((file) => {
          const content = file.content || '';
          if (!content) return;
          const filePath = normalizePath(file.path) || file.name;
          const sourceId = fileNodeMap.get(filePath);
          if (!sourceId) return;
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
            const jsImportRegex = /(?:import|from|require)\\s*\\(?\\s*['"]([^'"]+)['"]\\s*\\)?/g;
            let m;
            while ((m = jsImportRegex.exec(content))) {
              const targetPath = resolvePath(filePath, m[1], fileNodeMap);
              if (targetPath && fileNodeMap.has(targetPath)) {
                addUniqueEdge({
                  id: generateId(), source: sourceId, target: fileNodeMap.get(targetPath),
                  type: 'imports', label: 'import', weight: 0.8, bidirectional: false, createdAt: new Date().toISOString()
                }, edges);
              }
            }
            htmlSelectors.forEach((sels, hPath) => {
              const tId = fileNodeMap.get(hPath);
              if (!tId || tId === sourceId) return;
              for (const s of Array.from(sels)) if (content.includes(s)) {
                addUniqueEdge({
                  id: generateId(), source: sourceId, target: tId, type: 'semantic', label: 'functional',
                  weight: 0.3, bidirectional: true, createdAt: new Date().toISOString()
                }, edges);
                break;
              }
            });
          }
          if (ext === 'html' || ext === 'htm') {
            cssSelectors.forEach((sels, cPath) => {
              const tId = fileNodeMap.get(cPath);
              if (!tId || tId === sourceId) return;
              const htmlSels = htmlSelectors.get(filePath);
              if (!htmlSels) return;
              for (const s of Array.from(sels)) if (htmlSels.has(s)) {
                addUniqueEdge({
                  id: generateId(), source: sourceId, target: tId, type: 'semantic', label: 'style',
                  weight: 0.5, bidirectional: true, createdAt: new Date().toISOString()
                }, edges);
                break;
              }
            });
          }
        });

        const graphData = {
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
        };

        return {
          graph: graphData,
          stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            elapsed: Math.round(performance.now() - startTime),
          },
        };
      }

      self.onmessage = (e) => {
        try {
          const result = buildGraph(e.data);
          self.postMessage({ success: true, ...result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message || 'Unknown error' });
        }
      };
    `
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    workerInstance = new Worker(url)
  }
  return workerInstance
}

export function buildGraphAsync(
  files: NeuralFile[],
  themeId?: string,
  projectPath?: string | null,
  linkedProjectName?: string | null
): Promise<GraphWorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()

    // SSR fallback - reject so store falls back to sync version
    if (!worker) {
      reject(new Error('Worker not available (SSR)'))
      return
    }

    const handler = (e: MessageEvent) => {
      worker.removeEventListener('message', handler)
      if (e.data.success) {
        resolve({
          graph: e.data.graph,
          stats: e.data.stats,
        })
      } else {
        reject(new Error(e.data.error || 'Graph building failed'))
      }
    }

    worker.addEventListener('message', handler)

    // Send files to worker (without non-transferable properties)
    const transferableFiles = files.map((f) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      type: f.type,
      createdAt: f.createdAt,
      content: (f as any).content,
    }))

    worker.postMessage({ files: transferableFiles, themeId, projectPath, linkedProjectName })
  })
}

export function useGraphWorker() {
  const pendingRef = useRef<AbortController | null>(null)

  const buildGraph = useCallback(
    async (
      files: NeuralFile[],
      themeId?: string
    ): Promise<GraphWorkerResult> => {
      // Cancel any pending build
      if (pendingRef.current) {
        pendingRef.current.abort()
      }

      const controller = new AbortController()
      pendingRef.current = controller

      try {
        const result = await buildGraphAsync(files, themeId)
        if (controller.signal.aborted) {
          throw new Error('Build cancelled')
        }
        return result
      } finally {
        if (pendingRef.current === controller) {
          pendingRef.current = null
        }
      }
    },
    []
  )

  const cancel = useCallback(() => {
    if (pendingRef.current) {
      pendingRef.current.abort()
      pendingRef.current = null
    }
  }, [])

  return { buildGraph, cancel }
}

export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }
}
