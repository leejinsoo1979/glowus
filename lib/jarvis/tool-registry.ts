/**
 * Jarvis 도구 레지스트리
 * 모든 사용 가능한 도구와 위험도 정의
 */

import { RiskLevel, ToolCategory } from './types'

export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  riskLevel: RiskLevel
  requiresApproval: boolean
}

// ============================================
// GlowUS 앱 제어 도구
// ============================================

export const GLOWUS_TOOLS: ToolDefinition[] = [
  // 에이전트 관리
  {
    name: 'list_agents',
    description: '에이전트 목록 조회',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'create_agent',
    description: '새 에이전트 생성',
    category: 'glowus',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'update_agent',
    description: '에이전트 정보 수정',
    category: 'glowus',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'delete_agent',
    description: '에이전트 삭제',
    category: 'glowus',
    riskLevel: 'HIGH',
    requiresApproval: true,
  },

  // 스킬 관리
  {
    name: 'list_skills',
    description: '스킬 목록 조회',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'equip_skill',
    description: '에이전트에 스킬 장착',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'unequip_skill',
    description: '에이전트에서 스킬 해제',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },

  // 프로젝트 관리
  {
    name: 'list_projects',
    description: '프로젝트 목록 조회',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'create_project',
    description: '새 프로젝트 생성',
    category: 'glowus',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'delete_project',
    description: '프로젝트 삭제',
    category: 'glowus',
    riskLevel: 'HIGH',
    requiresApproval: true,
  },

  // 채팅
  {
    name: 'create_chat_room',
    description: '채팅방 생성',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'send_message',
    description: '메시지 전송',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },

  // 앱 열기
  {
    name: 'open_app',
    description: 'GlowUS 앱 열기',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },

  // 콘텐츠 생성
  {
    name: 'generate_document',
    description: 'AI 문서 생성',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'generate_slides',
    description: 'AI 슬라이드 생성',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'generate_image',
    description: 'AI 이미지 생성',
    category: 'glowus',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
]

// ============================================
// PC 제어 도구
// ============================================

export const PC_TOOLS: ToolDefinition[] = [
  // 앱 실행
  {
    name: 'launch_app',
    description: '앱 실행',
    category: 'pc',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'kill_app',
    description: '앱 종료',
    category: 'pc',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'list_running_apps',
    description: '실행 중인 앱 목록',
    category: 'pc',
    riskLevel: 'LOW',
    requiresApproval: false,
  },

  // 시스템 명령
  {
    name: 'execute_command',
    description: '시스템 명령 실행',
    category: 'system',
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  {
    name: 'get_system_info',
    description: '시스템 정보 조회',
    category: 'system',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
]

// ============================================
// 파일 관리 도구
// ============================================

export const FILE_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '파일 읽기',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'write_file',
    description: '파일 쓰기',
    category: 'file',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'delete_file',
    description: '파일 삭제',
    category: 'file',
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  {
    name: 'create_folder',
    description: '폴더 생성',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'delete_folder',
    description: '폴더 삭제',
    category: 'file',
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  {
    name: 'list_directory',
    description: '디렉토리 목록',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'move_file',
    description: '파일 이동',
    category: 'file',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'copy_file',
    description: '파일 복사',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'search_files',
    description: '파일/폴더 이름으로 검색',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'search_in_files',
    description: '파일 내용 검색 (grep)',
    category: 'file',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
]

// ============================================
// 브라우저 제어 도구
// ============================================

export const BROWSER_TOOLS: ToolDefinition[] = [
  {
    name: 'open_browser',
    description: '브라우저 열기',
    category: 'browser',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'navigate_url',
    description: 'URL 이동',
    category: 'browser',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  {
    name: 'browser_click',
    description: '브라우저 클릭',
    category: 'browser',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'browser_type',
    description: '브라우저 입력',
    category: 'browser',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
  },
  {
    name: 'take_screenshot',
    description: '스크린샷 촬영',
    category: 'browser',
    riskLevel: 'LOW',
    requiresApproval: false,
  },
]

// ============================================
// 전체 도구 레지스트리
// ============================================

export const ALL_TOOLS: ToolDefinition[] = [
  ...GLOWUS_TOOLS,
  ...PC_TOOLS,
  ...FILE_TOOLS,
  ...BROWSER_TOOLS,
]

// 도구 이름으로 찾기
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(t => t.name === name)
}

// 카테고리별 도구 목록
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return ALL_TOOLS.filter(t => t.category === category)
}

// 승인 필요 여부 확인
export function requiresApproval(toolName: string): boolean {
  const tool = getToolByName(toolName)
  return tool?.requiresApproval ?? true // 모르는 도구는 승인 필요
}

// 위험도 조회
export function getToolRiskLevel(toolName: string): RiskLevel {
  const tool = getToolByName(toolName)
  return tool?.riskLevel ?? 'HIGH' // 모르는 도구는 HIGH
}
