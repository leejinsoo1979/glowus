'use client'

// ============================================
// 승인 시스템 (Permission/Approval System)
// ============================================

import { create } from 'zustand'

// 승인이 필요한 도구 타입
export type ApprovalToolType = 'Write' | 'Edit' | 'Bash' | 'MultiEdit' | 'Delete'

// 승인 요청 상태
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified'

// 승인 요청 인터페이스
export interface ApprovalRequest {
  id: string
  toolName: ApprovalToolType
  timestamp: number
  status: ApprovalStatus

  // 파일 작업 관련
  filePath?: string
  oldContent?: string  // Edit의 경우
  newContent?: string  // Write/Edit의 경우
  diff?: string        // 변경 내용 diff

  // Bash 명령의 경우
  command?: string

  // 사용자 수정 내용 (modified 상태일 때)
  modifiedContent?: string

  // 메타데이터
  description?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
}

// 승인 시스템 설정
export interface ApprovalSettings {
  // 모드: ask (항상 물음), plan (계획 단계에서 리뷰), acceptEdits (자동 승인)
  mode: 'ask' | 'plan' | 'acceptEdits'
  // 자동 승인할 도구 목록
  autoApproveTools: ApprovalToolType[]
  // 자동 승인할 파일 패턴 (glob)
  autoApprovePatterns: string[]
  // 위험 수준 임계값 (이 이상이면 항상 물음)
  riskThreshold: 'low' | 'medium' | 'high'
}

// 승인 시스템 스토어 상태
interface ApprovalSystemState {
  // 현재 대기 중인 승인 요청
  pendingRequests: ApprovalRequest[]
  // 히스토리 (최근 100개)
  history: ApprovalRequest[]
  // 설정
  settings: ApprovalSettings
  // 현재 활성 요청 (모달에 표시)
  activeRequest: ApprovalRequest | null

  // Actions
  addRequest: (request: Omit<ApprovalRequest, 'id' | 'timestamp' | 'status'>) => string
  approveRequest: (id: string) => void
  rejectRequest: (id: string) => void
  modifyRequest: (id: string, modifiedContent: string) => void
  setActiveRequest: (request: ApprovalRequest | null) => void
  clearPendingRequests: () => void
  updateSettings: (settings: Partial<ApprovalSettings>) => void

  // Helpers
  shouldAutoApprove: (request: Omit<ApprovalRequest, 'id' | 'timestamp' | 'status'>) => boolean
  getRiskLevel: (request: Omit<ApprovalRequest, 'id' | 'timestamp' | 'status'>) => 'low' | 'medium' | 'high' | 'critical'
}

// 🔥 위험 패턴
const DANGEROUS_PATTERNS = {
  critical: [
    /rm\s+-rf\s+[\/~]/i,           // rm -rf /
    /sudo\s+/i,                     // sudo commands
    /:(){ :|:& };:/,               // fork bomb
    /dd\s+if=/i,                    // dd command
    /mkfs/i,                        // format filesystem
    /chmod\s+777/i,                 // chmod 777
    />\s*\/dev\/sd/i,              // write to disk
  ],
  high: [
    /\.env/i,                       // env files
    /credentials/i,                 // credential files
    /password/i,                    // password in path
    /secret/i,                      // secret files
    /private.*key/i,               // private keys
    /node_modules/i,               // node_modules
    /rm\s+-/i,                     // rm commands
    /git\s+push\s+.*--force/i,     // force push
    /DROP\s+TABLE/i,               // SQL drop
    /DELETE\s+FROM/i,              // SQL delete
  ],
  medium: [
    /package\.json/i,              // package.json
    /\.config/i,                   // config files
    /tsconfig/i,                   // tsconfig
    /git\s+reset/i,                // git reset
    /npm\s+install/i,              // npm install
    /yarn\s+add/i,                 // yarn add
  ]
}

// 위험 수준 계산
function calculateRiskLevel(
  request: Omit<ApprovalRequest, 'id' | 'timestamp' | 'status'>
): 'low' | 'medium' | 'high' | 'critical' {
  const content = [
    request.filePath || '',
    request.command || '',
    request.newContent || '',
    request.oldContent || ''
  ].join(' ')

  // Critical 체크
  for (const pattern of DANGEROUS_PATTERNS.critical) {
    if (pattern.test(content)) return 'critical'
  }

  // High 체크
  for (const pattern of DANGEROUS_PATTERNS.high) {
    if (pattern.test(content)) return 'high'
  }

  // Medium 체크
  for (const pattern of DANGEROUS_PATTERNS.medium) {
    if (pattern.test(content)) return 'medium'
  }

  // Bash 명령은 기본적으로 medium
  if (request.toolName === 'Bash') return 'medium'

  // Delete는 high
  if (request.toolName === 'Delete') return 'high'

  return 'low'
}

// nanoid 대체 (간단한 ID 생성)
const generateId = () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

