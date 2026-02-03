/**
 * GlowUS 전역 컨텍스트 스토어
 * Claude Code가 현재 사용자의 화면/작업 상태를 실시간으로 파악하기 위한 스토어
 */

import { create } from 'zustand'

export interface OpenFile {
  id: string
  name: string
  path: string
  language?: string
  selectedCode?: string
}

export interface CurrentTask {
  id: string
  title: string
  status: string
  projectId?: string
}

export interface CurrentProject {
  id: string
  name: string
  path: string
  description?: string
}

export interface SelectedNode {
  id: string
  title: string
  type: string
  data?: any
}

export interface GlowContext {
  // 현재 페이지
  currentPage: string
  currentPageTitle: string

  // 현재 프로젝트
  currentProject: CurrentProject | null

  // 열린 파일들
  openFiles: OpenFile[]
  activeFile: OpenFile | null

  // Neural Map 상태
  selectedNode: SelectedNode | null

  // Task Hub 상태
  currentTask: CurrentTask | null

  // 채팅/메신저 상태
  currentChatRoom: string | null

  // 앱 상태 (AI Slides, Docs 등)
  currentApp: string | null
  appState: Record<string, any>

  // 사용자 액션 히스토리 (최근 10개)
  recentActions: Array<{
    action: string
    target: string
    timestamp: Date
  }>
}

interface GlowContextStore extends GlowContext {
  // 페이지 변경
  setCurrentPage: (page: string, title?: string) => void

  // 프로젝트 변경
  setCurrentProject: (project: CurrentProject | null) => void

  // 파일 관련
  addOpenFile: (file: OpenFile) => void
  removeOpenFile: (fileId: string) => void
  setActiveFile: (file: OpenFile | null) => void
  updateFileSelection: (fileId: string, selectedCode: string) => void

  // Neural Map
  setSelectedNode: (node: SelectedNode | null) => void

  // Task Hub
  setCurrentTask: (task: CurrentTask | null) => void

  // 채팅
  setCurrentChatRoom: (roomId: string | null) => void

  // 앱 상태
  setCurrentApp: (app: string | null) => void
  updateAppState: (key: string, value: any) => void

  // 액션 기록
  recordAction: (action: string, target: string) => void

  // 전체 컨텍스트 가져오기 (Claude에게 전달용)
  getContextForClaude: () => string
}

export const useGlowContextStore = create<GlowContextStore>((set, get) => ({
  // 초기 상태
  currentPage: '',
  currentPageTitle: '',
  currentProject: null,
  openFiles: [],
  activeFile: null,
  selectedNode: null,
  currentTask: null,
  currentChatRoom: null,
  currentApp: null,
  appState: {},
  recentActions: [],

  // 페이지 변경
  setCurrentPage: (page, title) => {
    set({ currentPage: page, currentPageTitle: title || page })
    get().recordAction('navigate', page)
  },

  // 프로젝트 변경
  setCurrentProject: (project) => {
    set({ currentProject: project })
    if (project) {
      get().recordAction('open_project', project.name)
    }
  },

  // 파일 열기
  addOpenFile: (file) => {
    set((state) => {
      const exists = state.openFiles.some(f => f.id === file.id)
      if (exists) return state
      return {
        openFiles: [...state.openFiles.slice(-9), file], // 최대 10개
        activeFile: file
      }
    })
    get().recordAction('open_file', file.name)
  },

  // 파일 닫기
  removeOpenFile: (fileId) => {
    set((state) => ({
      openFiles: state.openFiles.filter(f => f.id !== fileId),
      activeFile: state.activeFile?.id === fileId ? null : state.activeFile
    }))
  },

  // 활성 파일 설정
  setActiveFile: (file) => {
    set({ activeFile: file })
    if (file) {
      get().recordAction('focus_file', file.name)
    }
  },

  // 코드 선택 업데이트
  updateFileSelection: (fileId, selectedCode) => {
    set((state) => ({
      openFiles: state.openFiles.map(f =>
        f.id === fileId ? { ...f, selectedCode } : f
      ),
      activeFile: state.activeFile?.id === fileId
        ? { ...state.activeFile, selectedCode }
        : state.activeFile
    }))
  },

  // Neural Map 노드 선택
  setSelectedNode: (node) => {
    set({ selectedNode: node })
    if (node) {
      get().recordAction('select_node', node.title)
    }
  },

  // 현재 작업 설정
  setCurrentTask: (task) => {
    set({ currentTask: task })
    if (task) {
      get().recordAction('focus_task', task.title)
    }
  },

  // 채팅방 설정
  setCurrentChatRoom: (roomId) => {
    set({ currentChatRoom: roomId })
  },

  // 앱 설정
  setCurrentApp: (app) => {
    set({ currentApp: app })
    if (app) {
      get().recordAction('open_app', app)
    }
  },

  // 앱 상태 업데이트
  updateAppState: (key, value) => {
    set((state) => ({
      appState: { ...state.appState, [key]: value }
    }))
  },

  // 액션 기록
  recordAction: (action, target) => {
    set((state) => ({
      recentActions: [
        { action, target, timestamp: new Date() },
        ...state.recentActions.slice(0, 9)
      ]
    }))
  },

  // Claude에게 전달할 컨텍스트 생성
  getContextForClaude: () => {
    const state = get()

    const parts: string[] = []

    // 현재 페이지
    parts.push(`## 현재 화면`)
    parts.push(`- 페이지: ${state.currentPageTitle || state.currentPage || '대시보드'}`)

    // 현재 프로젝트
    if (state.currentProject) {
      parts.push(`- 프로젝트: ${state.currentProject.name}`)
      parts.push(`- 경로: ${state.currentProject.path}`)
    }

    // 열린 파일
    if (state.openFiles.length > 0) {
      parts.push(`\n## 열린 파일`)
      state.openFiles.forEach(f => {
        const isActive = state.activeFile?.id === f.id
        parts.push(`- ${isActive ? '▶ ' : ''}${f.name} (${f.path})`)
      })
    }

    // 선택된 코드
    if (state.activeFile?.selectedCode) {
      parts.push(`\n## 선택된 코드 (${state.activeFile.name})`)
      parts.push('```' + (state.activeFile.language || ''))
      parts.push(state.activeFile.selectedCode)
      parts.push('```')
    }

    // Neural Map 노드
    if (state.selectedNode) {
      parts.push(`\n## 선택된 노드`)
      parts.push(`- ${state.selectedNode.title} (${state.selectedNode.type})`)
    }

    // 현재 작업
    if (state.currentTask) {
      parts.push(`\n## 현재 작업`)
      parts.push(`- ${state.currentTask.title} [${state.currentTask.status}]`)
    }

    // 앱 상태
    if (state.currentApp) {
      parts.push(`\n## 현재 앱: ${state.currentApp}`)
      if (Object.keys(state.appState).length > 0) {
        parts.push(`상태: ${JSON.stringify(state.appState, null, 2)}`)
      }
    }

    // 최근 액션
    if (state.recentActions.length > 0) {
      parts.push(`\n## 최근 활동`)
      state.recentActions.slice(0, 5).forEach(a => {
        parts.push(`- ${a.action}: ${a.target}`)
      })
    }

    return parts.join('\n')
  }
}))
