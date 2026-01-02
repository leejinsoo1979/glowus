/**
 * Architecture Analyzer v2.0
 * 프로젝트 코드를 심층 분석하여 시스템 아키텍처를 역설계
 *
 * Features:
 * - 실제 파일 의존성 그래프 구축
 * - 컴포넌트 계층 구조 분석
 * - 데이터 흐름 추적
 * - 패턴 인식 및 분류
 */

import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

// ============================================
// Types
// ============================================

export type FrameworkType =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'angular'
  | 'express'
  | 'fastapi'
  | 'django'
  | 'electron'
  | 'unknown'

export type LayerType =
  | 'presentation'  // UI, Components, Pages
  | 'application'   // API Routes, Controllers
  | 'domain'        // Business Logic, Services
  | 'infrastructure' // Database, External Services
  | 'shared'        // Utils, Types, Constants

export type ComponentType =
  | 'page'
  | 'component'
  | 'api-route'
  | 'service'
  | 'hook'
  | 'utility'
  | 'type'
  | 'config'
  | 'database'
  | 'external-service'
  | 'state-management'
  | 'middleware'

export interface FileNode {
  id: string
  path: string
  name: string
  type: ComponentType
  layer: LayerType
  exports: ExportInfo[]
  imports: ImportInfo[]
  dependencies: string[]  // File IDs this depends on
  dependents: string[]    // File IDs that depend on this
  metadata: {
    linesOfCode: number
    hasDefaultExport: boolean
    isReactComponent: boolean
    hasHooks: boolean
    apiMethods?: string[]  // GET, POST, etc.
    stateManagement?: string[]  // useState, useReducer, zustand, etc.
  }
}

export interface ImportInfo {
  source: string
  resolvedPath: string | null
  specifiers: string[]
  isExternal: boolean
  isRelative: boolean
  isDynamic: boolean
}

export interface ExportInfo {
  name: string
  type: 'function' | 'class' | 'variable' | 'type' | 'default'
  isAsync: boolean
}

export interface ArchitectureComponent {
  id: string
  name: string
  type: ComponentType
  layer: LayerType
  technology: string
  description?: string
  files: string[]  // File paths belonging to this component
  endpoints?: string[]
  dependencies: string[]
  metadata?: Record<string, unknown>
}

export interface ArchitectureConnection {
  id: string
  source: string
  target: string
  label?: string
  type: 'imports' | 'calls' | 'renders' | 'uses' | 'extends' | 'data-flow'
  weight: number  // Connection strength (number of imports/calls)
  metadata?: {
    specifiers?: string[]
    bidirectional?: boolean
  }
}

export interface LayerGroup {
  id: string
  layer: LayerType
  label: string
  description: string
  files: FileNode[]
  components: ArchitectureComponent[]
}

export interface DataFlowPath {
  id: string
  name: string
  description: string
  nodes: string[]  // Component IDs in order
  type: 'request' | 'response' | 'state' | 'event'
}

export interface ArchitectureAnalysis {
  projectName: string
  framework: FrameworkType
  files: FileNode[]
  components: ArchitectureComponent[]
  connections: ArchitectureConnection[]
  layers: LayerGroup[]
  dataFlows: DataFlowPath[]
  patterns: DetectedPattern[]
  metrics: ArchitectureMetrics
  metadata: {
    analyzedAt: string
    fileCount: number
    totalLinesOfCode: number
    apiEndpoints: number
    externalServices: string[]
    databases: string[]
  }
}

export interface DetectedPattern {
  name: string
  type: 'architecture' | 'design' | 'anti-pattern'
  description: string
  files: string[]
  confidence: number  // 0-1
}

export interface ArchitectureMetrics {
  modularity: number  // 0-1
  cohesion: number    // 0-1
  coupling: number    // 0-1 (lower is better)
  complexity: number  // Cyclomatic-like score
  depth: number       // Max dependency depth
}

export interface FileInfo {
  path: string
  content: string
  type: 'file' | 'folder'
}

// ============================================
// Framework Detection
// ============================================

export function detectFramework(packageJson: Record<string, unknown>): FrameworkType {
  const deps = {
    ...((packageJson.dependencies as Record<string, string>) || {}),
    ...((packageJson.devDependencies as Record<string, string>) || {}),
  }

  // Check for Electron first (can be combined with React/Next)
  const hasElectron = !!deps['electron']

  if (deps['next']) return hasElectron ? 'electron' : 'nextjs'
  if (deps['@angular/core']) return 'angular'
  if (deps['vue']) return 'vue'
  if (deps['react'] && !deps['next']) return hasElectron ? 'electron' : 'react'
  if (deps['express']) return 'express'
  if (deps['fastapi']) return 'fastapi'
  if (deps['django']) return 'django'

  return 'unknown'
}