// 🔥 승인 시스템 스토어
export const useApprovalStore = create<ApprovalSystemState>((set, get) => ({
  pendingRequests: [],
  history: [],
  settings: {
    mode: 'ask',
    autoApproveTools: [],
    autoApprovePatterns: ['*.md', '*.txt', '*.json'],
    riskThreshold: 'medium'
  },
  activeRequest: null,

  addRequest: (request) => {
    const id = generateId()
    const riskLevel = calculateRiskLevel(request)

    const newRequest: ApprovalRequest = {
      ...request,
      id,
      timestamp: Date.now(),
      status: 'pending',
      riskLevel
    }

    // 자동 승인 체크
    if (get().shouldAutoApprove(request)) {
      const autoApproved: ApprovalRequest = { ...newRequest, status: 'approved' }
      set(state => ({
        history: [autoApproved, ...state.history].slice(0, 100)
      }))
      return id
    }

    set(state => ({
      pendingRequests: [...state.pendingRequests, newRequest],
      activeRequest: state.activeRequest || newRequest // 첫 번째 요청을 활성화
    }))

    return id
  },

  approveRequest: (id) => {
    set(state => {
      const request = state.pendingRequests.find(r => r.id === id)
      if (!request) return state

      const approvedRequest = { ...request, status: 'approved' as const }

      return {
        pendingRequests: state.pendingRequests.filter(r => r.id !== id),
        history: [approvedRequest, ...state.history].slice(0, 100),
        activeRequest: state.pendingRequests.find(r => r.id !== id) || null
      }
    })
  },

  rejectRequest: (id) => {
    set(state => {
      const request = state.pendingRequests.find(r => r.id === id)
      if (!request) return state

      const rejectedRequest = { ...request, status: 'rejected' as const }

      return {
        pendingRequests: state.pendingRequests.filter(r => r.id !== id),
        history: [rejectedRequest, ...state.history].slice(0, 100),
        activeRequest: state.pendingRequests.find(r => r.id !== id) || null
      }
    })
  },

  modifyRequest: (id, modifiedContent) => {
    set(state => {
      const request = state.pendingRequests.find(r => r.id === id)
      if (!request) return state

      const modifiedRequest = {
        ...request,
        status: 'modified' as const,
        modifiedContent
      }

      return {
        pendingRequests: state.pendingRequests.filter(r => r.id !== id),
        history: [modifiedRequest, ...state.history].slice(0, 100),
        activeRequest: state.pendingRequests.find(r => r.id !== id) || null
      }
    })
  },

  setActiveRequest: (request) => set({ activeRequest: request }),

  clearPendingRequests: () => set({
    pendingRequests: [],
    activeRequest: null
  }),

  updateSettings: (settings) => set(state => ({
    settings: { ...state.settings, ...settings }
  })),

  shouldAutoApprove: (request) => {
    const { settings } = get()

    // acceptEdits 모드면 Write/Edit 자동 승인
    if (settings.mode === 'acceptEdits') {
      if (request.toolName === 'Write' || request.toolName === 'Edit') {
        const riskLevel = calculateRiskLevel(request)
        // 하지만 high/critical은 항상 물어봄
        if (riskLevel === 'high' || riskLevel === 'critical') {
          return false
        }
        return true
      }
    }

    // 자동 승인 도구 목록 체크
    if (settings.autoApproveTools.includes(request.toolName)) {
      const riskLevel = calculateRiskLevel(request)
      const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 }
      const thresholdOrder = { low: 0, medium: 1, high: 2 }

      // 위험 수준이 임계값 이하면 자동 승인
      if (riskOrder[riskLevel] <= thresholdOrder[settings.riskThreshold]) {
        return true
      }
    }

    // 파일 패턴 체크
    if (request.filePath && settings.autoApprovePatterns.length > 0) {
      const fileName = request.filePath.split('/').pop() || ''
      for (const pattern of settings.autoApprovePatterns) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          'i'
        )
        if (regex.test(fileName)) {
          const riskLevel = calculateRiskLevel(request)
          if (riskLevel === 'low' || riskLevel === 'medium') {
            return true
          }
        }
      }
    }

    return false
  },

  getRiskLevel: calculateRiskLevel
}))

// 🔥 유틸리티: diff 생성 (간단한 버전)
export function generateSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diff: string[] = []

  let i = 0, j = 0

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      diff.push(`+ ${newLines[j]}`)
      j++
    } else if (j >= newLines.length) {
      diff.push(`- ${oldLines[i]}`)
      i++
    } else if (oldLines[i] === newLines[j]) {
      diff.push(`  ${oldLines[i]}`)
      i++
      j++
    } else {
      diff.push(`- ${oldLines[i]}`)
      diff.push(`+ ${newLines[j]}`)
      i++
      j++
    }
  }

  return diff.join('\n')
}

// 🔥 도구별 설명 생성
export function getToolDescription(request: ApprovalRequest): string {
  switch (request.toolName) {
    case 'Write':
      return `파일 생성/덮어쓰기: ${request.filePath}`
    case 'Edit':
      return `파일 편집: ${request.filePath}`
    case 'Delete':
      return `파일 삭제: ${request.filePath}`
    case 'Bash':
      return `명령어 실행: ${request.command}`
    case 'MultiEdit':
      return `다중 파일 편집: ${request.filePath}`
    default:
      return `${request.toolName}: ${request.filePath || request.command || ''}`
  }
}

// 🔥 위험 수준별 색상
export const RISK_COLORS = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-500',
  critical: 'text-red-500'
}

export const RISK_BG_COLORS = {
  low: 'bg-green-500/10 border-green-500/30',
  medium: 'bg-yellow-500/10 border-yellow-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  critical: 'bg-red-500/10 border-red-500/30'
}

export const RISK_LABELS = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '위험'
}
