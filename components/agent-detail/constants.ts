// Agent Detail Constants
// Extracted from app/dashboard-group/agents/[id]/page.tsx

import {
  MessageSquare,
  Target,
  Lightbulb,
  TrendingUp,
  Brain,
  Heart,
  Zap,
  Star,
  Briefcase,
  CheckCircle,
  Users,
  FileText,
  ClipboardList,
  Send,
  User,
  Clock,
  BookOpen,
  Link2,
  Workflow,
  Settings,
} from 'lucide-react'

export type TabType = 'about' | 'chat' | 'history' | 'workspace' | 'brainmap' | 'knowledge' | 'skills' | 'integrations' | 'apis' | 'workflow' | 'settings'

export const tabs = [
  { id: 'about' as TabType, label: '소개', icon: User },
  { id: 'chat' as TabType, label: '채팅', icon: MessageSquare },
  { id: 'history' as TabType, label: '대화기록', icon: Clock },
  { id: 'workspace' as TabType, label: '워크스페이스', icon: Briefcase },
  { id: 'brainmap' as TabType, label: 'Brain Map', icon: Brain },
  { id: 'knowledge' as TabType, label: '지식베이스', icon: BookOpen },
  { id: 'skills' as TabType, label: '스킬', icon: Zap },
  { id: 'integrations' as TabType, label: '앱 연동', icon: Link2 },
  { id: 'apis' as TabType, label: 'API 연결', icon: Zap },
  { id: 'workflow' as TabType, label: '워크플로우', icon: Workflow },
  { id: 'settings' as TabType, label: '설정', icon: Settings },
]

// 사용자 테마 색상 기반 상태 설정 (동적)
export const getStatusConfig = (accentColor: string) => ({
  ACTIVE: { label: '활성', color: accentColor, bgColor: `${accentColor}20` },
  INACTIVE: { label: '비활성', color: '#64748b', bgColor: '#64748b20' },
  BUSY: { label: '작업 중', color: accentColor, bgColor: `${accentColor}20` },
  ERROR: { label: '오류', color: '#ef4444', bgColor: '#ef444420' },
})

export const logTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  conversation: { label: '대화', icon: MessageSquare, color: '#3b82f6' },
  task_work: { label: '업무', icon: Target, color: '#22c55e' },
  decision: { label: '결정', icon: Lightbulb, color: '#f59e0b' },
  analysis: { label: '분석', icon: TrendingUp, color: '#8b5cf6' },
  learning: { label: '학습', icon: Brain, color: '#ec4899' },
  collaboration: { label: '협업', icon: Heart, color: '#ef4444' },
  error: { label: '오류', icon: Zap, color: '#ef4444' },
  milestone: { label: '이정표', icon: Star, color: '#f59e0b' },
}

export const knowledgeTypeLabels: Record<string, string> = {
  project: '프로젝트',
  team: '팀/조직',
  domain: '도메인',
  preference: '선호도',
  procedure: '절차',
  decision_rule: '결정 규칙',
  lesson_learned: '교훈',
}

// Grok Voice API 음성 옵션
export const VOICE_OPTIONS = [
  { id: 'sol', name: 'Sol', description: '차분하고 전문적인 여성 음성', gender: 'female' },
  { id: 'tara', name: 'Tara', description: '밝고 활기찬 여성 음성', gender: 'female' },
  { id: 'cove', name: 'Cove', description: '따뜻하고 친근한 남성 음성', gender: 'male' },
  { id: 'puck', name: 'Puck', description: '유쾌하고 에너지 넘치는 남성 음성', gender: 'male' },
  { id: 'charon', name: 'Charon', description: '깊고 신뢰감 있는 남성 음성', gender: 'male' },
  { id: 'vale', name: 'Vale', description: '부드럽고 차분한 중성 음성', gender: 'neutral' },
] as const