// ============================================
// External Service Detection
// ============================================

const EXTERNAL_SERVICES: Record<string, { name: string; type: ComponentType; category: string }> = {
  '@supabase/supabase-js': { name: 'Supabase', type: 'database', category: 'BaaS' },
  '@supabase/ssr': { name: 'Supabase SSR', type: 'database', category: 'BaaS' },
  'openai': { name: 'OpenAI', type: 'external-service', category: 'AI' },
  '@anthropic-ai/sdk': { name: 'Anthropic Claude', type: 'external-service', category: 'AI' },
  '@langchain/anthropic': { name: 'LangChain (Anthropic)', type: 'external-service', category: 'AI' },
  '@langchain/openai': { name: 'LangChain (OpenAI)', type: 'external-service', category: 'AI' },
  '@google/generative-ai': { name: 'Google Gemini', type: 'external-service', category: 'AI' },
  '@ai-sdk/google': { name: 'Vercel AI SDK (Google)', type: 'external-service', category: 'AI' },
  '@ai-sdk/openai': { name: 'Vercel AI SDK (OpenAI)', type: 'external-service', category: 'AI' },
  '@ai-sdk/anthropic': { name: 'Vercel AI SDK (Anthropic)', type: 'external-service', category: 'AI' },
  'ai': { name: 'Vercel AI SDK', type: 'external-service', category: 'AI' },
  'mongoose': { name: 'MongoDB', type: 'database', category: 'Database' },
  'pg': { name: 'PostgreSQL', type: 'database', category: 'Database' },
  'mysql2': { name: 'MySQL', type: 'database', category: 'Database' },
  'redis': { name: 'Redis', type: 'database', category: 'Cache' },
  'ioredis': { name: 'Redis', type: 'database', category: 'Cache' },
  'aws-sdk': { name: 'AWS SDK', type: 'external-service', category: 'Cloud' },
  '@aws-sdk/client-s3': { name: 'AWS S3', type: 'external-service', category: 'Storage' },
  'firebase': { name: 'Firebase', type: 'database', category: 'BaaS' },
  'firebase-admin': { name: 'Firebase Admin', type: 'database', category: 'BaaS' },
  'stripe': { name: 'Stripe', type: 'external-service', category: 'Payment' },
  'twilio': { name: 'Twilio', type: 'external-service', category: 'Communication' },
  'sendgrid': { name: 'SendGrid', type: 'external-service', category: 'Email' },
  'resend': { name: 'Resend', type: 'external-service', category: 'Email' },
  '@tavily/core': { name: 'Tavily Search', type: 'external-service', category: 'Search' },
  'replicate': { name: 'Replicate', type: 'external-service', category: 'AI' },
  'electron': { name: 'Electron', type: 'component', category: 'Desktop' },
  'zustand': { name: 'Zustand', type: 'state-management', category: 'State' },
  'redux': { name: 'Redux', type: 'state-management', category: 'State' },
  '@reduxjs/toolkit': { name: 'Redux Toolkit', type: 'state-management', category: 'State' },
  'jotai': { name: 'Jotai', type: 'state-management', category: 'State' },
  'recoil': { name: 'Recoil', type: 'state-management', category: 'State' },
  'prisma': { name: 'Prisma', type: 'database', category: 'ORM' },
  '@prisma/client': { name: 'Prisma', type: 'database', category: 'ORM' },
  'drizzle-orm': { name: 'Drizzle ORM', type: 'database', category: 'ORM' },
  'reactflow': { name: 'React Flow', type: 'component', category: 'Visualization' },
  'three': { name: 'Three.js', type: 'component', category: '3D' },
  '@react-three/fiber': { name: 'React Three Fiber', type: 'component', category: '3D' },
}