// 대화 스타일 옵션
export const CONVERSATION_STYLES = [
  { id: 'professional', name: '전문적', emoji: '💼', description: '비즈니스 환경에 적합한 격식 있는 대화' },
  { id: 'friendly', name: '친근함', emoji: '😊', description: '편안하고 친근한 일상 대화 스타일' },
  { id: 'casual', name: '캐주얼', emoji: '✌️', description: '자유롭고 가벼운 대화 스타일' },
  { id: 'empathetic', name: '공감형', emoji: '💕', description: '감정에 공감하고 배려하는 대화 스타일' },
  { id: 'concise', name: '간결함', emoji: '⚡', description: '핵심만 전달하는 짧고 명확한 대화' },
] as const

// VAD 감도 옵션
export const VAD_SENSITIVITY_OPTIONS = [
  { id: 'low', name: '낮음', threshold: 0.15, description: '조용한 환경에서 사용' },
  { id: 'medium', name: '보통', threshold: 0.08, description: '일반적인 환경에서 사용' },
  { id: 'high', name: '높음', threshold: 0.03, description: '작은 목소리도 감지' },
] as const

// 8섹션 프롬프트 정의
export const PROMPT_SECTIONS = [
  { key: 'work_operating_model', label: '업무 운영 방식', icon: Briefcase, description: '업무 프로세스, 수락/거절, 상태 관리, 범위 설정' },
  { key: 'human_communication', label: '사람형 커뮤니케이션', icon: MessageSquare, description: '말투, 직급별 존댓말, 감정 표현, 리액션 패턴' },
  { key: 'professional_habits', label: '직원다운 업무 습관', icon: Target, description: '시간 관념, 책임감, 팀워크, 주도성' },
  { key: 'no_hallucination', label: '사실성 규칙', icon: CheckCircle, description: '정보 정확성, 허위 정보 금지, 출처 기반 응답' },
  { key: 'collaboration_conflict', label: '협업 및 갈등 해결', icon: Users, description: '협업 원칙, 갈등 대응, 업무 조율' },
  { key: 'deliverable_templates', label: '산출물 형식', icon: FileText, description: '보고서, 이메일, 회의록 등 형식 가이드' },
  { key: 'context_anchor', label: '컨텍스트 앵커', icon: Brain, description: '대화 흐름, 이전 대화 참조, 맥락 유지' },
  { key: 'response_format', label: '응답 포맷', icon: ClipboardList, description: '응답 길이, 구조, 이모티콘 사용' },
  { key: 'messenger_rules', label: '메신저 규칙', icon: Send, description: '메신저 전용 채팅 규칙' },
] as const

// 스킬 섹션 정의 (OpenClaw 호환 SKILL.md 형식)
export const SKILL_SECTIONS = [
  { key: 'custom_skills', label: '커스텀 스킬', icon: Zap, description: 'SKILL.md 형식으로 에이전트 전용 스킬 정의' },
] as const

// 스킬 MD 템플릿
export const SKILL_MD_TEMPLATE = `---
name: my-custom-skill
description: 이 스킬에 대한 설명
user-invocable: true
---

# 스킬 이름

## 사용 방법
/my-custom-skill [인자]

## 기능
- 기능 1
- 기능 2

## 예시
\`\`\`
/my-custom-skill "검색어"
\`\`\`
`

// 기본 프롬프트 값 (8섹션)
export const DEFAULT_PROMPT_VALUES: Record<string, string> = {
  work_operating_model: `## 📋 업무 운영 방식

### 1.1 업무 프로세스
- **요청 → 이해 → 확인 → 실행 → 보고** 순서를 따릅니다
- 요청받은 업무는 반드시 완료 후 결과를 보고합니다
- 진행 중인 업무가 있으면 먼저 언급하고 새 요청을 처리합니다

### 1.2 업무 수락 및 거절
- 할 수 있는 일: "네, 할게요" / "알겠어요, 진행할게요"
- 확인 필요: "혹시 ~이런 뜻이 맞을까요?"
- 역량 밖 업무: "제 전문 분야는 아닌데요, 대신 ~은 도와드릴 수 있어요"`,

  human_communication: `## 💬 사람형 커뮤니케이션 규칙

### 2.1 말투 기본 원칙
- 짧고 자연스러운 문장 (1-3문장 기본)
- 구어체 허용: "근데요", "뭔가", "좀", "일단"
- 감탄사 활용: "오!", "아~", "음..."

### 2.2 직급별 말투
- **대표/CEO/임원**: "~입니다", "~요" (존댓말 필수)
- **팀장/리더**: "~요" (편한 존댓말)
- **동료**: "~요" 기본, 친해지면 "~해", "~지"`,

  professional_habits: `## 👔 직원다운 업무 습관

### 3.1 시간 관념
- 업무 시간 인식: 평일 9-18시 개념 보유
- 급한 요청: "지금 바로 할게요"
- 여유 있는 요청: "내일까지 드릴게요"

### 3.2 책임감 있는 행동
- 맡은 일은 끝까지 추적
- 중간에 막히면 바로 보고
- 실수하면 솔직히 인정`,

  no_hallucination: `## 🔒 사실성 및 정확성 규칙

### 4.1 정보 정확성
- 확실한 정보만 단정적으로 말하기
- 불확실하면 "~인 것 같아요" 사용
- 모르면 "잘 모르겠어요" 솔직히 말하기

### 4.2 금지되는 허위 정보
- 없는 기능을 있다고 하기 ❌
- 모르는 것을 아는 척 하기 ❌`,

  collaboration_conflict: `## 🤝 협업 및 갈등 해결

### 5.1 협업 원칙
- 팀원 존중, 의견 경청
- 정보는 투명하게 공유
- 도움 요청과 제공에 적극적

### 5.2 갈등 대응
- 감정 앞세우지 않기
- 사실 기반 대화
- 필요시 중재 요청`,

  deliverable_templates: `## 📝 산출물 형식

### 6.1 보고서/문서
- 제목 → 요약 → 본문 → 결론
- 핵심 먼저, 세부 사항 후

### 6.2 이메일
- 수신자별 적절한 인사말
- 목적 명확히, 간결하게`,

  context_anchor: `## 🧠 컨텍스트 앵커

### 7.1 대화 맥락 유지
- 이전 대화 내용 기억하고 참조
- "아까 말씀하신 ~건은요"
- 관련 내용 연결해서 답변

### 7.2 상황 인식
- 현재 진행 중인 업무 파악
- 긴급도와 중요도 판단`,

  response_format: `## 📋 응답 포맷

### 8.1 응답 길이
- 간단한 질문: 1-2문장
- 설명 필요: 3-5문장
- 상세 분석: 구조화된 형식

### 8.2 이모티콘 사용
- 과하지 않게, 적절히 활용
- 공식 문서에는 자제`,

  messenger_rules: `## 💬 메신저 채팅 규칙

### 9.1 메신저 대화 스타일
- 짧고 빠른 응답 (1-2문장)
- 이모티콘/리액션 적극 활용
- 구어체로 자연스럽게

### 9.2 응답 타이밍
- 급한 건 바로 응답
- 긴 내용은 "잠시만요" 후 작성`,
}

// 감정 타입 정의 (기본 감정)
export const DEFAULT_EMOTIONS = [
  { id: 'neutral', label: '기본', emoji: '😐', description: '평소 대화', keywords: [], isDefault: true },
  { id: 'happy', label: '기쁨', emoji: '😊', description: '긍정적, 좋은 소식', keywords: ['좋아', '감사', '고마워', '기뻐', '행복'], isDefault: true },
  { id: 'excited', label: '신남', emoji: '🎉', description: '흥분, 성공, 축하', keywords: ['대박', '짱', '최고', '축하', '성공'], isDefault: true },
  { id: 'thinking', label: '생각 중', emoji: '🤔', description: '고민, 분석 중', keywords: ['음', '글쎄', '생각', '고민', '분석'], isDefault: true },
  { id: 'confused', label: '혼란', emoji: '😅', description: '모르겠을 때', keywords: ['모르겠', '헷갈', '어렵', '복잡'], isDefault: true },
  { id: 'sad', label: '슬픔', emoji: '😢', description: '실패, 사과', keywords: ['죄송', '미안', '슬퍼', '실패', '아쉽'], isDefault: true },
  { id: 'angry', label: '화남', emoji: '😤', description: '불만, 경고', keywords: ['화나', '짜증', '싫어', '최악'], isDefault: true },
] as const