export function detectExternalServices(packageJson: Record<string, unknown>): ArchitectureComponent[] {
  const deps = {
    ...((packageJson.dependencies as Record<string, string>) || {}),
    ...((packageJson.devDependencies as Record<string, string>) || {}),
  }

  const services: ArchitectureComponent[] = []
  const seen = new Set<string>()

  for (const [pkg, info] of Object.entries(EXTERNAL_SERVICES)) {
    if (deps[pkg] && !seen.has(info.name)) {
      seen.add(info.name)
      services.push({
        id: `ext-${info.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: info.name,
        type: info.type,
        layer: 'infrastructure',
        technology: pkg,
        description: `${info.category}: ${info.name}`,
        files: [],
        dependencies: [],
        metadata: { category: info.category, package: pkg },
      })
    }
  }

  return services
}

// ============================================
// AST-Based Code Analysis
// ============================================

interface ParseResult {
  imports: ImportInfo[]
  exports: ExportInfo[]
  isReactComponent: boolean
  hasHooks: boolean
  apiMethods: string[]
  stateManagement: string[]
  functionCalls: string[]
  linesOfCode: number
}

function parseFile(content: string, filePath: string): ParseResult {
  const result: ParseResult = {
    imports: [],
    exports: [],
    isReactComponent: false,
    hasHooks: false,
    apiMethods: [],
    stateManagement: [],
    functionCalls: [],
    linesOfCode: content.split('\n').length,
  }

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      errorRecovery: true,
    })

    const hookPatterns = /^use[A-Z]/
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']

    traverse(ast, {
      // Import Analysis
      ImportDeclaration(path) {
        const source = path.node.source.value
        const specifiers = path.node.specifiers.map(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            return spec.local.name
          } else if (spec.type === 'ImportSpecifier') {
            return t.isIdentifier(spec.imported) ? spec.imported.name : String(spec.imported.value)
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            return `* as ${spec.local.name}`
          }
          return ''
        }).filter(Boolean)

        // Check for hooks
        if (specifiers.some(s => hookPatterns.test(s))) {
          result.hasHooks = true
        }

        // Check for state management
        if (source.includes('zustand') || source.includes('redux') || source.includes('jotai') || source.includes('recoil')) {
          result.stateManagement.push(source)
        }

        // Check for React
        if (source === 'react' && specifiers.some(s => s === 'useState' || s === 'useEffect' || s === 'useContext')) {
          result.hasHooks = true
        }

        result.imports.push({
          source,
          resolvedPath: resolveImportPath(source, filePath),
          specifiers,
          isExternal: !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/'),
          isRelative: source.startsWith('.'),
          isDynamic: false,
        })
      },

      // Dynamic imports
      CallExpression(path) {
        if (path.node.callee.type === 'Import' && path.node.arguments[0]?.type === 'StringLiteral') {
          const source = path.node.arguments[0].value
          result.imports.push({
            source,
            resolvedPath: resolveImportPath(source, filePath),
            specifiers: ['dynamic'],
            isExternal: !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/'),
            isRelative: source.startsWith('.'),
            isDynamic: true,
          })
        }

        // Track function calls for data flow
        if (path.node.callee.type === 'Identifier') {
          result.functionCalls.push(path.node.callee.name)
        } else if (path.node.callee.type === 'MemberExpression' && path.node.callee.property.type === 'Identifier') {
          result.functionCalls.push(path.node.callee.property.name)
        }
      },

      // Export Analysis
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            const name = path.node.declaration.id.name
            result.exports.push({
              name,
              type: 'function',
              isAsync: path.node.declaration.async,
            })

            // Check for API methods
            if (httpMethods.includes(name)) {
              result.apiMethods.push(name)
            }
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(decl => {
              if (t.isIdentifier(decl.id)) {
                const name = decl.id.name
                result.exports.push({
                  name,
                  type: 'variable',
                  isAsync: false,
                })

                // Check for API methods
                if (httpMethods.includes(name)) {
                  result.apiMethods.push(name)
                }
              }
            })
          } else if (t.isTSTypeAliasDeclaration(path.node.declaration) || t.isTSInterfaceDeclaration(path.node.declaration)) {
            if (path.node.declaration.id) {
              result.exports.push({
                name: path.node.declaration.id.name,
                type: 'type',
                isAsync: false,
              })
            }
          }
        }
      },

      ExportDefaultDeclaration(path) {
        let name = 'default'
        let type: ExportInfo['type'] = 'default'
        let isAsync = false

        if (t.isFunctionDeclaration(path.node.declaration)) {
          name = path.node.declaration.id?.name || 'default'
          type = 'function'
          isAsync = path.node.declaration.async
        } else if (t.isClassDeclaration(path.node.declaration)) {
          name = path.node.declaration.id?.name || 'default'
          type = 'class'
        }

        result.exports.push({ name, type, isAsync })
      },

      // React Component Detection
      JSXElement() {
        result.isReactComponent = true
      },

      JSXFragment() {
        result.isReactComponent = true
      },
    })
  } catch (e) {
    console.warn(`Failed to parse ${filePath}:`, e)
  }

  return result
}

function resolveImportPath(source: string, currentFile: string): string | null {
  if (source.startsWith('.')) {
    // Relative import
    const dir = currentFile.split('/').slice(0, -1).join('/')
    const parts = source.split('/')
    let resolvedDir = dir

    for (const part of parts) {
      if (part === '.') continue
      if (part === '..') {
        resolvedDir = resolvedDir.split('/').slice(0, -1).join('/')
      } else {
        resolvedDir = `${resolvedDir}/${part}`
      }
    }

    return resolvedDir
  }

  if (source.startsWith('@/')) {
    // Alias import (common in Next.js)
    return source.replace('@/', '')
  }

  // External package
  return null
}

// ============================================
// File Classification
// ============================================

function classifyFile(filePath: string, parseResult: ParseResult): { type: ComponentType; layer: LayerType } {
  const path = filePath.toLowerCase()
  const filename = path.split('/').pop() || ''

  // API Routes
  if (path.includes('/api/') && (filename === 'route.ts' || filename === 'route.js')) {
    return { type: 'api-route', layer: 'application' }
  }

  // Pages
  if ((path.includes('/app/') || path.includes('/pages/')) && !path.includes('/api/')) {
    if (filename === 'page.tsx' || filename === 'page.jsx' || filename === 'page.ts' || filename === 'page.js') {
      return { type: 'page', layer: 'presentation' }
    }
    if (filename === 'layout.tsx' || filename === 'layout.jsx') {
      return { type: 'page', layer: 'presentation' }
    }
  }

  // Components
  if (path.includes('/components/') || parseResult.isReactComponent) {
    return { type: 'component', layer: 'presentation' }
  }

  // Hooks
  if (path.includes('/hooks/') || filename.startsWith('use')) {
    return { type: 'hook', layer: 'shared' }
  }

  // Services
  if (path.includes('/services/') || path.includes('/lib/ai/') || path.includes('/lib/memory/')) {
    return { type: 'service', layer: 'domain' }
  }

  // Utilities
  if (path.includes('/utils/') || path.includes('/helpers/') || filename === 'utils.ts') {
    return { type: 'utility', layer: 'shared' }
  }

  // Types
  if (path.includes('/types/') || filename.endsWith('.d.ts') || parseResult.exports.every(e => e.type === 'type')) {
    return { type: 'type', layer: 'shared' }
  }

  // Config
  if (filename.includes('config') || filename.includes('.config.')) {
    return { type: 'config', layer: 'shared' }
  }

  // Middleware
  if (filename === 'middleware.ts' || filename === 'middleware.js' || path.includes('/middleware/')) {
    return { type: 'middleware', layer: 'application' }
  }

  // Database related
  if (path.includes('/lib/supabase') || path.includes('/lib/db') || path.includes('/database/')) {
    return { type: 'database', layer: 'infrastructure' }
  }

  // State management
  if (path.includes('/store/') || path.includes('/stores/') || filename.includes('store')) {
    return { type: 'state-management', layer: 'domain' }
  }

  // Default based on content
  if (parseResult.isReactComponent) {
    return { type: 'component', layer: 'presentation' }
  }

  return { type: 'utility', layer: 'shared' }
}

// ============================================
// Dependency Graph Builder
// ============================================

function buildDependencyGraph(files: FileNode[]): void {
  const filePathMap = new Map<string, FileNode>()

  // Build path lookup
  for (const file of files) {
    filePathMap.set(file.path, file)
    // Also add without extension
    const withoutExt = file.path.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '')
    filePathMap.set(withoutExt, file)
  }

  // Resolve dependencies
  for (const file of files) {
    for (const imp of file.imports) {
      if (imp.resolvedPath) {
        // Try to find the file
        const possiblePaths = [
          imp.resolvedPath,
          `${imp.resolvedPath}.ts`,
          `${imp.resolvedPath}.tsx`,
          `${imp.resolvedPath}.js`,
          `${imp.resolvedPath}.jsx`,
          `${imp.resolvedPath}/index.ts`,
          `${imp.resolvedPath}/index.tsx`,
          `${imp.resolvedPath}/index.js`,
        ]

        for (const possiblePath of possiblePaths) {
          const target = filePathMap.get(possiblePath)
          if (target && target.id !== file.id) {
            if (!file.dependencies.includes(target.id)) {
              file.dependencies.push(target.id)
            }
            if (!target.dependents.includes(file.id)) {
              target.dependents.push(file.id)
            }
            break
          }
        }
      }
    }
  }
}

// ============================================
// Component Grouping
// ============================================

function groupIntoComponents(files: FileNode[], externalServices: ArchitectureComponent[]): ArchitectureComponent[] {
  const components: ArchitectureComponent[] = []
  const componentMap = new Map<string, ArchitectureComponent>()

  // Group files by directory and type
  for (const file of files) {
    const pathParts = file.path.split('/')
    let groupKey: string

    // Determine group key based on file location and type
    if (file.type === 'api-route') {
      // Group API routes by endpoint path
      const apiPath = file.path.match(/app\/api\/(.+)\/route/)?.[1] || 'api'
      groupKey = `api-${apiPath.split('/')[0]}`
    } else if (file.type === 'page') {
      // Group pages
      groupKey = 'pages'
    } else if (file.type === 'component') {
      // Group components by parent folder
      const compPath = file.path.match(/components\/([^/]+)/)?.[1] || 'components'
      groupKey = `component-${compPath}`
    } else if (file.type === 'hook') {
      groupKey = 'hooks'
    } else if (file.type === 'service') {
      // Group services by parent folder
      const servicePath = file.path.match(/(?:services|lib)\/([^/]+)/)?.[1] || 'services'
      groupKey = `service-${servicePath}`
    } else if (file.type === 'state-management') {
      groupKey = 'state'
    } else {
      groupKey = `shared-${file.layer}`
    }

    if (!componentMap.has(groupKey)) {
      componentMap.set(groupKey, {
        id: groupKey,
        name: formatComponentName(groupKey),
        type: file.type,
        layer: file.layer,
        technology: 'TypeScript',
        files: [],
        dependencies: [],
      })
    }

    componentMap.get(groupKey)!.files.push(file.path)
  }

  // Convert map to array and add metadata
  for (const [, comp] of componentMap) {
    // Calculate component-level dependencies
    const depSet = new Set<string>()
    for (const filePath of comp.files) {
      const file = files.find(f => f.path === filePath)
      if (file) {
        for (const depId of file.dependencies) {
          const depFile = files.find(f => f.id === depId)
          if (depFile) {
            // Find which component this dependency belongs to
            for (const [key, otherComp] of componentMap) {
              if (otherComp.files.includes(depFile.path) && key !== comp.id) {
                depSet.add(key)
              }
            }
          }
        }
      }
    }
    comp.dependencies = Array.from(depSet)

    // Add API endpoints if applicable
    if (comp.type === 'api-route') {
      comp.endpoints = comp.files.map(f => {
        const match = f.match(/app\/api\/(.+)\/route/)
        return match ? `/api/${match[1]}` : f
      })
    }

    components.push(comp)
  }

  // Add external services
  components.push(...externalServices)

  return components
}

function formatComponentName(key: string): string {
  return key
    .replace(/^(api|component|service|shared)-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ============================================
// Connection Builder
// ============================================

function buildConnections(files: FileNode[], components: ArchitectureComponent[]): ArchitectureConnection[] {
  const connections: ArchitectureConnection[] = []
  const connectionMap = new Map<string, ArchitectureConnection>()

  // Build file-level connections
  for (const file of files) {
    for (const depId of file.dependencies) {
      const depFile = files.find(f => f.id === depId)
      if (!depFile) continue

      // Find components
      const sourceComp = components.find(c => c.files.includes(file.path))
      const targetComp = components.find(c => c.files.includes(depFile.path))

      if (sourceComp && targetComp && sourceComp.id !== targetComp.id) {
        const key = `${sourceComp.id}-${targetComp.id}`

        if (connectionMap.has(key)) {
          // Increment weight
          connectionMap.get(key)!.weight++
        } else {
          // Determine connection type
          let type: ArchitectureConnection['type'] = 'imports'
          if (sourceComp.layer === 'presentation' && targetComp.layer === 'presentation') {
            type = 'renders'
          } else if (sourceComp.layer === 'application' && targetComp.layer === 'domain') {
            type = 'calls'
          } else if (targetComp.layer === 'infrastructure') {
            type = 'uses'
          }

          connectionMap.set(key, {
            id: `conn-${key}`,
            source: sourceComp.id,
            target: targetComp.id,
            type,
            weight: 1,
            label: type,
          })
        }
      }
    }
  }

  // Connect components to external services based on imports
  for (const file of files) {
    for (const imp of file.imports) {
      if (imp.isExternal) {
        const extService = EXTERNAL_SERVICES[imp.source]
        if (extService) {
          const extId = `ext-${extService.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          const sourceComp = components.find(c => c.files.includes(file.path))

          if (sourceComp) {
            const key = `${sourceComp.id}-${extId}`
            if (!connectionMap.has(key)) {
              connectionMap.set(key, {
                id: `conn-${key}`,
                source: sourceComp.id,
                target: extId,
                type: 'uses',
                weight: 1,
                label: extService.category,
              })
            }
          }
        }
      }
    }
  }

  return Array.from(connectionMap.values())
}

// ============================================
// Layer Grouping
// ============================================

function buildLayerGroups(files: FileNode[], components: ArchitectureComponent[]): LayerGroup[] {
  const layerConfig: Record<LayerType, { label: string; description: string }> = {
    presentation: {
      label: 'Presentation Layer',
      description: 'UI Components, Pages, and User-facing elements',
    },
    application: {
      label: 'Application Layer',
      description: 'API Routes, Controllers, and Request handling',
    },
    domain: {
      label: 'Domain Layer',
      description: 'Business Logic, Services, and Core functionality',
    },
    infrastructure: {
      label: 'Infrastructure Layer',
      description: 'Database, External Services, and System integration',
    },
    shared: {
      label: 'Shared Layer',
      description: 'Utilities, Types, and Common resources',
    },
  }

  const layers: LayerGroup[] = []

  for (const [layer, config] of Object.entries(layerConfig)) {
    const layerType = layer as LayerType
    layers.push({
      id: `layer-${layer}`,
      layer: layerType,
      label: config.label,
      description: config.description,
      files: files.filter(f => f.layer === layerType),
      components: components.filter(c => c.layer === layerType),
    })
  }

  return layers
}

// ============================================
// Data Flow Detection
// ============================================

function detectDataFlows(
  files: FileNode[],
  components: ArchitectureComponent[],
  connections: ArchitectureConnection[]
): DataFlowPath[] {
  const flows: DataFlowPath[] = []

  // Find API route -> Service -> Database flows
  const apiComponents = components.filter(c => c.type === 'api-route')
  const serviceComponents = components.filter(c => c.type === 'service')
  const dbComponents = components.filter(c => c.layer === 'infrastructure')

  for (const api of apiComponents) {
    // Find services this API calls
    const apiToServices = connections.filter(c => c.source === api.id && serviceComponents.some(s => s.id === c.target))

    for (const conn of apiToServices) {
      const service = components.find(c => c.id === conn.target)
      if (!service) continue

      // Find databases this service uses
      const serviceToDb = connections.filter(c => c.source === service.id && dbComponents.some(d => d.id === c.target))

      for (const dbConn of serviceToDb) {
        const db = components.find(c => c.id === dbConn.target)
        if (db) {
          flows.push({
            id: `flow-${api.id}-${service.id}-${db.id}`,
            name: `${api.name} → ${service.name} → ${db.name}`,
            description: `Data flow from ${api.endpoints?.[0] || api.name} through ${service.name} to ${db.name}`,
            nodes: [api.id, service.id, db.id],
            type: 'request',
          })
        }
      }
    }
  }

  // Find Component -> API flows
  const uiComponents = components.filter(c => c.layer === 'presentation')
  for (const ui of uiComponents) {
    const uiToApi = connections.filter(c => c.source === ui.id && apiComponents.some(a => a.id === c.target))
    for (const conn of uiToApi) {
      const api = apiComponents.find(a => a.id === conn.target)
      if (api) {
        flows.push({
          id: `flow-${ui.id}-${api.id}`,
          name: `${ui.name} → ${api.name}`,
          description: `UI interaction from ${ui.name} to ${api.endpoints?.[0] || api.name}`,
          nodes: [ui.id, api.id],
          type: 'request',
        })
      }
    }
  }

  return flows
}

// ============================================
// Pattern Detection
// ============================================

function detectPatterns(
  files: FileNode[],
  components: ArchitectureComponent[],
  connections: ArchitectureConnection[],
  framework: FrameworkType
): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Check for Next.js App Router pattern
  if (framework === 'nextjs') {
    const hasAppRouter = files.some(f => f.path.includes('app/') && f.path.endsWith('/page.tsx'))
    if (hasAppRouter) {
      patterns.push({
        name: 'Next.js App Router',
        type: 'architecture',
        description: 'Using Next.js 13+ App Router with server components',
        files: files.filter(f => f.path.includes('app/')).map(f => f.path),
        confidence: 0.95,
      })
    }
  }

  // Check for Feature-based organization
  const componentFolders = new Set(
    files.filter(f => f.path.includes('components/')).map(f => f.path.split('components/')[1]?.split('/')[0])
  )
  if (componentFolders.size > 5) {
    patterns.push({
      name: 'Feature-based Organization',
      type: 'design',
      description: 'Components organized by feature/domain',
      files: [],
      confidence: 0.8,
    })
  }

  // Check for Service Layer pattern
  const hasServiceLayer = components.some(c => c.type === 'service')
  if (hasServiceLayer) {
    patterns.push({
      name: 'Service Layer Pattern',
      type: 'architecture',
      description: 'Business logic separated into service modules',
      files: files.filter(f => f.type === 'service').map(f => f.path),
      confidence: 0.85,
    })
  }

  // Check for State Management
  const stateComponents = components.filter(c => c.type === 'state-management')
  if (stateComponents.length > 0) {
    patterns.push({
      name: 'Centralized State Management',
      type: 'design',
      description: 'Using external state management (Zustand, Redux, etc.)',
      files: files.filter(f => f.type === 'state-management').map(f => f.path),
      confidence: 0.9,
    })
  }

  // Check for Custom Hooks pattern
  const hookCount = files.filter(f => f.type === 'hook').length
  if (hookCount > 3) {
    patterns.push({
      name: 'Custom Hooks Pattern',
      type: 'design',
      description: 'Logic abstracted into reusable custom hooks',
      files: files.filter(f => f.type === 'hook').map(f => f.path),
      confidence: 0.85,
    })
  }

  // Anti-pattern: Circular dependencies
  const circularDeps = detectCircularDependencies(files)
  if (circularDeps.length > 0) {
    patterns.push({
      name: 'Circular Dependencies',
      type: 'anti-pattern',
      description: 'Files with circular import dependencies detected',
      files: circularDeps,
      confidence: 1.0,
    })
  }

  // Anti-pattern: God components (too many dependencies)
  const godComponents = files.filter(f => f.dependencies.length > 15)
  if (godComponents.length > 0) {
    patterns.push({
      name: 'God Components',
      type: 'anti-pattern',
      description: 'Components with excessive dependencies (>15)',
      files: godComponents.map(f => f.path),
      confidence: 0.9,
    })
  }

  return patterns
}

function detectCircularDependencies(files: FileNode[]): string[] {
  const circular: string[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(fileId: string, path: string[]): boolean {
    visited.add(fileId)
    recursionStack.add(fileId)

    const file = files.find(f => f.id === fileId)
    if (!file) return false

    for (const depId of file.dependencies) {
      if (!visited.has(depId)) {
        if (dfs(depId, [...path, fileId])) {
          return true
        }
      } else if (recursionStack.has(depId)) {
        circular.push(file.path)
        return true
      }
    }

    recursionStack.delete(fileId)
    return false
  }

  for (const file of files) {
    if (!visited.has(file.id)) {
      dfs(file.id, [])
    }
  }

  return circular
}

// ============================================
// Metrics Calculation
// ============================================

function calculateMetrics(
  files: FileNode[],
  components: ArchitectureComponent[],
  connections: ArchitectureConnection[]
): ArchitectureMetrics {
  // Modularity: How well-separated are the components
  const avgDeps = files.reduce((sum, f) => sum + f.dependencies.length, 0) / Math.max(files.length, 1)
  const modularity = Math.max(0, Math.min(1, 1 - (avgDeps / 20)))

  // Cohesion: How focused are components (files per component)
  const avgFilesPerComp = components.length > 0
    ? components.reduce((sum, c) => sum + c.files.length, 0) / components.length
    : 0
  const cohesion = Math.max(0, Math.min(1, avgFilesPerComp / 10))

  // Coupling: Connection density between components
  const maxConnections = components.length * (components.length - 1) / 2
  const coupling = maxConnections > 0 ? connections.length / maxConnections : 0

  // Complexity: Based on total dependencies and file count
  const totalDeps = files.reduce((sum, f) => sum + f.dependencies.length, 0)
  const complexity = Math.log10(totalDeps + 1) * 10

  // Depth: Maximum dependency chain depth
  let depth = 0
  const fileMap = new Map(files.map(f => [f.id, f]))

  function getDepth(fileId: string, visited: Set<string>): number {
    if (visited.has(fileId)) return 0
    visited.add(fileId)

    const file = fileMap.get(fileId)
    if (!file || file.dependencies.length === 0) return 1

    let maxChildDepth = 0
    for (const depId of file.dependencies) {
      maxChildDepth = Math.max(maxChildDepth, getDepth(depId, visited))
    }
    return 1 + maxChildDepth
  }

  for (const file of files) {
    depth = Math.max(depth, getDepth(file.id, new Set()))
  }

  return {
    modularity: Math.round(modularity * 100) / 100,
    cohesion: Math.round(cohesion * 100) / 100,
    coupling: Math.round(coupling * 100) / 100,
    complexity: Math.round(complexity * 100) / 100,
    depth,
  }
}

// ============================================
// Main Architecture Analyzer
// ============================================

export async function analyzeArchitecture(
  projectName: string,
  fileInfos: FileInfo[],
  packageJson: Record<string, unknown>
): Promise<ArchitectureAnalysis> {
  const framework = detectFramework(packageJson)
  const externalServices = detectExternalServices(packageJson)

  // Filter to only code files
  const codeFiles = fileInfos.filter(f =>
    f.type === 'file' &&
    /\.(tsx?|jsx?|mjs|cjs)$/.test(f.path) &&
    !f.path.includes('node_modules') &&
    !f.path.includes('.next') &&
    !f.path.includes('dist') &&
    !f.path.includes('.git')
  )

  // Parse all files
  const files: FileNode[] = codeFiles.map((f, index) => {
    const parseResult = parseFile(f.content, f.path)
    const { type, layer } = classifyFile(f.path, parseResult)

    return {
      id: `file-${index}`,
      path: f.path,
      name: f.path.split('/').pop() || f.path,
      type,
      layer,
      exports: parseResult.exports,
      imports: parseResult.imports,
      dependencies: [],
      dependents: [],
      metadata: {
        linesOfCode: parseResult.linesOfCode,
        hasDefaultExport: parseResult.exports.some(e => e.type === 'default'),
        isReactComponent: parseResult.isReactComponent,
        hasHooks: parseResult.hasHooks,
        apiMethods: parseResult.apiMethods.length > 0 ? parseResult.apiMethods : undefined,
        stateManagement: parseResult.stateManagement.length > 0 ? parseResult.stateManagement : undefined,
      },
    }
  })

  // Build dependency graph
  buildDependencyGraph(files)

  // Group into components
  const components = groupIntoComponents(files, externalServices)

  // Build connections
  const connections = buildConnections(files, components)

  // Build layer groups
  const layers = buildLayerGroups(files, components)

  // Detect data flows
  const dataFlows = detectDataFlows(files, components, connections)

  // Detect patterns
  const patterns = detectPatterns(files, components, connections, framework)

  // Calculate metrics
  const metrics = calculateMetrics(files, components, connections)

  // Calculate totals
  const totalLOC = files.reduce((sum, f) => sum + f.metadata.linesOfCode, 0)
  const apiEndpoints = files.filter(f => f.type === 'api-route').length
  const databases = externalServices.filter(s => s.type === 'database').map(s => s.name)

  return {
    projectName,
    framework,
    files,
    components,
    connections,
    layers,
    dataFlows,
    patterns,
    metrics,
    metadata: {
      analyzedAt: new Date().toISOString(),
      fileCount: files.length,
      totalLinesOfCode: totalLOC,
      apiEndpoints,
      externalServices: externalServices.map(s => s.name),
      databases,
    },
  }
}

// Legacy exports for compatibility
export function scanApiRoutes(fileInfos: FileInfo[]): string[] {
  const routes: string[] = []
  for (const file of fileInfos) {
    const match = file.path.match(/app\/api\/(.+)\/route\.(ts|js)$/)
    if (match) {
      routes.push(`/api/${match[1]}`)
    }
  }
  return routes
}

export function analyzeImports(content: string, filePath: string): ImportInfo[] {
  return parseFile(content, filePath).imports
}

export function classifyFileLayer(filePath: string): LayerType {
  const result = parseFile('', filePath)
  return classifyFile(filePath, result).layer
}
