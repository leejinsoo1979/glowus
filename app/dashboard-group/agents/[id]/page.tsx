'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Loader2,
  Bot,
  MessageSquare,
  Brain,
  BookOpen,
  Workflow,
  Clock,
  Zap,
  Star,
  Target,
  TrendingUp,
  Calendar,
  Sparkles,
  Heart,
  Lightbulb,
  FileText,
  GitCommit,
  Cpu,
  Thermometer,
  Activity,
  Camera,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  User,
  Briefcase,
  Edit3,
  Save,
  Plus,
  Trash2,
  Users,
  FolderOpen,
  FolderPlus,
  Hash,
  Building,
  Mail,
  Link2,
  Send,
  ImagePlus,
  Smile,
  Upload,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  CheckCircle,
  XCircle,
  LogOut,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  Play,
  Square,
  Waves,
  UserCircle,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PROVIDER_INFO, LLMProvider, AVAILABLE_MODELS } from '@/lib/llm/models'
import { createClient } from '@/lib/supabase/client'
import type { DeployedAgent, AgentStatus } from '@/types/database'
import { getAppLogo } from '@/components/icons/app-logos'
import { AgentOSPanel } from '@/components/agent/AgentOSPanel'
import { BrainMapLayout } from '@/components/brain-map/BrainMapLayout'
import { useThemeStore, accentColors } from '@/stores/themeStore'

type TabType = 'about' | 'chat' | 'history' | 'workspace' | 'brainmap' | 'knowledge' | 'integrations' | 'apis' | 'workflow' | 'settings'

const tabs = [
  { id: 'about' as TabType, label: '소개', icon: User },
  { id: 'chat' as TabType, label: '채팅', icon: MessageSquare },
  { id: 'history' as TabType, label: '대화기록', icon: Clock },
  { id: 'workspace' as TabType, label: '워크스페이스', icon: Briefcase },
  { id: 'brainmap' as TabType, label: 'Brain Map', icon: Brain },
  { id: 'knowledge' as TabType, label: '지식베이스', icon: BookOpen },
  { id: 'integrations' as TabType, label: '앱 연동', icon: Link2 },
  { id: 'apis' as TabType, label: 'API 연결', icon: Zap },
  { id: 'workflow' as TabType, label: '워크플로우', icon: Workflow },
  { id: 'settings' as TabType, label: '설정', icon: Settings },
]

// 사용자 테마 색상 기반 상태 설정 (동적)
const getStatusConfig = (accentColor: string) => ({
  ACTIVE: { label: '활성', color: accentColor, bgColor: `${accentColor}20` },
  INACTIVE: { label: '비활성', color: '#64748b', bgColor: '#64748b20' },
  BUSY: { label: '작업 중', color: accentColor, bgColor: `${accentColor}20` },
  ERROR: { label: '오류', color: '#ef4444', bgColor: '#ef444420' },
})

const logTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  conversation: { label: '대화', icon: MessageSquare, color: '#3b82f6' },
  task_work: { label: '업무', icon: Target, color: '#22c55e' },
  decision: { label: '결정', icon: Lightbulb, color: '#f59e0b' },
  analysis: { label: '분석', icon: TrendingUp, color: '#8b5cf6' },
  learning: { label: '학습', icon: Brain, color: '#ec4899' },
  collaboration: { label: '협업', icon: Heart, color: '#ef4444' },
  error: { label: '오류', icon: Zap, color: '#ef4444' },
  milestone: { label: '이정표', icon: Star, color: '#f59e0b' },
}

const knowledgeTypeLabels: Record<string, string> = {
  project: '프로젝트',
  team: '팀/조직',
  domain: '도메인',
  preference: '선호도',
  procedure: '절차',
  decision_rule: '결정 규칙',
  lesson_learned: '교훈',
}

// Grok Voice API 음성 옵션
const VOICE_OPTIONS = [
  { id: 'sol', name: 'Sol', description: '차분하고 전문적인 여성 음성', gender: 'female' },
  { id: 'tara', name: 'Tara', description: '밝고 활기찬 여성 음성', gender: 'female' },
  { id: 'cove', name: 'Cove', description: '따뜻하고 친근한 남성 음성', gender: 'male' },
  { id: 'puck', name: 'Puck', description: '유쾌하고 에너지 넘치는 남성 음성', gender: 'male' },
  { id: 'charon', name: 'Charon', description: '깊고 신뢰감 있는 남성 음성', gender: 'male' },
  { id: 'vale', name: 'Vale', description: '부드럽고 차분한 중성 음성', gender: 'neutral' },
] as const

// 대화 스타일 옵션
const CONVERSATION_STYLES = [
  { id: 'professional', name: '전문적', description: '비즈니스 환경에 적합한 격식 있는 대화' },
  { id: 'friendly', name: '친근함', description: '편안하고 친근한 일상 대화 스타일' },
  { id: 'casual', name: '캐주얼', description: '자유롭고 가벼운 대화 스타일' },
  { id: 'empathetic', name: '공감형', description: '감정에 공감하고 배려하는 대화 스타일' },
  { id: 'concise', name: '간결함', description: '핵심만 전달하는 짧고 명확한 대화' },
] as const

// VAD 감도 옵션
const VAD_SENSITIVITY_OPTIONS = [
  { id: 'low', name: '낮음', threshold: 0.7, description: '조용한 환경에서 사용' },
  { id: 'medium', name: '보통', threshold: 0.5, description: '일반적인 환경에서 사용' },
  { id: 'high', name: '높음', threshold: 0.3, description: '시끄러운 환경에서 사용' },
] as const

// 8섹션 프롬프트 정의
const PROMPT_SECTIONS = [
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

// 기본 프롬프트 값 (8섹션)
const DEFAULT_PROMPT_VALUES: Record<string, string> = {
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
const DEFAULT_EMOTIONS = [
  { id: 'neutral', label: '기본', emoji: '😐', description: '평소 대화', keywords: [], isDefault: true },
  { id: 'happy', label: '기쁨', emoji: '😊', description: '긍정적, 좋은 소식', keywords: ['좋아', '감사', '고마워', '기뻐', '행복'], isDefault: true },
  { id: 'excited', label: '신남', emoji: '🎉', description: '흥분, 성공, 축하', keywords: ['대박', '짱', '최고', '축하', '성공'], isDefault: true },
  { id: 'thinking', label: '생각 중', emoji: '🤔', description: '고민, 분석 중', keywords: ['음', '글쎄', '생각', '고민', '분석'], isDefault: true },
  { id: 'confused', label: '혼란', emoji: '😅', description: '모르겠을 때', keywords: ['모르겠', '헷갈', '어렵', '복잡'], isDefault: true },
  { id: 'sad', label: '슬픔', emoji: '😢', description: '실패, 사과', keywords: ['죄송', '미안', '슬퍼', '실패', '아쉽'], isDefault: true },
  { id: 'angry', label: '화남', emoji: '😤', description: '불만, 경고', keywords: ['화나', '짜증', '싫어', '최악'], isDefault: true },
] as const

// 커스텀 감정 타입
interface CustomEmotion {
  id: string
  label: string
  emoji: string
  description: string
  keywords: string[]
  isDefault?: boolean
}

type EmotionType = string

interface EmotionAvatars {
  [key: string]: string | string[] // emotion_id -> image URL or array of URLs (max 4)
}

// 텍스트에서 감정 분석 (커스텀 감정 포함) - 단일 감정 반환 (호환성 유지)
function detectEmotion(text: string, customEmotions: CustomEmotion[] = []): EmotionType {
  const emotions = detectEmotionsInOrder(text, customEmotions)
  return emotions.length > 0 ? emotions[0] : 'neutral'
}

// 텍스트에서 다중 감정 분석 (텍스트 등장 순서대로 반환)
function detectEmotionsInOrder(text: string, customEmotions: CustomEmotion[] = []): EmotionType[] {
  const lowerText = text.toLowerCase()

  // 감정별 첫 등장 위치를 저장
  const emotionPositions: { emotion: EmotionType; position: number }[] = []

  // 커스텀 감정 체크 (위치 추적)
  for (const emotion of customEmotions) {
    if (!emotion.isDefault && emotion.keywords && emotion.keywords.length > 0) {
      let earliestPos = -1
      for (const keyword of emotion.keywords) {
        const keywordLower = keyword.toLowerCase()
        const pos = lowerText.indexOf(keywordLower)
        if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
          earliestPos = pos
        }
      }
      if (earliestPos !== -1) {
        emotionPositions.push({ emotion: emotion.id, position: earliestPos })
      }
    }
  }

  // 기본 감정 패턴과 키워드 (위치 추적을 위해 키워드도 포함)
  const emotionPatterns: { emotion: EmotionType; patterns: RegExp[]; keywords: string[] }[] = [
    {
      emotion: 'excited',
      patterns: [
        /대박|와[아~!]+|오[오~!]+|짱|최고|멋[지져]|굿|good|great|awesome|amazing/i,
        /축하|성공|완료|해냈|드디어|야호|신[나난]|기[대쁨]|흥분/i,
        /!{2,}|🎉|🎊|🥳|👏|✨|💪|🔥/,
      ],
      keywords: ['대박', '짱', '최고', '멋', '굿', 'good', 'great', 'awesome', 'amazing', '축하', '성공', '완료', '해냈', '드디어', '야호', '신나', '🎉', '🎊', '🥳', '👏', '✨', '💪', '🔥'],
    },
    {
      emotion: 'happy',
      patterns: [
        /좋[아은]|네[네~]|감사|고마[워요]|다행|반가[워요]|기[쁘뻐]|행복/i,
        /ㅎㅎ|ㅋㅋ|하하|히히|웃|재[미밌]|즐[거겁]|좋겠/i,
        /😊|😄|😃|🙂|☺️|😁|💕|❤️|👍/,
      ],
      keywords: ['좋아', '좋은', '감사', '고마워', '다행', '반가워', '기뻐', '행복', 'ㅎㅎ', 'ㅋㅋ', '하하', '히히', '재밌', '즐거', '😊', '😄', '😃', '🙂', '😁', '💕', '❤️', '👍'],
    },
    {
      emotion: 'thinking',
      patterns: [
        /음+[\.…~]|흠+|글쎄|잠[깐시만]|생각|고민|분석|검토|살펴/i,
        /아마|혹시|어떨까|일단|한번|보[자니면]|확인|조사|파악/i,
        /\.{3,}|…|🤔|💭|📊|📈/,
      ],
      keywords: ['음', '흠', '글쎄', '잠깐', '생각', '고민', '분석', '검토', '살펴', '아마', '혹시', '어떨까', '일단', '한번', '확인', '조사', '파악', '...', '…', '🤔', '💭', '📊', '📈'],
    },
    {
      emotion: 'confused',
      patterns: [
        /모르겠|이해가 안|잘 모|헷갈|어렵|복잡|난해|혼란/i,
        /뭐지|왜지|어떻게|뭔가|이상하|당황|황당|멘붕/i,
        /\?{2,}|😅|😓|🤷|😵|🫤|😕/,
      ],
      keywords: ['모르겠', '이해가 안', '잘 모', '헷갈', '복잡', '난해', '혼란', '뭐지', '왜지', '어떻게', '뭔가', '이상하', '당황', '황당', '멘붕', '??', '😅', '😓', '🤷', '😵', '😕'],
    },
    {
      emotion: 'sad',
      patterns: [
        /죄송|미안|안타깝|유감|실[망패]|아쉽|슬[프픔]|힘[들든]/i,
        /어렵|불가능|안 될|못 [하해]|포기|걱정|우울|속상/i,
        /ㅠ+|ㅜ+|😢|😭|😔|😞|💔|🥲/,
      ],
      keywords: ['죄송', '미안', '안타깝', '유감', '실망', '실패', '아쉽', '슬프', '힘들', '어렵', '불가능', '안 될', '포기', '걱정', '우울', '속상', 'ㅠㅠ', 'ㅜㅜ', '😢', '😭', '😔', '😞', '💔', '🥲'],
    },
    {
      emotion: 'angry',
      patterns: [
        /화[나남]|짜증|열[받뻗]|싫|별로|최악|나쁜|문제/i,
        /안[돼됨되요]|하지 마|그만|경고|위험|심각|주의/i,
        /!+\?|😤|😠|😡|🤬|💢|⚠️/,
      ],
      keywords: ['화나', '화남', '짜증', '열받', '싫', '별로', '최악', '나쁜', '문제', '안돼', '하지 마', '그만', '경고', '위험', '심각', '주의', '😤', '😠', '😡', '🤬', '💢', '⚠️'],
    },
  ]

  // 각 기본 감정 패턴 체크 (위치 추적 포함)
  for (const { emotion, patterns, keywords } of emotionPatterns) {
    // 먼저 패턴 매칭으로 감정이 있는지 확인
    let hasEmotion = false
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        hasEmotion = true
        break
      }
    }

    // 감정이 있으면 키워드로 위치 찾기
    if (hasEmotion) {
      let earliestPos = text.length // 못 찾으면 맨 뒤로
      for (const keyword of keywords) {
        const pos = lowerText.indexOf(keyword.toLowerCase())
        if (pos !== -1 && pos < earliestPos) {
          earliestPos = pos
        }
      }
      // 이미 같은 감정이 있는지 확인 (커스텀에서 추가됐을 수 있음)
      const alreadyExists = emotionPositions.some(ep => ep.emotion === emotion)
      if (!alreadyExists) {
        emotionPositions.push({ emotion, position: earliestPos })
      }
    }
  }

  // 위치 순서로 정렬
  emotionPositions.sort((a, b) => a.position - b.position)

  // 감정만 추출해서 반환 (중복 제거)
  const result: EmotionType[] = []
  for (const { emotion } of emotionPositions) {
    if (!result.includes(emotion)) {
      result.push(emotion)
    }
  }

  return result
}

function formatDate(dateString: string | null, mounted: boolean = true): string {
  if (!dateString) return '-'
  if (!mounted) return '-' // Prevent hydration mismatch
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTimeAgo(dateString: string | null, mounted: boolean = true): string {
  if (!dateString) return ''
  if (!mounted) return '-' // Prevent hydration mismatch
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${diffDay}일 전`
}

function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

interface AgentWithMemory extends Omit<DeployedAgent, 'emotion_avatars' | 'custom_emotions'> {
  emotion_avatars?: EmotionAvatars | null
  custom_emotions?: CustomEmotion[] | null
  identity?: {
    id?: string
    core_values: string[]
    personality_traits: string[]
    communication_style: string
    expertise_areas: any[]
    working_style: string
    strengths: string[]
    growth_areas: string[]
    self_summary: string
    recent_focus: string
    total_conversations: number
    total_tasks_completed: number
    total_decisions_made: number
  }
  work_logs?: any[]
  knowledge?: any[]
  commits?: any[]
  team?: {
    id: string
    name: string
    description?: string
    logo_url?: string
    founder_id: string
  }
  chat_rooms?: any[]
  tasks?: any[]
  project_stats?: any[]
}

// 편집 가능한 태그 입력 컴포넌트
function EditableTagInput({
  tags,
  onChange,
  placeholder,
  color,
  isDark,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
  color: string
  isDark: boolean
}) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      if (!tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()])
      }
      setInputValue('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="px-3 py-1 rounded-lg text-sm flex items-center gap-1"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm border',
          isDark
            ? 'bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-500'
            : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
        )}
      />
    </div>
  )
}

// 지식베이스 탭 컴포넌트
function KnowledgeBaseTab({ agentId, isDark, mounted }: { agentId: string; isDark: boolean; mounted: boolean }) {
  const [documents, setDocuments] = useState<any[]>([])
  const [stats, setStats] = useState<{ documentCount: number; chunkCount: number; lastUpdated: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState<'text' | 'url' | 'file'>('text')
  const [textInput, setTextInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 문서 목록 조회
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [agentId])

  // 텍스트 추가
  const handleAddText = async () => {
    if (!textInput.trim()) return
    setUploading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          text: textInput,
          title: textTitle || '직접 입력',
        }),
      })
      if (res.ok) {
        setTextInput('')
        setTextTitle('')
        setShowAddModal(false)
        fetchDocuments()
      } else {
        const error = await res.json()
        alert(error.error || '추가 실패')
      }
    } catch (error) {
      alert('추가 실패')
    } finally {
      setUploading(false)
    }
  }

  // URL 추가
  const handleAddUrl = async () => {
    if (!urlInput.trim()) return
    setUploading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'url',
          url: urlInput,
          title: urlTitle || undefined,
        }),
      })
      if (res.ok) {
        setUrlInput('')
        setUrlTitle('')
        setShowAddModal(false)
        fetchDocuments()
      } else {
        const error = await res.json()
        alert(error.error || '추가 실패')
      }
    } catch (error) {
      alert('추가 실패')
    } finally {
      setUploading(false)
    }
  }

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        setShowAddModal(false)
        fetchDocuments()
      } else {
        const error = await res.json()
        alert(error.error || '업로드 실패')
      }
    } catch (error) {
      alert('업로드 실패')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 문서 삭제
  const handleDelete = async (documentId: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge?documentId=${documentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchDocuments()
      }
    } catch (error) {
      alert('삭제 실패')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
          지식베이스
        </h2>
        <div className="w-10 h-1 bg-accent rounded-full mb-6" />
        <p className={cn('text-sm mb-6', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          문서, 텍스트, URL을 추가하면 에이전트가 이 지식을 바탕으로 더 똑똑하게 답변합니다.
        </p>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200')}>
            <div className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{stats.documentCount}</div>
            <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>문서</div>
          </div>
          <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200')}>
            <div className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{stats.chunkCount}</div>
            <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>청크</div>
          </div>
          <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200')}>
            <div className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
              {stats.lastUpdated ? formatTimeAgo(stats.lastUpdated, mounted) : '-'}
            </div>
            <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>최근 업데이트</div>
          </div>
        </div>
      )}

      {/* 추가 버튼 */}
      <button
        onClick={() => setShowAddModal(true)}
        className={cn(
          'w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors',
          isDark
            ? 'border-zinc-700 hover:border-accent hover:bg-accent/10 text-zinc-400 hover:text-accent'
            : 'border-zinc-300 hover:border-accent hover:bg-accent/10 text-zinc-500 hover:text-accent'
        )}
      >
        <Plus className="w-5 h-5" />
        <span>지식 추가하기</span>
      </button>

      {/* 문서 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : documents.length === 0 ? (
        <div className={cn('text-center py-12 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
          <BookOpen className={cn('w-12 h-12 mx-auto mb-4', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
          <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            아직 추가된 지식이 없습니다
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border',
                isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isDark ? 'bg-zinc-700' : 'bg-zinc-100')}>
                  {doc.sourceType === 'url' ? (
                    <Link2 className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  ) : doc.sourceType === 'pdf' ? (
                    <FileText className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  ) : (
                    <FileText className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  )}
                </div>
                <div>
                  <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{doc.title}</div>
                  <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    {doc.chunksCount}개 청크 · {formatTimeAgo(doc.createdAt, mounted)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={cn('w-full max-w-lg rounded-2xl p-6', isDark ? 'bg-zinc-900' : 'bg-white')}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>지식 추가</h3>
              <button onClick={() => setShowAddModal(false)} className={cn('p-2 rounded-lg', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 타입 선택 */}
            <div className="flex gap-2 mb-6">
              {[
                { type: 'text' as const, label: '텍스트', icon: FileText },
                { type: 'url' as const, label: 'URL', icon: Link2 },
                { type: 'file' as const, label: '파일', icon: Upload },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setAddType(type)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors',
                    addType === type
                      ? 'bg-accent text-white border-accent'
                      : isDark
                        ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* 텍스트 입력 */}
            {addType === 'text' && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="제목 (선택)"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border',
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'
                  )}
                />
                <textarea
                  placeholder="지식으로 추가할 텍스트를 입력하세요..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={8}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border resize-none',
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'
                  )}
                />
                <button
                  onClick={handleAddText}
                  disabled={!textInput.trim() || uploading}
                  className="w-full py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50"
                >
                  {uploading ? '추가 중...' : '추가하기'}
                </button>
              </div>
            )}

            {/* URL 입력 */}
            {addType === 'url' && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="제목 (선택, 비워두면 자동 추출)"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border',
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'
                  )}
                />
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border',
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'
                  )}
                />
                <button
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim() || uploading}
                  className="w-full py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50"
                >
                  {uploading ? '추가 중...' : '추가하기'}
                </button>
              </div>
            )}

            {/* 파일 업로드 */}
            {addType === 'file' && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    'w-full py-12 rounded-xl border-2 border-dashed flex flex-col items-center gap-2',
                    isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-300 hover:border-zinc-400'
                  )}
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  ) : (
                    <>
                      <Upload className={cn('w-8 h-8', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                      <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        클릭하여 파일 선택
                      </span>
                      <span className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                        .txt, .md, .pdf 지원
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 앱 연동 탭 컴포넌트
interface AppProvider {
  id: string
  name: string
  description: string
  icon_url: string
  capabilities: Record<string, boolean>
}

interface UserConnection {
  id: string
  provider_id: string
  status: string
  account_info?: {
    name?: string
    email?: string
    avatar_url?: string
    team_name?: string
  }
  created_at: string
  app_providers?: AppProvider
}

interface AgentConnection {
  id: string
  agent_id: string
  user_connection_id: string
  is_active: boolean
  user_app_connections?: UserConnection
}

function IntegrationsTab({ agentId, isDark }: { agentId: string; isDark: boolean }) {
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<AppProvider[]>([])
  const [userConnections, setUserConnections] = useState<UserConnection[]>([])
  const [agentConnections, setAgentConnections] = useState<AgentConnection[]>([])
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<UserConnection | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [syncingResource, setSyncingResource] = useState<string | null>(null)

  // 실제 로고 컴포넌트 사용 (getAppLogo from @/components/icons/app-logos)

  useEffect(() => {
    loadIntegrations()
  }, [agentId])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}/integrations`)
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
        setUserConnections(data.userConnections || [])
        setAgentConnections(data.agentConnections || [])
      }
    } catch (err) {
      console.error('Failed to load integrations:', err)
    } finally {
      setLoading(false)
    }
  }

  const startOAuth = async (providerId: string) => {
    try {
      setConnectingProvider(providerId)
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_oauth', providerId }),
      })

      if (res.ok) {
        const { authUrl } = await res.json()
        window.location.href = authUrl
      }
    } catch (err) {
      console.error('OAuth start failed:', err)
    } finally {
      setConnectingProvider(null)
    }
  }

  const connectToAgent = async (userConnectionId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_to_agent', userConnectionId }),
      })

      if (res.ok) {
        await loadIntegrations()
      }
    } catch (err) {
      console.error('Connect to agent failed:', err)
    }
  }

  const disconnectFromAgent = async (connectionId: string) => {
    if (!confirm('이 앱 연결을 해제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agentId}/integrations?connectionId=${connectionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await loadIntegrations()
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const browseResources = async (connection: UserConnection) => {
    setSelectedConnection(connection)
    setShowResourceModal(true)
    setResourcesLoading(true)

    try {
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_resources',
          userConnectionId: connection.id,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResources(data.resources || [])
      }
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setResourcesLoading(false)
    }
  }

  const syncResource = async (resource: any) => {
    const agentConn = agentConnections.find(
      (c) => c.user_connection_id === selectedConnection?.id
    )
    if (!agentConn) {
      alert('먼저 이 앱을 에이전트에 연결해주세요')
      return
    }

    try {
      setSyncingResource(resource.id)
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_resource',
          agentConnectionId: agentConn.id,
          resourceId: resource.id,
          resourceName: resource.name,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          alert(`"${resource.name}"이(가) 지식베이스에 추가되었습니다!`)
        } else {
          alert(result.error || '동기화 실패')
        }
      }
    } catch (err) {
      console.error('Sync failed:', err)
      alert('동기화 중 오류가 발생했습니다')
    } finally {
      setSyncingResource(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const connectedProviderIds = userConnections.map((c) => c.provider_id)
  const agentConnectedIds = agentConnections.map((c) => c.user_connection_id)

  return (
    <div className="space-y-6">
      {/* 연결된 앱 */}
      <div>
        <h3 className={cn('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          연결된 앱
        </h3>

        {userConnections.length === 0 ? (
          <div
            className={cn(
              'text-center py-8 rounded-xl border-2 border-dashed',
              isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
            )}
          >
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>연결된 앱이 없습니다</p>
            <p className="text-sm mt-1">아래에서 앱을 연결해보세요</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {userConnections.map((conn) => {
              const isConnectedToAgent = agentConnectedIds.includes(conn.id)
              const provider = providers.find((p) => p.id === conn.provider_id)

              return (
                <div
                  key={conn.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border',
                    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getAppLogo(conn.provider_id, { size: 32 }) || <Link2 className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div>
                      <div className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {provider?.name || conn.provider_id}
                      </div>
                      <div className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {conn.account_info?.email ||
                          conn.account_info?.name ||
                          conn.account_info?.team_name ||
                          '연결됨'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnectedToAgent ? (
                      <>
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-500 rounded-full">
                          에이전트 연결됨
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => browseResources(conn)}
                          className="text-blue-500"
                        >
                          <FolderOpen className="w-4 h-4 mr-1" />
                          찾아보기
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const agentConn = agentConnections.find(
                              (c) => c.user_connection_id === conn.id
                            )
                            if (agentConn) disconnectFromAgent(agentConn.id)
                          }}
                          className="text-red-500"
                        >
                          연결 해제
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectToAgent(conn.id)}
                        className="text-blue-500"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        에이전트에 연결
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 앱 추가 */}
      <div>
        <h3 className={cn('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          앱 추가
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {providers.map((provider) => {
            const isConnected = connectedProviderIds.includes(provider.id)
            const isConnecting = connectingProvider === provider.id

            return (
              <button
                key={provider.id}
                onClick={() => !isConnected && !isConnecting && startOAuth(provider.id)}
                disabled={isConnected || isConnecting}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                  isDark
                    ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                    : 'bg-white border-gray-200 hover:bg-gray-50',
                  isConnected && 'opacity-50 cursor-not-allowed',
                  isConnecting && 'animate-pulse'
                )}
              >
                <div className="w-10 h-10 flex items-center justify-center">
                  {getAppLogo(provider.id, { size: 40 }) || <Link2 className="w-8 h-8 text-gray-400" />}
                </div>
                <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  {provider.name}
                </span>
                {isConnected ? (
                  <span className="text-xs text-green-500">연결됨</span>
                ) : isConnecting ? (
                  <span className="text-xs text-blue-500">연결 중...</span>
                ) : (
                  <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    연결하기
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 리소스 브라우저 모달 */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={cn(
              'w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between p-4 border-b',
                isDark ? 'border-gray-700' : 'border-gray-200'
              )}
            >
              <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                <span className="flex items-center gap-2">
                  {getAppLogo(selectedConnection?.provider_id || '', { size: 24 })} 파일 선택
                </span>
              </h3>
              <button
                onClick={() => setShowResourceModal(false)}
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {resourcesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : resources.length === 0 ? (
                <div className={cn('text-center py-8', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  파일을 찾을 수 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {resource.type === 'folder'
                            ? '📁'
                            : resource.type === 'repo'
                              ? '📦'
                              : resource.type === 'page'
                                ? '📄'
                                : resource.type === 'channel'
                                  ? '💬'
                                  : '📄'}
                        </span>
                        <div>
                          <div className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {resource.name}
                          </div>
                          {resource.metadata?.description && (
                            <div
                              className={cn(
                                'text-xs truncate max-w-[300px]',
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              )}
                            >
                              {resource.metadata.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {resource.type !== 'folder' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncResource(resource)}
                          disabled={syncingResource === resource.id}
                          className="text-blue-500"
                        >
                          {syncingResource === resource.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              지식베이스에 추가
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// API 연결 타입
interface ApiConnection {
  id: string
  name: string
  description?: string
  provider_type: 'preset' | 'custom' | 'openapi'
  base_url: string
  auth_type: string
  endpoints: Array<{
    id: string
    name: string
    method: string
    path: string
    description?: string
  }>
  is_active: boolean
  last_used_at?: string
  last_error?: string
}

interface ApiPreset {
  id: string
  name: string
  description?: string
  category: string
  base_url: string
  auth_type: string
  auth_config_template: any
  endpoints: any[]
  setup_guide?: string
  api_key_url?: string
  documentation_url?: string
}

// API 카테고리 한글 라벨
const apiCategoryLabels: Record<string, string> = {
  government: '정부/공공',
  startup: '스타트업',
  finance: '금융',
  weather: '날씨',
  search: '검색',
  news: '뉴스',
  social: '소셜',
  other: '기타',
}

// API Connections Tab Component
function ApiConnectionsTab({ agentId, isDark }: { agentId: string; isDark: boolean }) {
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [presets, setPresets] = useState<ApiPreset[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<ApiPreset | null>(null)
  const [testingApi, setTestingApi] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<any>(null)

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_url: '',
    auth_type: 'api_key',
    api_key: '',
    api_secret: '',
    preset_id: '',
  })

  useEffect(() => {
    loadData()
  }, [agentId])

  const loadData = async () => {
    try {
      setLoading(true)

      // API 연결 목록 로드
      const connRes = await fetch(`/api/agents/${agentId}/apis`)
      if (connRes.ok) {
        const data = await connRes.json()
        setConnections(data.connections || [])
      }

      // 프리셋 목록 로드
      const presetRes = await fetch('/api/public-apis')
      if (presetRes.ok) {
        const data = await presetRes.json()
        setPresets(data.presets || [])
      }
    } catch (err) {
      console.error('Failed to load API data:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectPreset = (preset: ApiPreset) => {
    setSelectedPreset(preset)
    setFormData({
      ...formData,
      name: preset.name,
      description: preset.description || '',
      base_url: preset.base_url,
      auth_type: preset.auth_type,
      preset_id: preset.id,
    })
  }

  const addConnection = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          provider_type: selectedPreset ? 'preset' : 'custom',
          preset_id: formData.preset_id || undefined,
          base_url: formData.base_url,
          auth_type: formData.auth_type,
          auth_config: {
            key: formData.api_key,
            secret: formData.api_secret,
            ...(selectedPreset?.auth_config_template || {}),
          },
          endpoints: selectedPreset?.endpoints || [],
        }),
      })

      if (res.ok) {
        await loadData()
        setShowAddModal(false)
        resetForm()
      }
    } catch (err) {
      console.error('Failed to add API connection:', err)
    }
  }

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('이 API 연결을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agentId}/apis/${connectionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setConnections(connections.filter((c) => c.id !== connectionId))
      }
    } catch (err) {
      console.error('Failed to delete API connection:', err)
    }
  }

  const testConnection = async (connectionId: string) => {
    try {
      setTestingApi(connectionId)
      setTestResult(null)

      const res = await fetch(`/api/agents/${agentId}/apis/${connectionId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const result = await res.json()
      setTestResult({ connectionId, ...result })
    } catch (err) {
      setTestResult({ connectionId, success: false, error: '테스트 실패' })
    } finally {
      setTestingApi(null)
    }
  }

  const toggleActive = async (connectionId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/apis/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (res.ok) {
        setConnections(
          connections.map((c) =>
            c.id === connectionId ? { ...c, is_active: !isActive } : c
          )
        )
      }
    } catch (err) {
      console.error('Failed to toggle API connection:', err)
    }
  }

  const resetForm = () => {
    setSelectedPreset(null)
    setFormData({
      name: '',
      description: '',
      base_url: '',
      auth_type: 'api_key',
      api_key: '',
      api_secret: '',
      preset_id: '',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // 카테고리별 프리셋 그룹화
  const presetsByCategory = presets.reduce((acc, preset) => {
    const cat = preset.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(preset)
    return acc
  }, {} as Record<string, ApiPreset[]>)

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl md:text-3xl font-bold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
            API 연결
          </h2>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
            외부 API를 연결하여 에이전트가 실시간 정보를 수집할 수 있습니다
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          API 추가
        </Button>
      </div>

      {/* 연결된 API 목록 */}
      {connections.length > 0 ? (
        <div className="grid gap-4">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={cn(
                'p-4 rounded-xl border transition-all',
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* 상태 표시기 */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      conn.is_active
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-gray-500/10 text-gray-500'
                    )}
                  >
                    <Zap className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        {conn.name}
                      </h3>
                      {conn.provider_type === 'preset' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500">
                          공공 API
                        </span>
                      )}
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          conn.is_active
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-gray-500/10 text-gray-500'
                        )}
                      >
                        {conn.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    {conn.description && (
                      <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {conn.description}
                      </p>
                    )}
                    <div className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {conn.endpoints?.length || 0}개 엔드포인트 • {conn.base_url}
                    </div>
                    {conn.last_error && (
                      <div className="text-xs text-red-500 mt-1">
                        마지막 오류: {conn.last_error}
                      </div>
                    )}

                    {/* 테스트 결과 */}
                    {testResult?.connectionId === conn.id && (
                      <div
                        className={cn(
                          'mt-3 p-3 rounded-lg text-sm',
                          testResult.success
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500'
                        )}
                      >
                        {testResult.success ? (
                          <>
                            ✓ 연결 성공 ({testResult.response_time_ms}ms)
                            {testResult.response_preview && (
                              <pre className="mt-2 text-xs overflow-auto max-h-32">
                                {testResult.response_preview}
                              </pre>
                            )}
                          </>
                        ) : (
                          <>✗ {testResult.error}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testConnection(conn.id)}
                    disabled={testingApi === conn.id}
                  >
                    {testingApi === conn.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(conn.id, conn.is_active)}
                  >
                    {conn.is_active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteConnection(conn.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* 엔드포인트 목록 */}
              {conn.endpoints?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
                  <div className={cn('text-xs font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    사용 가능한 기능
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conn.endpoints.map((ep) => (
                      <span
                        key={ep.id}
                        className={cn(
                          'px-2 py-1 text-xs rounded-md',
                          isDark ? 'bg-zinc-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        <span className="font-mono text-[10px] mr-1 opacity-50">{ep.method}</span>
                        {ep.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 연결 가능한 API 프리셋 */}
          {Object.entries(presetsByCategory).map(([category, categoryPresets]) => (
            <div key={category}>
              <h3 className={cn('text-sm font-semibold mb-3 flex items-center gap-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {apiCategoryLabels[category] || category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      selectPreset(preset)
                      setShowAddModal(true)
                    }}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all group hover:scale-[1.02]',
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/50'
                        : 'bg-white border-zinc-200 hover:border-emerald-500/50 hover:bg-zinc-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        isDark ? 'bg-zinc-800 group-hover:bg-emerald-500/10' : 'bg-zinc-100 group-hover:bg-emerald-500/10'
                      )}>
                        <Zap className={cn('w-5 h-5', isDark ? 'text-zinc-500 group-hover:text-emerald-500' : 'text-zinc-400 group-hover:text-emerald-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn('font-medium text-sm mb-1', isDark ? 'text-white' : 'text-zinc-900')}>
                          {preset.name}
                        </h4>
                        <p className={cn('text-xs line-clamp-2', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                          {preset.description}
                        </p>
                        <div className={cn('text-xs mt-2', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                          {preset.endpoints?.length || 0}개 엔드포인트
                        </div>
                      </div>
                      <ChevronRight className={cn('w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', isDark ? 'text-emerald-500' : 'text-emerald-600')} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* 커스텀 API 추가 */}
          <div>
            <h3 className={cn('text-sm font-semibold mb-3 flex items-center gap-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              커스텀 API
            </h3>
            <button
              onClick={() => {
                setSelectedPreset(null)
                setShowAddModal(true)
              }}
              className={cn(
                'w-full p-4 rounded-xl border-2 border-dashed text-left transition-all hover:scale-[1.01]',
                isDark
                  ? 'border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900/50'
                  : 'border-zinc-200 hover:border-blue-500/50 hover:bg-zinc-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}>
                  <Plus className={cn('w-5 h-5', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                </div>
                <div>
                  <h4 className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                    직접 API 추가
                  </h4>
                  <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                    REST API를 직접 설정하여 연결합니다
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* API 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className={cn(
              'w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                API 연결 추가
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className={cn('p-2 rounded-lg', isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 프리셋 선택 */}
            {!selectedPreset ? (
              <div className="space-y-6">
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  공공 API 프리셋을 선택하거나 커스텀 API를 추가하세요
                </p>

                {Object.entries(presetsByCategory).map(([category, categoryPresets]) => (
                  <div key={category}>
                    <h4 className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      {apiCategoryLabels[category] || category}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {categoryPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => selectPreset(preset)}
                          className={cn(
                            'p-4 rounded-xl border text-left transition-all',
                            isDark
                              ? 'bg-zinc-800 border-zinc-700 hover:border-blue-500'
                              : 'bg-gray-50 border-gray-200 hover:border-blue-500'
                          )}
                        >
                          <div className={cn('font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
                            {preset.name}
                          </div>
                          <div className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* 커스텀 API 옵션 */}
                <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                  <button
                    onClick={() => setSelectedPreset({ id: 'custom' } as ApiPreset)}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 border-dashed text-center transition-all',
                      isDark
                        ? 'border-zinc-700 hover:border-zinc-600'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    <Plus className={cn('w-6 h-6 mx-auto mb-2', isDark ? 'text-gray-500' : 'text-gray-400')} />
                    <div className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      커스텀 API 추가
                    </div>
                    <div className={cn('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      직접 API 정보를 입력합니다
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* API 설정 폼 */
              <div className="space-y-4">
                {/* 뒤로 가기 */}
                <button
                  onClick={resetForm}
                  className={cn('flex items-center gap-2 text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}
                >
                  <ArrowLeft className="w-4 h-4" />
                  프리셋 다시 선택
                </button>

                {/* 프리셋 정보 */}
                {selectedPreset.id !== 'custom' && (
                  <div className={cn('p-4 rounded-xl', isDark ? 'bg-zinc-800' : 'bg-gray-50')}>
                    <div className={cn('font-medium mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                      {selectedPreset.name}
                    </div>
                    {selectedPreset.setup_guide && (
                      <div className={cn('text-sm whitespace-pre-line', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedPreset.setup_guide}
                      </div>
                    )}
                    {selectedPreset.api_key_url && (
                      <a
                        href={selectedPreset.api_key_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-500 mt-2"
                      >
                        API 키 발급받기
                        <ChevronRight className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                {/* 이름 */}
                <div>
                  <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    이름
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="API 연결 이름"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                {/* Base URL (커스텀인 경우) */}
                {selectedPreset.id === 'custom' && (
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={formData.base_url}
                      onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                      placeholder="https://api.example.com"
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                )}

                {/* API Key */}
                <div>
                  <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    API 키
                  </label>
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="API 키를 입력하세요"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                {/* API Secret (네이버 등 필요한 경우) */}
                {selectedPreset?.auth_config_template?.header_name_secret && (
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      API Secret
                    </label>
                    <input
                      type="password"
                      value={formData.api_secret}
                      onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                      placeholder="API Secret을 입력하세요"
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={addConnection}
                    disabled={!formData.name || !formData.api_key}
                  >
                    연결 추가
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AgentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { accentColor: accentColorId } = useThemeStore()
  const [mounted, setMounted] = useState(false)
  const agentId = params.id as string

  // 사용자가 선택한 테마 색상
  const userAccentColor = accentColors.find(c => c.id === accentColorId)?.color || '#3b82f6'
  const statusConfig = getStatusConfig(userAccentColor)

  // Prevent hydration mismatch by waiting for client mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  const [agent, setAgent] = useState<AgentWithMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('about')

  // 편집 모드 상태
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // 프롬프트 섹션 확장 상태
  const [expandedPromptSections, setExpandedPromptSections] = useState<Record<string, boolean>>({})

  // Image upload states
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isGif, setIsGif] = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)

  // Chat states
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    role: 'user' | 'agent' | 'system' // system: 입장 알림 등
    content: string
    timestamp: Date
    image?: string
    emotion?: EmotionType // 단일 감정 (하위 호환성)
    emotions?: EmotionType[] // 다중 감정 (텍스트 순서대로)
    // 업무 실행 관련
    isTask?: boolean
    taskStatus?: 'pending' | 'running' | 'completed' | 'failed'
    taskResult?: {
      output: string
      sources: string[]
      toolsUsed: string[]
      error?: string
    }
  }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatTypingStatus, setChatTypingStatus] = useState<'none' | 'read' | 'typing'>('none')
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [chatImageFile, setChatImageFile] = useState<File | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Voice call states
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Int16Array[]>([])
  const isPlayingRef = useRef(false)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  // Voice preview state
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)
  const previewWsRef = useRef<WebSocket | null>(null)
  const previewAudioContextRef = useRef<AudioContext | null>(null)
  const previewAudioQueueRef = useRef<Int16Array[]>([])
  const previewIsPlayingRef = useRef(false)

  // 감정 아바타 상태
  const [emotionAvatars, setEmotionAvatars] = useState<EmotionAvatars>({})

  // 감정 GIF에서 랜덤으로 1개 선택하는 헬퍼 함수
  // seed를 전달하면 동일한 seed에 대해 동일한 결과 반환 (메시지별 고정용)
  const getRandomEmotionGif = (emotionId: string, seed?: string): string | undefined => {
    const avatarData = emotionAvatars[emotionId]
    if (!avatarData) return undefined
    if (Array.isArray(avatarData)) {
      if (avatarData.length === 0) return undefined
      if (avatarData.length === 1) return avatarData[0]
      if (seed) {
        // 더 분산된 해시를 위해 FNV-1a 해시 사용
        let hash = 2166136261
        for (let i = 0; i < seed.length; i++) {
          hash ^= seed.charCodeAt(i)
          hash = Math.imul(hash, 16777619)
        }
        // 추가 믹싱
        hash ^= hash >>> 16
        hash = Math.imul(hash, 0x85ebca6b)
        hash ^= hash >>> 13
        hash = Math.imul(hash, 0xc2b2ae35)
        hash ^= hash >>> 16
        const index = Math.abs(hash) % avatarData.length
        return avatarData[index]
      }
      return avatarData[Math.floor(Math.random() * avatarData.length)]
    }
    return avatarData as string
  }

  // 채팅 메인 GIF 상태
  const [chatMainGif, setChatMainGif] = useState<string | null>(null)
  const [uploadingChatMainGif, setUploadingChatMainGif] = useState(false)
  const chatMainGifInputRef = useRef<HTMLInputElement>(null)
  const [uploadingEmotion, setUploadingEmotion] = useState<string | null>(null)

  // 업무 지시 모드 상태
  const [isTaskMode, setIsTaskMode] = useState(false)
  const [isAnalyzingTask, setIsAnalyzingTask] = useState(false)

  // 업무지시 모드 모델 선택
  const TASK_MODE_MODELS = [
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', provider: 'xai' },
    { id: 'grok-4-1', name: 'Grok 4.1', provider: 'xai' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', provider: 'anthropic' },
  ]
  const [selectedTaskModel, setSelectedTaskModel] = useState('grok-4-1-fast')
  const [isTaskModelDropdownOpen, setIsTaskModelDropdownOpen] = useState(false)
  const [pendingTask, setPendingTask] = useState<{
    analysis: {
      title: string
      summary: string
      steps: string[]
      expected_output: string
      estimated_time: string
      clarifications: string[]
      confidence: number
    }
    confirmation_message: string
    original_instruction: string
  } | null>(null)
  const [isExecutingTask, setIsExecutingTask] = useState(false)

  // 특수 액션 상태 (프로젝트 생성 등)
  const [pendingAction, setPendingAction] = useState<{
    action_type: 'project_create' | 'task_create'
    confirmation_message: string
    input_fields: Array<{
      name: string
      label: string
      type: 'text' | 'textarea' | 'select' | 'date'
      required: boolean
      placeholder?: string
      options?: Array<{ value: string; label: string }>
    }>
    extracted_data?: any
  } | null>(null)
  const [actionFormData, setActionFormData] = useState<Record<string, string>>({})
  const [isExecutingAction, setIsExecutingAction] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral')
  const emotionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 커스텀 감정 상태
  const [customEmotions, setCustomEmotions] = useState<CustomEmotion[]>([])
  const [showAddEmotionModal, setShowAddEmotionModal] = useState(false)
  const [editingEmotion, setEditingEmotion] = useState<CustomEmotion | null>(null)
  const [newEmotion, setNewEmotion] = useState<Partial<CustomEmotion>>({
    label: '',
    emoji: '',
    description: '',
    keywords: [],
  })
  const [keywordInput, setKeywordInput] = useState('')

  // 이모티콘 라이브러리 상태
  const [showEmoticonModal, setShowEmoticonModal] = useState(false)
  const [emoticons, setEmoticons] = useState<Array<{
    id: string
    name: string
    image_url: string
    image_urls: string[]
    category: string
    keywords: string[]
  }>>([])
  const [emoticonsLoading, setEmoticonsLoading] = useState(false)

  // 채팅 히스토리 로딩 상태
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // 메시지 보내기 모달 상태
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')

  // 에이전트 ID가 변경되면 상태 초기화
  useEffect(() => {
    // 이전 에이전트의 채팅 기록 초기화
    setChatMessages([])
    setHistoryLoaded(false)
    fetchAgent()
  }, [agentId])

  // 채팅 히스토리는 자동으로 로드하지 않음 (대화기록 탭에서만 조회)

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const fetchAgent = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}`)
      if (!res.ok) throw new Error('에이전트를 불러오는데 실패했습니다')
      const data = await res.json()
      setAgent(data)
    } catch (error) {
      console.error('Agent fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 채팅 히스토리 불러오기
  const fetchChatHistory = async () => {
    try {
      console.log('[ChatHistory] Fetching history for agent:', agentId)
      const res = await fetch(`/api/agents/${agentId}/history`)
      if (res.ok) {
        const { data } = await res.json()
        console.log('[ChatHistory] Loaded messages:', data?.length || 0)
        if (data && data.length > 0) {
          const loadedMessages = data.map((msg: any) => ({
            id: msg.id,
            role: msg.role as 'user' | 'agent',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            image: msg.image_url || undefined,
            emotion: msg.emotion as EmotionType | undefined,
          }))
          setChatMessages(loadedMessages)
        }
      } else {
        console.error('[ChatHistory] Failed to fetch:', res.status)
      }
    } catch (err) {
      console.error('Chat history fetch error:', err)
    } finally {
      setHistoryLoaded(true)
    }
  }

  // 메시지를 히스토리에 저장
  const saveMessageToHistory = async (role: 'user' | 'agent', content: string, imageUrl?: string, emotion?: string) => {
    try {
      console.log('[ChatHistory] Saving message:', { role, content: content.substring(0, 50) + '...' })
      const res = await fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          image_url: imageUrl,
          emotion,
        }),
      })
      if (res.ok) {
        console.log('[ChatHistory] Message saved successfully')
      } else {
        console.error('[ChatHistory] Failed to save:', res.status, await res.text())
      }
    } catch (err) {
      console.error('Save message error:', err)
    }
  }

  const handleToggleStatus = async () => {
    if (!agent) return
    const newStatus: AgentStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setAgent({ ...agent, status: newStatus })
      }
    } catch (err) {
      console.error('Status toggle error:', err)
    }
  }

  // 이모티콘 라이브러리 불러오기
  const fetchEmoticons = async () => {
    try {
      setEmoticonsLoading(true)
      const res = await fetch('/api/emoticons')
      if (res.ok) {
        const { data } = await res.json()
        // image_urls가 없는 경우 image_url로 대체
        const processed = (data || []).map((e: any) => ({
          ...e,
          image_urls: e.image_urls?.length > 0 ? e.image_urls : (e.image_url ? [e.image_url] : []),
        }))
        setEmoticons(processed)
      }
    } catch (err) {
      console.error('Emoticons fetch error:', err)
    } finally {
      setEmoticonsLoading(false)
    }
  }

  // 이모티콘 모달 열릴 때 또는 컴포넌트 마운트 시 불러오기 (키워드 감지용)
  useEffect(() => {
    // 컴포넌트 마운트 시 이모티콘 로드 (키워드 감지용)
    fetchEmoticons()
  }, [])

  useEffect(() => {
    if (showEmoticonModal && emoticons.length === 0) {
      fetchEmoticons()
    }
  }, [showEmoticonModal])

  // 이모티콘 선택 시 채팅에 전송
  const handleSelectEmoticon = (emoticon: { image_url: string; name: string }) => {
    // 이모티콘 이미지를 채팅 메시지로 전송
    const emoticonMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: '',
      timestamp: new Date(),
      image: emoticon.image_url,
    }
    setChatMessages((prev) => [...prev, emoticonMessage])
    setShowEmoticonModal(false)
  }

  // 키워드로 매칭되는 이모티콘 찾기 및 랜덤 선택
  const findMatchingEmoticons = (message: string): typeof emoticons => {
    if (!message || emoticons.length === 0) return []

    const messageLower = message.toLowerCase()
    const matchingEmoticons = emoticons.filter(emoticon => {
      if (!emoticon.keywords || emoticon.keywords.length === 0) return false
      return emoticon.keywords.some(keyword =>
        messageLower.includes(keyword.toLowerCase())
      )
    })

    return matchingEmoticons
  }

  // 랜덤으로 이모티콘 하나 선택
  const selectRandomEmoticon = (matchingEmoticons: typeof emoticons): typeof emoticons[0] | null => {
    if (matchingEmoticons.length === 0) return null
    const randomIndex = Math.floor(Math.random() * matchingEmoticons.length)
    return matchingEmoticons[randomIndex]
  }

  // 메시지에서 키워드 감지하고 이모티콘 자동 전송
  const sendKeywordEmoticon = (message: string): boolean => {
    const matchingEmoticons = findMatchingEmoticons(message)
    const selectedEmoticon = selectRandomEmoticon(matchingEmoticons)

    if (selectedEmoticon) {
      // 카드 내 이미지 중 랜덤 선택
      const imageUrls = selectedEmoticon.image_urls?.length > 0
        ? selectedEmoticon.image_urls
        : [selectedEmoticon.image_url]
      const randomImageIndex = Math.floor(Math.random() * imageUrls.length)
      const selectedImage = imageUrls[randomImageIndex]

      // 약간의 딜레이 후 이모티콘 메시지 추가
      setTimeout(() => {
        const emoticonMessage = {
          id: `emoticon-${Date.now()}`,
          role: 'user' as const,
          content: '',
          timestamp: new Date(),
          image: selectedImage,
        }
        setChatMessages((prev) => [...prev, emoticonMessage])
      }, 100)
      return true
    }
    return false
  }

  // 에이전트 로드 시 감정 아바타 및 커스텀 감정 설정
  useEffect(() => {
    if (agent?.emotion_avatars) {
      setEmotionAvatars(agent.emotion_avatars as EmotionAvatars)
    }
    if (agent?.custom_emotions) {
      setCustomEmotions(agent.custom_emotions as CustomEmotion[])
    }
    if ((agent as any)?.chat_main_gif) {
      setChatMainGif((agent as any).chat_main_gif)
    }
  }, [agent?.emotion_avatars, agent?.custom_emotions, (agent as any)?.chat_main_gif])

  // 감정 GIF 재생 후 기본 감정으로 복귀 (3초 후)
  useEffect(() => {
    if (currentEmotion !== 'neutral') {
      const timer = setTimeout(() => {
        setCurrentEmotion('neutral')
      }, 3000) // 3초 후 기본 감정으로 복귀

      return () => clearTimeout(timer)
    }
  }, [currentEmotion])

  // 모든 감정 목록 (기본 + 커스텀, 수정된 키워드 적용)
  const allEmotions: CustomEmotion[] = [
    // 기본 감정: customEmotions에 오버라이드가 있으면 그것을 사용
    ...DEFAULT_EMOTIONS.map(defaultE => {
      const override = customEmotions.find(c => c.id === defaultE.id && c.isDefault)
      return override ? { ...override } : { ...defaultE, keywords: [...defaultE.keywords] }
    }),
    // 커스텀 감정 (기본 감정 오버라이드 제외)
    ...customEmotions.filter(e => !e.isDefault),
  ]

  // 감정 아바타 업로드 (최대 4개까지 추가)
  const handleEmotionAvatarUpload = async (emotionId: string, file: File) => {
    if (!agent) return

    // 현재 이미지 배열 가져오기
    const currentData = emotionAvatars[emotionId]
    const currentUrls: string[] = currentData
      ? (Array.isArray(currentData) ? currentData : [currentData])
      : []

    // 4개 제한 체크
    if (currentUrls.length >= 4) {
      alert('감정당 최대 4개의 GIF만 등록 가능합니다. 기존 이미지를 삭제하고 추가하세요.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    setUploadingEmotion(emotionId)

    try {
      const supabase = createClient()

      // 파일 확장자 결정
      const ext = file.type === 'image/gif' ? 'gif' : file.type === 'image/png' ? 'png' : 'jpg'
      const fileName = `emotion-${agent.id}-${emotionId}-${Date.now()}.${ext}`

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      // Public URL 가져오기
      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName)
      const url = urlData.publicUrl

      // 기존 배열에 새 URL 추가 (최대 4개)
      const newUrls = [...currentUrls, url].slice(0, 4)
      const newEmotionAvatars = { ...emotionAvatars, [emotionId]: newUrls }

      // 에이전트 데이터 업데이트
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion_avatars: newEmotionAvatars }),
      })

      if (!res.ok) throw new Error('에이전트 업데이트 실패')

      // 로컬 상태 업데이트
      setEmotionAvatars(newEmotionAvatars)
      setAgent({ ...agent, emotion_avatars: newEmotionAvatars })
    } catch (err: any) {
      console.error('Emotion avatar upload error:', err)
      alert(err.message || '업로드 실패')
    } finally {
      setUploadingEmotion(null)
    }
  }

  // 감정 아바타 삭제
  const handleEmotionAvatarDelete = async (emotionId: string) => {
    if (!agent || !emotionAvatars[emotionId]) return

    if (!confirm('이 감정 이미지를 삭제하시겠습니까?')) return

    try {
      const newEmotionAvatars = { ...emotionAvatars }
      delete newEmotionAvatars[emotionId]

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion_avatars: newEmotionAvatars }),
      })

      if (res.ok) {
        setEmotionAvatars(newEmotionAvatars)
      }
    } catch (err) {
      console.error('Emotion avatar delete error:', err)
    }
  }

  // 채팅 메인 GIF 업로드
  const handleChatMainGifUpload = async (file: File) => {
    if (!agent) return

    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    setUploadingChatMainGif(true)

    try {
      const supabase = createClient()
      const fileName = `chat-main-${agent.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(`agents/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(`agents/${fileName}`)
      const url = urlData.publicUrl

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_main_gif: url }),
      })

      if (!res.ok) throw new Error('에이전트 업데이트 실패')

      setChatMainGif(url)
      setAgent({ ...agent, chat_main_gif: url } as any)
    } catch (err: any) {
      console.error('Chat main GIF upload error:', err)
      alert(err.message || '업로드 실패')
    } finally {
      setUploadingChatMainGif(false)
    }
  }

  // 채팅 메인 GIF 삭제
  const handleChatMainGifDelete = async () => {
    if (!agent || !chatMainGif) return

    if (!confirm('채팅 메인 이미지를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_main_gif: null }),
      })

      if (res.ok) {
        setChatMainGif(null)
        setAgent({ ...agent, chat_main_gif: null } as any)
      }
    } catch (err) {
      console.error('Chat main GIF delete error:', err)
    }
  }

  // 커스텀 감정 추가
  const handleAddCustomEmotion = async () => {
    if (!agent) {
      alert('에이전트 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    if (!newEmotion.label?.trim()) {
      alert('감정 이름을 입력해주세요.')
      return
    }

    // 입력 중인 키워드도 자동 추가
    let finalKeywords = [...(newEmotion.keywords || [])]
    if (keywordInput.trim() && !finalKeywords.includes(keywordInput.trim())) {
      finalKeywords.push(keywordInput.trim())
    }

    // 키워드 필수 체크
    if (finalKeywords.length === 0) {
      alert('최소 1개의 키워드를 입력해주세요. (감정 감지에 사용됩니다)')
      return
    }

    const emotionId = `custom-${Date.now()}`
    const emotion: CustomEmotion = {
      id: emotionId,
      label: newEmotion.label.trim(),
      emoji: newEmotion.emoji?.trim() || '💭',
      description: newEmotion.description?.trim() || '',
      keywords: finalKeywords,
      isDefault: false,
    }

    const newCustomEmotions = [...customEmotions, emotion]

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emotions: newCustomEmotions }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setAgent({ ...agent, custom_emotions: newCustomEmotions })
        setNewEmotion({ label: '', emoji: '', description: '', keywords: [] })
        setKeywordInput('')
        setShowAddEmotionModal(false)
        alert('감정이 추가되었습니다!')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('API error:', res.status, errorData)
        alert(`감정 추가 실패: ${errorData.error || res.statusText}`)
      }
    } catch (err) {
      console.error('Add custom emotion error:', err)
      alert('감정 추가 중 오류가 발생했습니다.')
    }
  }

  // 감정 수정 (기본 감정 + 커스텀 감정 모두 지원)
  const handleUpdateCustomEmotion = async () => {
    if (!agent || !editingEmotion) return

    let newCustomEmotions: CustomEmotion[]

    // 기본 감정인 경우: customEmotions에 오버라이드로 추가
    const isDefaultEmotion = DEFAULT_EMOTIONS.some(e => e.id === editingEmotion.id)
    const existsInCustom = customEmotions.some(e => e.id === editingEmotion.id)

    if (isDefaultEmotion && !existsInCustom) {
      // 기본 감정을 처음 수정하는 경우 - customEmotions에 추가
      newCustomEmotions = [...customEmotions, { ...editingEmotion, isDefault: true }]
    } else {
      // 이미 customEmotions에 있는 경우 - 업데이트
      newCustomEmotions = customEmotions.map(e =>
        e.id === editingEmotion.id ? editingEmotion : e
      )
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emotions: newCustomEmotions }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setAgent({ ...agent, custom_emotions: newCustomEmotions })
        setEditingEmotion(null)
      }
    } catch (err) {
      console.error('Update emotion error:', err)
      alert('감정 수정 실패')
    }
  }

  // 커스텀 감정 삭제
  const handleDeleteCustomEmotion = async (emotionId: string) => {
    if (!agent) return

    // 기본 감정은 삭제 불가
    if (DEFAULT_EMOTIONS.some(e => e.id === emotionId)) {
      alert('기본 감정은 삭제할 수 없습니다.')
      return
    }

    if (!confirm('이 감정을 삭제하시겠습니까? 관련된 이미지도 함께 삭제됩니다.')) return

    const newCustomEmotions = customEmotions.filter(e => e.id !== emotionId)
    const newEmotionAvatars = { ...emotionAvatars }
    delete newEmotionAvatars[emotionId]

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_emotions: newCustomEmotions,
          emotion_avatars: newEmotionAvatars,
        }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setEmotionAvatars(newEmotionAvatars)
        setAgent({ ...agent, custom_emotions: newCustomEmotions, emotion_avatars: newEmotionAvatars })
      }
    } catch (err) {
      console.error('Delete custom emotion error:', err)
      alert('감정 삭제 실패')
    }
  }

  // 키워드 추가 (새 감정)
  const handleAddKeyword = (isEditing: boolean = false) => {
    if (!keywordInput.trim()) return

    if (isEditing && editingEmotion) {
      if (!editingEmotion.keywords.includes(keywordInput.trim())) {
        setEditingEmotion({
          ...editingEmotion,
          keywords: [...editingEmotion.keywords, keywordInput.trim()],
        })
      }
    } else {
      if (!newEmotion.keywords?.includes(keywordInput.trim())) {
        setNewEmotion({
          ...newEmotion,
          keywords: [...(newEmotion.keywords || []), keywordInput.trim()],
        })
      }
    }
    setKeywordInput('')
  }

  // 키워드 삭제 (새 감정)
  const handleRemoveKeyword = (keyword: string, isEditing: boolean = false) => {
    if (isEditing && editingEmotion) {
      setEditingEmotion({
        ...editingEmotion,
        keywords: editingEmotion.keywords.filter(k => k !== keyword),
      })
    } else {
      setNewEmotion({
        ...newEmotion,
        keywords: (newEmotion.keywords || []).filter(k => k !== keyword),
      })
    }
  }

  // 채팅 이미지 선택
  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setChatImage(event.target?.result as string)
      setChatImageFile(file)
    }
    reader.readAsDataURL(file)

    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = ''
    }
  }

  // 채팅 이미지 제거
  const handleRemoveChatImage = () => {
    setChatImage(null)
    setChatImageFile(null)
  }

  // 업무 지시 감지 (키워드 기반)
  const detectTaskIntent = (message: string): boolean => {
    const taskKeywords = [
      '해줘', '해 줘', '작성해', '분석해', '검색해', '찾아줘', '찾아 줘',
      '만들어', '정리해', '요약해', '알려줘', '알려 줘', '조사해',
      '번역해', '계산해', '비교해', '추천해', '설명해',
      // 영어 키워드도 추가
      'please', 'search', 'find', 'create', 'analyze', 'summarize',
    ]
    const lowerMessage = message.toLowerCase()
    return taskKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  // 업무 실행
  const executeTask = async (messageId: string, instruction: string) => {
    if (!agent) return

    // 상태를 running으로 변경
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, taskStatus: 'running' as const } : msg
    ))

    try {
      const res = await fetch(`/api/agents/${agent.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          title: instruction.substring(0, 50),
        }),
      })

      const result = await res.json()

      // 결과 저장
      setChatMessages(prev => prev.map(msg =>
        msg.id === messageId ? {
          ...msg,
          taskStatus: result.success ? 'completed' as const : 'failed' as const,
          taskResult: {
            output: result.output || result.error || '실행 실패',
            sources: result.sources || [],
            toolsUsed: result.toolsUsed || [],
            error: result.error,
          },
        } : msg
      ))

      // 실행 결과를 에이전트 메시지로 추가
      if (result.success && result.output) {
        const resultMessage = {
          id: `result-${Date.now()}`,
          role: 'agent' as const,
          content: result.output,
          timestamp: new Date(),
          emotion: 'happy' as EmotionType,
        }
        setChatMessages(prev => [...prev, resultMessage])
        saveMessageToHistory('agent', result.output, undefined, 'happy')
      }
    } catch (error) {
      setChatMessages(prev => prev.map(msg =>
        msg.id === messageId ? {
          ...msg,
          taskStatus: 'failed' as const,
          taskResult: {
            output: '',
            sources: [],
            toolsUsed: [],
            error: error instanceof Error ? error.message : '실행 실패',
          },
        } : msg
      ))
    }
  }

  // 업무 지시 분석 요청
  const handleTaskInstruction = async () => {
    if (!chatInput.trim() || !agent) return

    const instruction = chatInput.trim()
    setChatInput('')
    setIsAnalyzingTask(true)

    // 사용자 메시지를 먼저 추가
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: `📋 [업무 지시] ${instruction}`,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/agent-tasks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          agent_id: agent.id,
          task_model: selectedTaskModel,
        }),
      })

      if (!response.ok) {
        throw new Error('업무 분석 실패')
      }

      const data = await response.json()

      // 특수 액션 타입 처리 (프로젝트 생성 등)
      if (data.action_type && data.action_type !== 'general') {
        // 폼 초기값 설정
        const initialFormData: Record<string, string> = {}
        if (data.extracted_data?.suggestedName) {
          initialFormData.name = data.extracted_data.suggestedName
        }
        setActionFormData(initialFormData)

        setPendingAction({
          action_type: data.action_type,
          confirmation_message: data.confirmation_message,
          input_fields: data.input_fields || [],
          extracted_data: data.extracted_data,
        })
      } else {
        // 일반 업무 분석
        setPendingTask({
          analysis: data.analysis,
          confirmation_message: data.confirmation_message,
          original_instruction: instruction,
        })
      }
    } catch (error) {
      console.error('업무 분석 오류:', error)
      // 에러 메시지 추가
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: '죄송합니다. 업무 분석 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsAnalyzingTask(false)
    }
  }

  // 업무 실행 승인
  const handleConfirmTask = async () => {
    if (!pendingTask || !agent) return

    setIsExecutingTask(true)

    try {
      const response = await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingTask.analysis.title,
          description: pendingTask.analysis.summary,
          instructions: pendingTask.original_instruction,
          assignee_agent_id: agent.id,
          auto_execute: true,
        }),
      })

      if (!response.ok) {
        throw new Error('업무 생성 실패')
      }

      const task = await response.json()

      // 결과 메시지 추가
      const resultMessage = {
        id: `task-result-${Date.now()}`,
        role: 'agent' as const,
        content: `✅ **업무 완료: ${pendingTask.analysis.title}**\n\n${task.result || '처리가 완료되었습니다.'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, resultMessage])
      saveMessageToHistory('agent', resultMessage.content)

      setPendingTask(null)
      setIsTaskMode(false)
    } catch (error) {
      console.error('업무 실행 오류:', error)
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: '업무 실행 중 오류가 발생했습니다.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExecutingTask(false)
    }
  }

  // 업무 취소
  const handleCancelTask = () => {
    setPendingTask(null)
    setIsTaskMode(false)
    // 취소 메시지 추가
    const cancelMessage = {
      id: `cancel-${Date.now()}`,
      role: 'agent' as const,
      content: '업무 지시를 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, cancelMessage])
  }

  // 특수 액션 실행 (프로젝트 생성 등)
  const handleConfirmAction = async () => {
    if (!pendingAction || !agent) return

    setIsExecutingAction(true)

    try {
      if (pendingAction.action_type === 'project_create') {
        // 필수 필드 검증
        if (!actionFormData.name?.trim()) {
          alert('프로젝트 이름을 입력해주세요.')
          setIsExecutingAction(false)
          return
        }

        // 프로젝트 생성 API 호출
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: actionFormData.name.trim(),
            description: actionFormData.description?.trim() || null,
            priority: actionFormData.priority || 'medium',
            deadline: actionFormData.deadline || null,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '프로젝트 생성 실패')
        }

        const project = await response.json()

        // 성공 메시지
        const successMessage = {
          id: `action-success-${Date.now()}`,
          role: 'agent' as const,
          content: `✅ 프로젝트를 생성했습니다!\n\n**${project.name}**\n${project.description ? `설명: ${project.description}\n` : ''}우선순위: ${project.priority}${project.deadline ? `\n마감일: ${project.deadline}` : ''}`,
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, successMessage])
        saveMessageToHistory('agent', successMessage.content)
      }

      // 상태 초기화
      setPendingAction(null)
      setActionFormData({})
      setIsTaskMode(false)
    } catch (error) {
      console.error('액션 실행 오류:', error)
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: `작업 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExecutingAction(false)
    }
  }

  // 액션 취소
  const handleCancelAction = () => {
    setPendingAction(null)
    setActionFormData({})
    setIsTaskMode(false)
    const cancelMessage = {
      id: `cancel-${Date.now()}`,
      role: 'agent' as const,
      content: '작업을 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, cancelMessage])
  }

  // 액션 폼 필드 변경
  const handleActionFormChange = (fieldName: string, value: string) => {
    setActionFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  // ========== Voice Call Functions ==========

  // Play audio chunk from queue
  const playAudioChunk = (pcm16Data: Int16Array) => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current
    const float32Data = new Float32Array(pcm16Data.length)
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = () => {
      playNextChunk()
    }
    sourceNodeRef.current = source
    source.start()
  }

  // Play next chunk in queue
  const playNextChunk = () => {
    if (audioQueueRef.current.length > 0) {
      const nextChunk = audioQueueRef.current.shift()!
      playAudioChunk(nextChunk)
    } else {
      isPlayingRef.current = false
    }
  }

  // Handle voice server events
  const handleVoiceServerEvent = (event: any) => {
    switch (event.type) {
      case 'session.created':
        console.log('Voice session created')
        break

      case 'input_audio_buffer.speech_started':
        setIsListening(true)
        break

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false)
        break

      case 'response.audio.delta':
        if (event.delta) {
          const binaryString = atob(event.delta)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const pcm16Data = new Int16Array(bytes.buffer)

          if (isPlayingRef.current) {
            audioQueueRef.current.push(pcm16Data)
          } else {
            isPlayingRef.current = true
            playAudioChunk(pcm16Data)
          }
        }
        break

      case 'response.audio_transcript.delta':
        // AI transcript - could display this
        break

      case 'error':
        console.error('Voice error:', event.error)
        break
    }
  }

  // Start microphone
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 }
      })
      streamRef.current = stream

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const ctx = audioContextRef.current
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)))
        }

        const bytes = new Uint8Array(pcm16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)

        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      processorRef.current = processor
    } catch (err) {
      console.error('Microphone error:', err)
      alert('마이크 접근 권한이 필요합니다.')
    }
  }

  // Stop microphone
  const stopMicrophone = () => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  // Start voice call
  const startVoiceCall = async () => {
    if (!agent) return

    setIsVoiceConnecting(true)

    try {
      // Get voice settings from agent
      const voiceSettings = (agent as any).voice_settings || {}
      const selectedVoice = voiceSettings.voice || 'sol'
      const conversationStyle = voiceSettings.conversation_style || 'friendly'
      const vadSensitivity = voiceSettings.vad_sensitivity || 'medium'

      // Get VAD threshold based on sensitivity
      const vadThreshold = VAD_SENSITIVITY_OPTIONS.find(v => v.id === vadSensitivity)?.threshold || 0.5

      // Build conversation style instructions
      const styleInstructions: Record<string, string> = {
        professional: '비즈니스 환경에 적합하게 격식을 갖추어 대화하세요. 명확하고 간결하게 답변하세요.',
        friendly: '친근하고 편안한 어조로 대화하세요. 자연스럽고 따뜻한 느낌으로 응답하세요.',
        casual: '가볍고 자유로운 어조로 대화하세요. 구어체를 사용해도 좋습니다.',
        empathetic: '상대방의 감정에 공감하며 배려하는 어조로 대화하세요. 경청하고 이해하는 태도를 보여주세요.',
        concise: '핵심만 간결하게 전달하세요. 불필요한 말을 줄이고 명확하게 답변하세요.',
      }

      const baseInstructions = agent.system_prompt || `You are ${agent.name}. ${agent.description || ''}`
      const styleInstruction = styleInstructions[conversationStyle] || styleInstructions.friendly
      const fullInstructions = `${baseInstructions}\n\n대화 스타일: ${styleInstruction}`

      // Get ephemeral token
      const tokenRes = await fetch('/api/grok-voice/token', { method: 'POST' })
      if (!tokenRes.ok) {
        throw new Error('Failed to get voice token')
      }
      const tokenData = await tokenRes.json()

      // Connect to Grok Realtime API
      const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime', [
        'realtime',
        `client-secret.${tokenData.client_secret}`
      ])

      ws.onopen = () => {
        console.log('Voice WebSocket connected')

        // Configure session with agent's voice settings
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: fullInstructions,
            voice: selectedVoice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'grok-2-public' },
            turn_detection: {
              type: 'server_vad',
              threshold: vadThreshold,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }))

        setIsVoiceCallActive(true)
        setIsVoiceConnecting(false)
        startMicrophone()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleVoiceServerEvent(data)
        } catch (err) {
          console.error('Failed to parse voice message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('Voice WebSocket error:', error)
        setIsVoiceConnecting(false)
      }

      ws.onclose = () => {
        console.log('Voice WebSocket closed')
        setIsVoiceCallActive(false)
        setIsVoiceConnecting(false)
        stopMicrophone()
      }

      wsRef.current = ws
    } catch (err) {
      console.error('Voice call error:', err)
      alert('음성 통화 연결에 실패했습니다.')
      setIsVoiceConnecting(false)
    }
  }

  // End voice call
  const endVoiceCall = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    stopMicrophone()
    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsVoiceCallActive(false)
    setIsVoiceConnecting(false)
    setIsListening(false)
  }

  // Play preview audio chunk
  const playPreviewAudioChunk = (pcm16Data: Int16Array) => {
    if (!previewAudioContextRef.current) return

    const ctx = previewAudioContextRef.current
    const float32Data = new Float32Array(pcm16Data.length)
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = () => {
      playNextPreviewChunk()
    }
    source.start()
  }

  // Play next preview chunk in queue
  const playNextPreviewChunk = () => {
    if (previewAudioQueueRef.current.length > 0) {
      const nextChunk = previewAudioQueueRef.current.shift()!
      playPreviewAudioChunk(nextChunk)
    } else {
      previewIsPlayingRef.current = false
    }
  }

  // Stop voice preview
  const stopVoicePreview = () => {
    if (previewWsRef.current) {
      previewWsRef.current.close()
      previewWsRef.current = null
    }
    previewAudioQueueRef.current = []
    previewIsPlayingRef.current = false
    setPreviewingVoice(null)
  }

  // Preview voice
  const previewVoice = async (voiceId: string) => {
    // If already previewing this voice, stop it
    if (previewingVoice === voiceId) {
      stopVoicePreview()
      return
    }

    // Stop any existing preview
    stopVoicePreview()
    setPreviewingVoice(voiceId)

    try {
      // Get preview session
      const res = await fetch('/api/grok-voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceId, text: '반갑습니다. 주인님' }),
      })

      if (!res.ok) {
        throw new Error('Failed to get preview session')
      }

      const data = await res.json()

      // Create audio context
      if (!previewAudioContextRef.current) {
        previewAudioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      // Connect to WebSocket
      const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime', [
        'realtime',
        `client-secret.${data.client_secret}`
      ])

      ws.onopen = () => {
        // Configure session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: voiceId,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
          }
        }))

        // Send text to speak
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: '인사해줘' }]
            }
          }))
          ws.send(JSON.stringify({ type: 'response.create' }))
        }, 100)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'response.audio.delta' && msg.delta) {
            const binaryString = atob(msg.delta)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const pcm16Data = new Int16Array(bytes.buffer)

            if (previewIsPlayingRef.current) {
              previewAudioQueueRef.current.push(pcm16Data)
            } else {
              previewIsPlayingRef.current = true
              playPreviewAudioChunk(pcm16Data)
            }
          }

          if (msg.type === 'response.done') {
            // Close after a short delay to ensure all audio is played
            setTimeout(() => {
              ws.close()
            }, 500)
          }
        } catch (err) {
          console.error('Preview message error:', err)
        }
      }

      ws.onerror = () => {
        setPreviewingVoice(null)
      }

      ws.onclose = () => {
        // Wait for audio queue to finish
        setTimeout(() => {
          if (!previewIsPlayingRef.current) {
            setPreviewingVoice(null)
          }
        }, 1000)
      }

      previewWsRef.current = ws
    } catch (err) {
      console.error('Voice preview error:', err)
      setPreviewingVoice(null)
    }
  }

  // ========== End Voice Call Functions ==========

  // 채팅 메시지 전송
  const handleSendChat = async () => {
    if ((!chatInput.trim() && !chatImage) || !agent || chatLoading) return

    const messageContent = chatInput.trim() || (chatImage ? '[이미지]' : '')
    const isTask = detectTaskIntent(messageContent)

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: messageContent,
      timestamp: new Date(),
      image: chatImage || undefined,
      // 업무 지시인 경우 플래그 추가
      ...(isTask && { isTask: true, taskStatus: 'pending' as const }),
    }

    setChatMessages((prev) => [...prev, userMessage])

    // 사용자 메시지 히스토리에 저장
    saveMessageToHistory('user', userMessage.content, userMessage.image)

    // 키워드 감지하여 이모티콘 자동 전송
    sendKeywordEmoticon(messageContent)

    // 사용자 입력에서 감정 감지 (즉시 반영)
    const userEmotion = detectEmotion(userMessage.content, allEmotions)
    if (userEmotion !== 'neutral') {
      setCurrentEmotion(userEmotion)
    }

    const sentImage = chatImage
    setChatInput('')
    setChatImage(null)
    setChatImageFile(null)

    // 자연스러운 딜레이: 먼저 "읽음" 표시, 랜덤 시간 후 "입력중" 표시
    setChatTypingStatus('read')

    // 1~3초 랜덤 딜레이 후 "입력중" 표시
    const thinkingDelay = 1000 + Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, thinkingDelay))

    setChatTypingStatus('typing')
    setChatLoading(true)

    try {
      // 이미지가 있으면 이미지를 API에 전달
      let messageContent = userMessage.content
      if (sentImage && !userMessage.content) {
        messageContent = '이 이미지에 대해 말해줘'
      }

      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          conversation_history: chatMessages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
          // 이미지가 있으면 API에 전달 (비전 모델이 처리)
          images: sentImage ? [sentImage] : [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const responseContent = data.response || '응답을 생성하지 못했습니다.'

        // 프로젝트 생성 등 특수 액션 감지
        if (data.action_type && data.requires_confirmation) {
          // 에이전트 응답 메시지 먼저 표시
          const agentMessage = {
            id: `agent-${Date.now()}`,
            role: 'agent' as const,
            content: responseContent,
            timestamp: new Date(),
          }
          setChatMessages((prev) => [...prev, agentMessage])

          // 폼 초기값 설정
          const initialFormData: Record<string, string> = {}
          if (data.extracted_data?.suggestedName) {
            initialFormData.name = data.extracted_data.suggestedName
          }
          setActionFormData(initialFormData)

          // pendingAction 설정 (컨펌 폼 표시)
          setPendingAction({
            action_type: data.action_type,
            confirmation_message: responseContent,
            input_fields: data.input_fields || [],
            extracted_data: data.extracted_data,
          })
        } else {
          // 일반 응답 처리
          const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
          const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'neutral'

          const agentMessage = {
            id: `agent-${Date.now()}`,
            role: 'agent' as const,
            content: responseContent,
            timestamp: new Date(),
            emotion: detectedEmotion, // 하위 호환성
            emotions: detectedEmotions, // 다중 감정 (텍스트 순서)
          }
          setChatMessages((prev) => [...prev, agentMessage])
          setCurrentEmotion(detectedEmotion)

          // 에이전트 응답 히스토리에 저장
          saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)
        }
      } else {
        // 에러 응답 처리 - JSON 파싱 실패 대비
        let errorMessage = '응답 실패'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `서버 오류 (${res.status})`
        }
        setChatMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'agent' as const,
            content: `오류: ${errorMessage}`,
            timestamp: new Date(),
          },
        ])
      }
    } catch (err: any) {
      console.error('Chat error:', err)
      const errorDetail = err?.message || '알 수 없는 오류'
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'agent' as const,
          content: `네트워크 오류: ${errorDetail}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setChatLoading(false)
      setChatTypingStatus('none')
      // 메시지 전송 후 입력창에 포커스 유지
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }

  // 섹션 편집 시작
  const startEditing = (section: string, initialData: any) => {
    setEditingSection(section)
    setEditForm(initialData)
  }

  // 섹션 편집 취소
  const cancelEditing = () => {
    setEditingSection(null)
    setEditForm({})
  }

  // 섹션 저장
  const saveSection = async (section: string) => {
    if (!agent) return
    setSaving(true)

    try {
      let updateData: any = {}

      switch (section) {
        case 'basic':
          updateData = {
            name: editForm.name,
            description: editForm.description,
            job_title: editForm.job_title || null,
          }
          break
        case 'identity':
          updateData = {
            identity: {
              core_values: editForm.core_values || [],
              personality_traits: editForm.personality_traits || [],
              communication_style: editForm.communication_style || '',
              strengths: editForm.strengths || [],
              growth_areas: editForm.growth_areas || [],
              self_summary: editForm.self_summary || '',
              working_style: editForm.working_style || '',
              recent_focus: editForm.recent_focus || '',
            },
          }
          break
        case 'llm':
          updateData = {
            llm_provider: editForm.llm_provider,
            model: editForm.model,
            temperature: parseFloat(editForm.temperature) || 0.7,
          }
          break
        case 'prompt_sections':
          // 8섹션 프롬프트를 JSONB로 저장
          updateData = {
            prompt_sections: {
              work_operating_model: editForm.work_operating_model || '',
              human_communication: editForm.human_communication || '',
              professional_habits: editForm.professional_habits || '',
              no_hallucination: editForm.no_hallucination || '',
              collaboration_conflict: editForm.collaboration_conflict || '',
              deliverable_templates: editForm.deliverable_templates || '',
              context_anchor: editForm.context_anchor || '',
              response_format: editForm.response_format || '',
              messenger_rules: editForm.messenger_rules || '',
            },
          }
          break
        case 'capabilities':
          updateData = {
            capabilities: editForm.capabilities || [],
          }
          break
        case 'voice_settings':
          updateData = {
            voice_settings: {
              voice: editForm.voice || 'sol',
              conversation_style: editForm.conversation_style || 'friendly',
              vad_sensitivity: editForm.vad_sensitivity || 'medium',
            },
          }
          break
      }

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) throw new Error('저장 실패')

      const updatedAgent = await res.json()
      setAgent({ ...agent, ...updatedAgent })
      cancelEditing()
    } catch (error) {
      console.error('Save error:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // Image upload handlers
  const handleImageClick = () => {
    if (!editMode) {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // GIF 파일은 10MB까지, 다른 이미지는 5MB까지
    const maxSize = file.type === 'image/gif' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert(file.type === 'image/gif'
        ? 'GIF 파일 크기는 10MB 이하여야 합니다.'
        : '파일 크기는 5MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    // GIF 파일인지 확인
    const gifFile = file.type === 'image/gif'
    setIsGif(gifFile)
    setOriginalFile(gifFile ? file : null)

    const reader = new FileReader()
    reader.onload = (event) => {
      setTempImage(event.target?.result as string)
      setEditMode(true)
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !editMode) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!editMode) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !editMode) return
    const touch = e.touches[0]
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    })
  }

  const handleCancel = () => {
    setEditMode(false)
    setTempImage(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsGif(false)
    setOriginalFile(null)
  }

  const handleSave = async () => {
    if (!tempImage || !agent) return

    setUploading(true)

    try {
      const supabase = createClient()
      let uploadBlob: Blob
      let fileName: string

      // GIF 파일은 애니메이션 보존을 위해 원본 그대로 업로드
      if (isGif && originalFile) {
        uploadBlob = originalFile
        fileName = `agent-${agent.id}-${Date.now()}.gif`
      } else {
        // PNG/JPEG는 캔버스로 크롭 및 리사이즈
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not available')

        const size = 400
        canvas.width = size
        canvas.height = size

        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = tempImage
        })

        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        const imgRatio = img.width / img.height
        let drawWidth, drawHeight

        if (imgRatio > 1) {
          drawHeight = size
          drawWidth = size * imgRatio
        } else {
          drawWidth = size
          drawHeight = size / imgRatio
        }

        drawWidth *= scale
        drawHeight *= scale

        const drawX = (size - drawWidth) / 2 + position.x * scale
        const drawY = (size - drawHeight) / 2 + position.y * scale

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

        uploadBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to create blob'))
            },
            'image/png',
            0.9
          )
        })
        fileName = `agent-${agent.id}-${Date.now()}.png`
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, uploadBlob, {
          upsert: true,
          contentType: isGif ? 'image/gif' : 'image/png',
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })

      if (!res.ok) throw new Error('Failed to update agent avatar')

      setAgent({ ...agent, avatar_url: avatarUrl })
      handleCancel()
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // Prevent hydration mismatch - show simple loading until mounted
  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-zinc-950 z-50">
        {/* Neural Network Loading Animation */}
        <div className="relative w-32 h-32">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-purple-500 animate-spin" style={{ animationDuration: '2s' }} />

          {/* Middle pulsing ring */}
          <div className="absolute inset-2 rounded-full border border-cyan-500/30 animate-pulse" />

          {/* Inner core */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-600/20 backdrop-blur-sm flex items-center justify-center">
            {/* Central Brain Icon */}
            <div className="relative">
              <Brain className="w-10 h-10 text-cyan-400 animate-pulse" />
              {/* Sparkle effects */}
              <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-purple-400 animate-ping" style={{ animationDuration: '1.5s' }} />
              <Zap className="absolute -bottom-1 -left-2 w-3 h-3 text-cyan-300 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </div>
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDelay: '1.3s', animationDirection: 'reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_10px_purple]" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDelay: '2.6s' }}>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full shadow-[0_0_10px_pink]" />
          </div>
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-base font-medium bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            에이전트 로딩 중
          </p>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce shadow-[0_0_8px_cyan]" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_8px_purple]" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce shadow-[0_0_8px_pink]" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-400">
        <Bot className="w-12 h-12 mb-4" />
        <p>에이전트를 찾을 수 없습니다</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    )
  }

  const status = statusConfig[agent.status] || statusConfig.INACTIVE
  const providerInfo = PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
      {/* Back Button - Mobile */}
      <div className="lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로가기
        </Button>
      </div>

      {/* Left Sidebar - Agent Profile */}
      <aside
        className={cn(
          'w-full lg:w-[320px] flex-shrink-0 rounded-2xl border p-6',
          isDark ? 'bg-zinc-900/80 border-zinc-800/60 backdrop-blur-sm' : 'bg-white/80 border-zinc-200/60 backdrop-blur-sm'
        )}
      >
        {/* Back Button - Desktop */}
        <div className="hidden lg:block mb-6">
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white -ml-2" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>
        </div>

        {/* Profile Image with Upload */}
        <div className="flex flex-col items-center">
          <div className="relative mb-5">
            <div
              className={cn(
                'relative w-36 h-36 cursor-pointer group',
                editMode && 'cursor-move'
              )}
              onClick={handleImageClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                className={cn(
                  'w-full h-full rounded-full overflow-hidden flex items-center justify-center ring-4',
                  isDark ? 'bg-zinc-800 ring-zinc-800/50' : 'bg-zinc-100 ring-zinc-100'
                )}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                ) : editMode && tempImage ? (
                  <img
                    src={tempImage}
                    alt="편집 중"
                    className="pointer-events-none"
                    style={{
                      transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                      transformOrigin: 'center',
                      minWidth: '100%',
                      minHeight: '100%',
                      objectFit: 'cover',
                    }}
                    draggable={false}
                  />
                ) : (
                  <img
                    src={agent.avatar_url || generateRobotAvatar(agent.name)}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {/* Hover overlay */}
              {!editMode && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
              {/* Status indicator */}
              {!editMode && (
                <div
                  className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900"
                  style={{ backgroundColor: status.color }}
                />
              )}
            </div>

            {/* Edit controls */}
            {editMode && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-24 accent-accent"
                  />
                  <button
                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={uploading}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={uploading}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    저장
                  </button>
                </div>

                <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  드래그하여 위치 조정, 슬라이더로 크기 조정
                </p>
              </div>
            )}
          </div>

          {/* Editable Name & Description */}
          {editingSection === 'basic' ? (
            <div className="w-full space-y-4">
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={cn(
                  'w-full text-lg md:text-xl font-bold text-center px-4 py-2 rounded-lg border',
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-white'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
                placeholder="에이전트 이름"
              />
              <input
                type="text"
                value={editForm.job_title || ''}
                onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                className={cn(
                  'w-full text-sm text-center px-4 py-2 rounded-lg border',
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                    : 'bg-white border-zinc-200 text-zinc-600'
                )}
                placeholder="직무/직함 (예: 마케팅 매니저, 개발팀장)"
              />
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className={cn(
                  'w-full text-sm text-center px-4 py-2 rounded-lg border resize-none',
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                    : 'bg-white border-zinc-200 text-zinc-600'
                )}
                placeholder="에이전트 설명"
                rows={3}
              />
              <div className="flex justify-center gap-2">
                <button
                  onClick={cancelEditing}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm',
                    isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                  )}
                >
                  취소
                </button>
                <button
                  onClick={() => saveSection('basic')}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1
                  className={cn(
                    'text-lg md:text-xl font-bold text-center',
                    isDark ? 'text-white' : 'text-zinc-900'
                  )}
                >
                  {agent.name}
                </h1>
                <button
                  onClick={() => startEditing('basic', { name: agent.name, description: agent.description, job_title: (agent as any).job_title || '' })}
                  className={cn(
                    'p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity',
                    isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                  )}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              {(agent as any).job_title && (
                <p className={cn('text-sm text-center', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  {(agent as any).job_title}
                </p>
              )}
              <span
                className="px-4 py-1.5 rounded-lg text-sm font-medium mt-2"
                style={{ backgroundColor: status.bgColor, color: status.color }}
              >
                {status.label}
              </span>
              {agent.description && (
                <p className={cn('text-sm text-center mt-3 px-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  {agent.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Divider */}
        <div className={cn('h-px my-6', isDark ? 'bg-zinc-800/60' : 'bg-zinc-200/60')} />

        {/* Team Info */}
        {agent.team && (
          <div className="mb-6">
            <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              소속 팀
            </p>
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-zinc-50 hover:bg-zinc-100'
              )}
              onClick={() => router.push(`/dashboard-group/team/${agent.team!.id}`)}
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', isDark ? 'bg-zinc-700' : 'bg-white shadow-sm')}>
                <Building className="w-4 h-4 text-zinc-500" />
              </div>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.team.name}</span>
            </div>
          </div>
        )}

        {/* Agent Info */}
        <div className="space-y-4">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            설정
          </p>
          <div className={cn('rounded-xl overflow-hidden', isDark ? 'bg-zinc-800/50' : 'bg-zinc-50')}>
            <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
              <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>제공자</span>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{providerInfo?.name || agent.llm_provider || 'Ollama'}</span>
            </div>
            <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
              <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>모델</span>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.model || 'qwen2.5:3b'}</span>
            </div>
            <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
              <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Temperature</span>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.temperature ?? 0.7}</span>
            </div>
            <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
              <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>생성일</span>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{formatDate(agent.created_at, mounted)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>마지막 활동</span>
              <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{formatTimeAgo(agent.last_active_at, mounted) || '없음'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-6">
          {/* 채팅 / 보이스 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/dashboard-group/messenger?invite=${agentId}`)}
              className="flex-1 h-10 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: userAccentColor }}
            >
              <MessageSquare className="w-4 h-4" />
              채팅
            </button>
            <button
              onClick={() => router.push(`/dashboard-group/messenger?invite=${agentId}&mode=voice`)}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: `${userAccentColor}20`,
                color: userAccentColor,
              }}
            >
              <Phone className="w-4 h-4" />
              보이스
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleToggleStatus}
              className={cn(
                'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                agent.status !== 'ACTIVE' && (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600')
              )}
              style={agent.status === 'ACTIVE' ? {
                backgroundColor: `${userAccentColor}15`,
                color: userAccentColor,
              } : undefined}
            >
              {agent.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {agent.status === 'ACTIVE' ? '중지' : '시작'}
            </button>
            <button
              onClick={() => router.push(`/agent-builder/${agentId}`)}
              className={cn(
                'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              )}
            >
              <Settings className="w-4 h-4" />
              편집
            </button>
          </div>
        </div>
      </aside>

      {/* Right Content */}
      <main
        className={cn(
          'flex-1 rounded-2xl border overflow-hidden',
          isDark ? 'bg-zinc-900/80 border-zinc-800/60 backdrop-blur-sm' : 'bg-white/80 border-zinc-200/60 backdrop-blur-sm'
        )}
      >
        {/* Tab Navigation */}
        <div className={cn('border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <nav className="flex overflow-x-auto px-4 md:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-accent text-accent'
                      : cn(
                        'border-transparent',
                        isDark
                          ? 'text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                          : 'text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                      )
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6 md:p-8">
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-8">
              {/* Agent OS Panel - Radar Chart */}
              <AgentOSPanel agentId={agent.id} isDark={isDark} />

              {/* Profile Section */}
              <div>
                {/* Section Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={cn('text-xl font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      프로필
                    </h2>
                    <p className={cn('text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      에이전트의 정체성과 성격
                    </p>
                  </div>
                  {editingSection !== 'identity' && (
                    <button
                      onClick={() =>
                        startEditing('identity', {
                          core_values: agent.identity?.core_values || [],
                          personality_traits: agent.identity?.personality_traits || [],
                          communication_style: agent.identity?.communication_style || '',
                          strengths: agent.identity?.strengths || [],
                          growth_areas: agent.identity?.growth_areas || [],
                          self_summary: agent.identity?.self_summary || '',
                          working_style: agent.identity?.working_style || '',
                          recent_focus: agent.identity?.recent_focus || '',
                        })
                      }
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'identity' ? (
                  <div className="space-y-6">
                    {/* Self Summary */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        자기 소개
                      </label>
                      <textarea
                        value={editForm.self_summary || ''}
                        onChange={(e) => setEditForm({ ...editForm, self_summary: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg border resize-none',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="이 에이전트를 소개하는 문장을 입력하세요..."
                        rows={3}
                      />
                    </div>

                    {/* Core Values */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        핵심 가치
                      </label>
                      <EditableTagInput
                        tags={editForm.core_values || []}
                        onChange={(tags) => setEditForm({ ...editForm, core_values: tags })}
                        placeholder="Enter를 눌러 추가 (예: 정확성, 창의성)"
                        color="#ec4899"
                        isDark={isDark}
                      />
                    </div>

                    {/* Personality Traits */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        성격 특성
                      </label>
                      <EditableTagInput
                        tags={editForm.personality_traits || []}
                        onChange={(tags) => setEditForm({ ...editForm, personality_traits: tags })}
                        placeholder="Enter를 눌러 추가 (예: 친절함, 분석적)"
                        color="#8b5cf6"
                        isDark={isDark}
                      />
                    </div>

                    {/* Communication Style */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        소통 스타일
                      </label>
                      <input
                        type="text"
                        value={editForm.communication_style || ''}
                        onChange={(e) => setEditForm({ ...editForm, communication_style: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 친근하고 전문적인 톤"
                      />
                    </div>

                    {/* Strengths */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        강점
                      </label>
                      <EditableTagInput
                        tags={editForm.strengths || []}
                        onChange={(tags) => setEditForm({ ...editForm, strengths: tags })}
                        placeholder="Enter를 눌러 추가"
                        color="#22c55e"
                        isDark={isDark}
                      />
                    </div>

                    {/* Growth Areas */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        성장 필요 영역
                      </label>
                      <EditableTagInput
                        tags={editForm.growth_areas || []}
                        onChange={(tags) => setEditForm({ ...editForm, growth_areas: tags })}
                        placeholder="Enter를 눌러 추가"
                        color="#f59e0b"
                        isDark={isDark}
                      />
                    </div>

                    {/* Working Style */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        업무 스타일
                      </label>
                      <input
                        type="text"
                        value={editForm.working_style || ''}
                        onChange={(e) => setEditForm({ ...editForm, working_style: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 꼼꼼하고 체계적인"
                      />
                    </div>

                    {/* Recent Focus */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        최근 집중 영역
                      </label>
                      <input
                        type="text"
                        value={editForm.recent_focus || ''}
                        onChange={(e) => setEditForm({ ...editForm, recent_focus: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 마케팅 전략 분석"
                      />
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('identity')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Self Summary Card */}
                    <div className={cn(
                      'p-6 rounded-2xl border-l-4 border-l-accent',
                      isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
                    )}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h4 className={cn('text-sm font-semibold mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            자기 소개
                          </h4>
                          {agent.identity?.self_summary ? (
                            <p className={cn('text-base leading-relaxed', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                              {agent.identity.self_summary}
                            </p>
                          ) : agent.system_prompt ? (
                            <p className={cn('text-base leading-relaxed', isDark ? 'text-zinc-300' : 'text-zinc-600')}>
                              {agent.system_prompt.slice(0, 300)}...
                            </p>
                          ) : (
                            <p className={cn('text-sm italic', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              아직 소개 정보가 없습니다. 편집 버튼을 눌러 추가해보세요.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Identity Grid */}
                    {agent.identity && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Core Values */}
                        {agent.identity.core_values?.length > 0 && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-3">
                              <Heart className="w-4 h-4 text-rose-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>핵심 가치</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.core_values.map((value, idx) => (
                                <span key={idx} className={cn('px-3 py-1.5 rounded-lg text-sm', isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-white text-zinc-600 shadow-sm')}>
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Personality Traits */}
                        {agent.identity.personality_traits?.length > 0 && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className="w-4 h-4 text-violet-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>성격 특성</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.personality_traits.map((trait, idx) => (
                                <span key={idx} className={cn('px-3 py-1.5 rounded-lg text-sm', isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-white text-zinc-600 shadow-sm')}>
                                  {trait}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Strengths */}
                        {agent.identity.strengths?.length > 0 && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-3">
                              <Zap className="w-4 h-4 text-emerald-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>강점</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.strengths.map((strength, idx) => (
                                <span key={idx} className={cn('px-3 py-1.5 rounded-lg text-sm', isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-white text-zinc-600 shadow-sm')}>
                                  {strength}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Growth Areas */}
                        {agent.identity.growth_areas?.length > 0 && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-4 h-4 text-amber-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>성장 영역</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.growth_areas.map((area, idx) => (
                                <span key={idx} className={cn('px-3 py-1.5 rounded-lg text-sm', isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-white text-zinc-600 shadow-sm')}>
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Communication & Working Style */}
                    {agent.identity && (agent.identity.communication_style || agent.identity.working_style) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {agent.identity.communication_style && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-4 h-4 text-blue-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>소통 스타일</h4>
                            </div>
                            <p className={cn('text-sm leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              {agent.identity.communication_style}
                            </p>
                          </div>
                        )}
                        {agent.identity.working_style && (
                          <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                            <div className="flex items-center gap-2 mb-2">
                              <Briefcase className="w-4 h-4 text-cyan-400" />
                              <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>업무 스타일</h4>
                            </div>
                            <p className={cn('text-sm leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              {agent.identity.working_style}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Focus */}
                    {agent.identity?.recent_focus && (
                      <div className={cn('p-5 rounded-xl border mt-4', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          <h4 className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>최근 집중 영역</h4>
                        </div>
                        <p className={cn('text-sm leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                          {agent.identity.recent_focus}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>

              {/* Stats Section */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={cn('text-xl font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>활동 통계</h3>
                    <p className={cn('text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>에이전트 활동 현황</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '대화 수', value: agent.identity?.total_conversations || 0, icon: MessageSquare, color: 'text-blue-400' },
                    { label: '완료 태스크', value: agent.identity?.total_tasks_completed || 0, icon: CheckCircle, color: 'text-emerald-400' },
                    { label: '의사결정', value: agent.identity?.total_decisions_made || 0, icon: Lightbulb, color: 'text-amber-400' },
                    { label: '워크플로우', value: agent.workflow_nodes?.length || 0, icon: Workflow, color: 'text-violet-400' },
                  ].map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                      <div key={idx} className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-50/50 border-zinc-200')}>
                        <Icon className={cn('w-5 h-5 mb-3', stat.color)} />
                        <p className={cn('text-2xl font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>{stat.value}</p>
                        <p className={cn('text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{stat.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Capabilities - Editable */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={cn('text-xl font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>기능 & 역량</h3>
                    <p className={cn('text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>에이전트가 수행할 수 있는 작업</p>
                  </div>
                  {editingSection !== 'capabilities' && (
                    <button
                      onClick={() => startEditing('capabilities', { capabilities: agent.capabilities || [] })}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'capabilities' ? (
                  <div className="space-y-4">
                    <EditableTagInput
                      tags={(editForm.capabilities || []).filter((cap: string) => !cap.startsWith('team:'))}
                      onChange={(tags) => {
                        const teamTags = (editForm.capabilities || []).filter((cap: string) => cap.startsWith('team:'))
                        setEditForm({ ...editForm, capabilities: [...teamTags, ...tags] })
                      }}
                      placeholder="Enter를 눌러 기능 추가 (예: 마케팅 분석, 데이터 시각화)"
                      color="#3b82f6"
                      isDark={isDark}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('capabilities')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : agent.capabilities && agent.capabilities.filter((cap) => !cap.startsWith('team:')).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {agent.capabilities
                      .filter((cap) => !cap.startsWith('team:'))
                      .map((cap, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'group flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md',
                            isDark
                              ? 'bg-zinc-800/30 border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-800/50'
                              : 'bg-zinc-50 border-zinc-200 hover:border-indigo-300 hover:bg-white'
                          )}
                        >
                          <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 flex items-center justify-center group-hover:from-indigo-500/20 group-hover:to-blue-500/20 transition-all">
                            <Zap className="w-5 h-5 text-indigo-500" />
                          </div>
                          <span className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                            {cap}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className={cn(
                    'flex flex-col items-center justify-center py-12 rounded-xl border border-dashed',
                    isDark ? 'border-zinc-700 bg-zinc-800/20' : 'border-zinc-300 bg-zinc-50'
                  )}>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className={cn('text-sm mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      등록된 기능이 없습니다
                    </p>
                    <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      편집 버튼을 눌러 기능을 추가해보세요
                    </p>
                  </div>
                )}
              </div>

              {/* MCP Tools Section */}
              <div className={cn(
                'p-6 rounded-2xl border',
                isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Cpu className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>MCP 도구</h3>
                    <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>Connected Tools</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {/* Web Search Tool */}
                  <div
                    className={cn(
                      'p-4 md:p-5 rounded-xl md:rounded-2xl border transition-colors',
                      (agent.capabilities?.includes('web_search') || agent.capabilities?.includes('research') || !agent.capabilities?.length)
                        ? isDark
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-emerald-50 border-emerald-200'
                        : isDark
                          ? 'bg-zinc-800/50 border-zinc-800 opacity-50'
                          : 'bg-zinc-100 border-zinc-200 opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        (agent.capabilities?.includes('web_search') || agent.capabilities?.includes('research') || !agent.capabilities?.length)
                          ? 'bg-emerald-500/20'
                          : 'bg-zinc-500/20'
                      )}>
                        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                          웹 검색
                        </h4>
                        <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                          Tavily API
                        </p>
                      </div>
                    </div>
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      실시간 웹 검색으로 최신 정보 수집
                    </p>
                  </div>

                  {/* YouTube Transcript Tool */}
                  <div
                    className={cn(
                      'p-4 md:p-5 rounded-xl md:rounded-2xl border transition-colors',
                      (agent.capabilities?.includes('youtube') || agent.capabilities?.includes('youtube_transcript') || !agent.capabilities?.length)
                        ? isDark
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-red-50 border-red-200'
                        : isDark
                          ? 'bg-zinc-800/50 border-zinc-800 opacity-50'
                          : 'bg-zinc-100 border-zinc-200 opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        (agent.capabilities?.includes('youtube') || agent.capabilities?.includes('youtube_transcript') || !agent.capabilities?.length)
                          ? 'bg-red-500/20'
                          : 'bg-zinc-500/20'
                      )}>
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                          YouTube 분석
                        </h4>
                        <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                          Transcript API
                        </p>
                      </div>
                    </div>
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      영상 자막 추출 및 내용 분석
                    </p>
                  </div>

                  {/* Web Fetch Tool */}
                  <div
                    className={cn(
                      'p-4 md:p-5 rounded-xl md:rounded-2xl border transition-colors',
                      (agent.capabilities?.includes('web_fetch') || agent.capabilities?.includes('web_browse') || !agent.capabilities?.length)
                        ? isDark
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-blue-50 border-blue-200'
                        : isDark
                          ? 'bg-zinc-800/50 border-zinc-800 opacity-50'
                          : 'bg-zinc-100 border-zinc-200 opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        (agent.capabilities?.includes('web_fetch') || agent.capabilities?.includes('web_browse') || !agent.capabilities?.length)
                          ? 'bg-blue-500/20'
                          : 'bg-zinc-500/20'
                      )}>
                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                          웹페이지 읽기
                        </h4>
                        <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                          Web Fetch
                        </p>
                      </div>
                    </div>
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      URL에서 텍스트 내용 추출
                    </p>
                  </div>
                </div>
                <p className={cn('text-xs mt-4', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  * 기능에 web_search, youtube, web_fetch 등을 추가하면 해당 도구가 활성화됩니다. 기능이 없으면 모든 도구가 기본으로 활성화됩니다.
                </p>
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[calc(100vh-130px)] min-h-[600px]">
              {/* Chat Header */}


              {/* Chat Messages Area */}
              <div
                className={cn(
                  'flex-1 overflow-y-auto rounded-2xl border p-4 md:p-6 space-y-4',
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                {/* 초기 로딩 애니메이션 - 메시지가 없고 로딩 중일 때만 */}
                {chatLoading && chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    {/* 에이전트 아바타 with 로딩 효과 */}
                    <div className="relative mb-8">
                      {/* 배경 글로우 */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-40 animate-pulse scale-110" />

                      {/* 회전하는 링 */}
                      <div className="absolute inset-[-8px] border-4 border-transparent border-t-blue-500 border-r-purple-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute inset-[-16px] border-4 border-transparent border-b-pink-500 border-l-cyan-500 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />

                      {/* 에이전트 이미지 */}
                      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-2xl">
                        {agent?.avatar_url ? (
                          <img
                            src={agent.avatar_url}
                            alt={agent?.name || '에이전트'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={cn(
                            'w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600'
                          )}>
                            <Bot className="w-16 h-16 text-white" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 에이전트 이름 */}
                    <h3 className={cn('text-xl font-bold mb-3', isDark ? 'text-white' : 'text-zinc-900')}>
                      {agent?.name}
                    </h3>

                    {/* 로딩 텍스트 */}
                    <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      대화를 준비하고 있어요...
                    </p>

                    {/* 애니메이션 dots */}
                    <div className="flex gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : !chatLoading && chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    {/* 프로필 GIF/이미지 - 크게 중앙에 */}
                    <div className="mb-6">
                      {chatMainGif || getRandomEmotionGif('neutral') || getRandomEmotionGif(currentEmotion) || agent?.avatar_url ? (
                        <img
                          src={chatMainGif || getRandomEmotionGif('neutral') || getRandomEmotionGif(currentEmotion) || agent?.avatar_url || undefined}
                          alt={agent?.name || '에이전트'}
                          className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-full shadow-xl"
                        />
                      ) : (
                        <div
                          className={cn(
                            'w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center',
                            isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                          )}
                        >
                          <Bot className={cn('w-24 h-24', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                        </div>
                      )}
                    </div>

                    {/* 에이전트 이름 */}
                    <h3 className={cn('text-xl font-bold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
                      {agent?.name}
                    </h3>
                    <p className={cn('text-sm mb-6', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      {agent?.description || '에이전트와 대화를 시작해보세요'}
                    </p>

                    {/* 버튼 두 개 */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => setShowMessageModal(true)}
                        className={cn(
                          'px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
                          'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/25'
                        )}
                      >
                        <Send className="w-4 h-4" />
                        메시지 보내기
                      </button>
                      <button
                        onClick={async () => {
                          if (!agent || chatLoading) return

                          // 1. 로딩 먼저 시작 (로딩 화면 표시)
                          setChatLoading(true)

                          // 잠시 대기 (로딩 화면이 보이도록)
                          await new Promise(resolve => setTimeout(resolve, 100))

                          // 2. 에이전트에게 인사 요청 (대화 맥락에 맞게)
                          let greetingContent = `안녕하세요! ${agent?.name || '에이전트'}입니다. 무엇을 도와드릴까요?`
                          let greetingEmotion = 'happy'

                          try {
                            // 대화 기록과 사용자 정보(직함 등)는 이미 시스템 프롬프트에 포함되어 있음
                            // 에이전트가 자연스럽게 인사하도록 간단한 트리거만 전달
                            const greetingPrompt = '[입장] 사용자가 채팅방에 들어왔습니다. 사용자 직위를 확인하고 그에 맞는 말투로 자연스럽게 인사해주세요. (도움 제안 X, 되묻기 X, 그냥 반가운 인사만)'

                            const res = await fetch(`/api/agents/${agent.id}/chat`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                message: greetingPrompt,
                                conversation_history: chatMessages
                                  .filter(m => m.role !== 'system')
                                  .map((m) => ({
                                    role: m.role === 'user' ? 'user' : 'assistant',
                                    content: m.content,
                                  })),
                              }),
                            })

                            if (res.ok) {
                              const data = await res.json()
                              greetingContent = data.response || greetingContent
                              const detectedEmotions = detectEmotionsInOrder(greetingContent, allEmotions)
                              greetingEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'happy'
                            }
                          } catch (err) {
                            console.error('Greeting error:', err)
                          }

                          // 인사 메시지 항상 표시 (API 실패해도 기본 인사 표시)
                          const agentMessage = {
                            id: `agent-${Date.now()}`,
                            role: 'agent' as const,
                            content: greetingContent,
                            timestamp: new Date(),
                            emotion: greetingEmotion,
                            emotions: [greetingEmotion],
                          }
                          setChatMessages((prev) => [...prev, agentMessage])
                          setCurrentEmotion(greetingEmotion)
                          saveMessageToHistory('agent', greetingContent, undefined, greetingEmotion)

                          // 로딩 종료 및 포커스 이동
                          setChatLoading(false)
                          setChatTypingStatus('none')
                          // 채팅 시작 후 입력창에 포커스
                          setTimeout(() => chatInputRef.current?.focus(), 100)
                        }}
                        className={cn(
                          'px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
                          isDark
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                            : 'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200'
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                        1:1 채팅하기
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, msgIndex) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
                      )}
                    >
                      {/* 시스템 메시지 (입장 알림 등) */}
                      {msg.role === 'system' ? (
                        <div
                          className={cn(
                            'px-4 py-2 rounded-full text-xs',
                            isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                          )}
                        >
                          {msg.content}
                        </div>
                      ) : (
                        <div className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start', 'max-w-[80%]')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-3',
                              msg.role === 'user'
                                ? 'bg-accent text-white'
                                : isDark
                                  ? 'bg-zinc-800 text-zinc-100'
                                  : 'bg-white text-zinc-900 border border-zinc-200'
                            )}
                          >
                            {msg.role === 'agent' && (
                              <>
                                {/* 다중 감정 GIF 표시 (텍스트 순서대로) */}
                                {(() => {
                                  // 감정 중 GIF가 있는 첫 번째 감정만 표시 (1개만)
                                  const emotionsWithGif = msg.emotions && msg.emotions.length > 0
                                    ? msg.emotions.filter(e => emotionAvatars[e])
                                    : (msg.emotion && emotionAvatars[msg.emotion] ? [msg.emotion] : [])

                                  if (emotionsWithGif.length > 0) {
                                    // 첫 번째 감정의 GIF만 표시 (메시지 내용 포함해서 더 다양하게)
                                    const selectedEmotion = emotionsWithGif[0]
                                    const contentHash = msg.content ? msg.content.slice(0, 50) : ''
                                    const msgSeed = `${msg.id || msg.timestamp}-${selectedEmotion}-${msgIndex}-${contentHash}`
                                    const gifUrl = getRandomEmotionGif(selectedEmotion, msgSeed)
                                    if (gifUrl) {
                                      return (
                                        <div className="mb-3">
                                          <img
                                            src={gifUrl}
                                            alt={allEmotions.find((e: CustomEmotion) => e.id === selectedEmotion)?.label || '감정'}
                                            className="rounded-xl max-w-full"
                                          />
                                        </div>
                                      )
                                    }
                                  }
                                  return null
                                })()}
                                <div className="flex items-center gap-2 mb-2">
                                  {/* 기본 아바타 (GIF가 없을 때만 표시) */}
                                  {!(msg.emotions?.some(e => emotionAvatars[e]) || (msg.emotion && emotionAvatars[msg.emotion])) && (
                                    agent?.avatar_url ? (
                                      <img
                                        src={agent.avatar_url}
                                        alt={agent?.name || '에이전트'}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                        <span className="text-xs font-medium text-accent">
                                          {agent?.name?.substring(0, 1)}
                                        </span>
                                      </div>
                                    )
                                  )}
                                  <span className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                                    {agent?.name}
                                  </span>
                                </div>
                              </>
                            )}
                            {msg.image && (
                              <img
                                src={msg.image}
                                alt="첨부 이미지"
                                className="max-w-full max-h-48 rounded-lg mb-2 object-contain"
                              />
                            )}
                            {msg.content && msg.content !== '[이미지]' && (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            )}

                            {/* 업무 지시 메시지: Run 버튼 및 상태 표시 */}
                            {msg.isTask && msg.role === 'user' && (
                              <div className="mt-2 pt-2 border-t border-white/20">
                                {msg.taskStatus === 'pending' && (
                                  <button
                                    onClick={() => executeTask(msg.id, msg.content)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <Play className="w-3 h-3" />
                                    Run
                                  </button>
                                )}
                                {msg.taskStatus === 'running' && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    실행 중...
                                  </div>
                                )}
                                {msg.taskStatus === 'completed' && (
                                  <div className="flex items-center gap-1.5 text-xs text-green-300">
                                    <Check className="w-3 h-3" />
                                    완료
                                    {msg.taskResult?.toolsUsed && msg.taskResult.toolsUsed.length > 0 && (
                                      <span className="opacity-70">
                                        ({msg.taskResult.toolsUsed.join(', ')})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {msg.taskStatus === 'failed' && (
                                  <div className="flex items-center gap-1.5 text-xs text-red-300">
                                    <X className="w-3 h-3" />
                                    실패: {msg.taskResult?.error || '알 수 없는 오류'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* 시간 - 메시지 박스 밖에 표시 */}
                          <p
                            className={cn(
                              'text-xs mt-1 px-1',
                              isDark ? 'text-zinc-600' : 'text-zinc-400'
                            )}
                          >
                            {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {/* 읽음/입력중 표시 - 자연스러운 딜레이 적용 */}
                {chatTypingStatus !== 'none' && (
                  <div className="flex justify-start">
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3',
                        isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {chatTypingStatus === 'read' ? (
                          // "읽음" 상태 - 아바타만 표시
                          <>
                            {agent?.avatar_url ? (
                              <img
                                src={agent.avatar_url}
                                alt={agent.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                <span className="text-xs">👀</span>
                              </div>
                            )}
                            <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              읽음
                            </span>
                          </>
                        ) : (
                          // "입력중" 상태
                          <>
                            {getRandomEmotionGif('thinking') ? (
                              <img
                                src={getRandomEmotionGif('thinking')}
                                alt="입력중"
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : agent?.avatar_url ? (
                              <img
                                src={agent.avatar_url}
                                alt={agent.name}
                                className="w-8 h-8 rounded-full object-cover animate-pulse"
                              />
                            ) : (
                              <Loader2 className="w-6 h-6 animate-spin text-accent" />
                            )}
                            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              입력중...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="flex-shrink-0 mt-3">
                {/* Image Preview */}
                {chatImage && (
                  <div className={cn(
                    'mb-2 p-2 rounded-xl border inline-flex items-center gap-2',
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
                  )}>
                    <img src={chatImage} alt="첨부 이미지" className="h-16 w-16 object-cover rounded-lg" />
                    <button
                      onClick={handleRemoveChatImage}
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600'
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Task mode indicator */}
                {isTaskMode && !pendingTask && (
                  <div className={cn(
                    'mb-3 p-4 rounded-2xl border backdrop-blur-sm',
                    'bg-gradient-to-r shadow-lg',
                    'animate-in slide-in-from-top-2 duration-300',
                    isDark
                      ? 'from-accent/20 to-accent/10 border-accent/30 shadow-accent/20'
                      : 'from-accent/10 to-accent/5 border-accent/30 shadow-accent/20'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        'bg-accent shadow-lg shadow-accent/30'
                      )}>
                        <ClipboardList className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className={cn(
                          'text-sm font-semibold block',
                          isDark ? 'text-accent' : 'text-accent'
                        )}>
                          업무 지시 모드
                        </span>
                        <span className={cn(
                          'text-xs',
                          isDark ? 'text-accent/70' : 'text-accent/80'
                        )}>
                          원하는 업무를 자유롭게 말씀하세요
                        </span>
                      </div>
                      <button
                        onClick={() => setIsTaskMode(false)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          'hover:scale-105 active:scale-95',
                          isDark
                            ? 'text-accent bg-accent/20 hover:bg-accent/30 border border-accent/30'
                            : 'text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30'
                        )}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* Analyzing indicator */}
                {isAnalyzingTask && (
                  <div className={cn(
                    'mb-3 p-4 rounded-2xl border backdrop-blur-sm overflow-hidden relative',
                    'bg-gradient-to-r shadow-lg',
                    'animate-in fade-in duration-300',
                    isDark
                      ? 'from-blue-950/40 to-indigo-950/40 border-blue-700/30 shadow-blue-900/20'
                      : 'from-blue-50 to-indigo-50 border-blue-200/60 shadow-blue-200/50'
                  )}>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    <div className="flex items-center gap-3 relative">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30',
                        'animate-pulse'
                      )}>
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                      <div className="flex-1">
                        <span className={cn(
                          'text-sm font-semibold block',
                          isDark ? 'text-blue-200' : 'text-blue-800'
                        )}>
                          업무 내용 분석 중
                        </span>
                        <span className={cn(
                          'text-xs',
                          isDark ? 'text-blue-400/70' : 'text-blue-600/80'
                        )}>
                          AI가 업무를 이해하고 정리하고 있습니다...
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending task confirmation */}
                {pendingTask && (
                  <div className={cn(
                    'mb-3 rounded-2xl border backdrop-blur-sm overflow-hidden',
                    'shadow-xl animate-in slide-in-from-bottom-4 duration-500',
                    isDark
                      ? 'bg-gradient-to-br from-emerald-950/50 to-teal-950/50 border-emerald-700/30 shadow-emerald-900/30'
                      : 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border-emerald-200/60 shadow-emerald-200/60'
                  )}>
                    {/* Header */}
                    <div className={cn(
                      'px-4 py-3 border-b flex items-center gap-3',
                      isDark ? 'border-emerald-800/30 bg-emerald-900/20' : 'border-emerald-100 bg-emerald-100/50'
                    )}>
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center',
                        'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30'
                      )}>
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className={cn(
                          'text-sm font-semibold',
                          isDark ? 'text-emerald-200' : 'text-emerald-800'
                        )}>
                          업무 분석 완료
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            이해도
                          </span>
                          <div className={cn(
                            'w-16 h-1.5 rounded-full overflow-hidden',
                            isDark ? 'bg-zinc-700' : 'bg-zinc-200'
                          )}>
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-1000',
                                pendingTask.analysis.confidence > 0.8
                                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                  : pendingTask.analysis.confidence > 0.5
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                    : 'bg-gradient-to-r from-red-400 to-red-500'
                              )}
                              style={{ width: `${pendingTask.analysis.confidence * 100}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-xs font-medium',
                            pendingTask.analysis.confidence > 0.8
                              ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                              : pendingTask.analysis.confidence > 0.5
                                ? isDark ? 'text-amber-400' : 'text-amber-600'
                                : isDark ? 'text-red-400' : 'text-red-600'
                          )}>
                            {Math.round(pendingTask.analysis.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className={cn(
                        'text-sm whitespace-pre-wrap leading-relaxed',
                        isDark ? 'text-zinc-200' : 'text-zinc-700'
                      )}>
                        {pendingTask.confirmation_message}
                      </div>

                      {/* Action buttons - 우측 하단 배치 */}
                      <div className="mt-5 flex justify-end gap-2">
                        <button
                          onClick={handleCancelTask}
                          disabled={isExecutingTask}
                          className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            'hover:scale-[1.02] active:scale-[0.98]',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            isDark
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                              : 'bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 shadow-sm'
                          )}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>반려</span>
                        </button>
                        <button
                          onClick={handleConfirmTask}
                          disabled={isExecutingTask}
                          className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-lg',
                            'text-sm font-semibold transition-all duration-200',
                            'bg-accent text-white',
                            'hover:bg-accent/90',
                            'hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02]',
                            'active:scale-[0.98]',
                            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                          )}
                        >
                          {isExecutingTask ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>실행 중...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>승인</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending Action (프로젝트 생성 등) */}
                {pendingAction && (
                  <div className={cn(
                    'p-4 rounded-2xl border-2',
                    isDark
                      ? 'bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50'
                      : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                  )}>
                    {/* Header */}
                    <div className={cn(
                      'flex items-center gap-3 pb-3 mb-3 border-b',
                      isDark ? 'border-blue-800/50' : 'border-blue-200'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                        <FolderPlus className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className={cn(
                          'text-sm font-semibold',
                          isDark ? 'text-blue-300' : 'text-blue-700'
                        )}>
                          프로젝트 생성
                        </span>
                      </div>
                    </div>

                    {/* Message */}
                    <div className={cn(
                      'text-sm whitespace-pre-wrap leading-relaxed mb-4',
                      isDark ? 'text-zinc-200' : 'text-zinc-700'
                    )}>
                      {pendingAction.confirmation_message}
                    </div>

                    {/* Dynamic Form Fields */}
                    <div className="space-y-3 mb-4">
                      {pendingAction.input_fields.map((field) => (
                        <div key={field.name} className="flex flex-col gap-1">
                          <label className={cn(
                            'text-xs font-medium',
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          )}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.type === 'text' && (
                            <input
                              type="text"
                              value={actionFormData[field.name] || ''}
                              onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                              placeholder={field.placeholder}
                              className={cn(
                                'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                                isDark
                                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                                  : 'bg-white border border-zinc-300 text-zinc-900'
                              )}
                            />
                          )}
                          {field.type === 'textarea' && (
                            <textarea
                              value={actionFormData[field.name] || ''}
                              onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                              placeholder={field.placeholder}
                              rows={2}
                              className={cn(
                                'px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500',
                                isDark
                                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                                  : 'bg-white border border-zinc-300 text-zinc-900'
                              )}
                            />
                          )}
                          {field.type === 'select' && field.options && (
                            <select
                              value={actionFormData[field.name] || ''}
                              onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                              className={cn(
                                'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                                isDark
                                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                                  : 'bg-white border border-zinc-300 text-zinc-900'
                              )}
                            >
                              <option value="">선택하세요</option>
                              {field.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                          {field.type === 'date' && (
                            <input
                              type="date"
                              value={actionFormData[field.name] || ''}
                              onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                              className={cn(
                                'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                                isDark
                                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                                  : 'bg-white border border-zinc-300 text-zinc-900'
                              )}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action buttons - 우측 하단 배치 */}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelAction}
                        disabled={isExecutingAction}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          'hover:scale-[1.02] active:scale-[0.98]',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          isDark
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                            : 'bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 shadow-sm'
                        )}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>반려</span>
                      </button>
                      <button
                        onClick={handleConfirmAction}
                        disabled={isExecutingAction}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 rounded-lg',
                          'text-sm font-semibold transition-all duration-200',
                          'bg-accent text-white',
                          'hover:bg-accent/90',
                          'hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02]',
                          'active:scale-[0.98]',
                          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                        )}
                      >
                        {isExecutingAction ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>생성 중...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>승인</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border',
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  )}
                >
                  {/* Hidden file input */}
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                    onChange={handleChatImageSelect}
                    className="hidden"
                  />
                  {/* Image attach button */}
                  <button
                    onClick={() => chatFileInputRef.current?.click()}
                    disabled={chatLoading}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      isDark
                        ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                        : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-600'
                    )}
                    title="이미지 첨부"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  {/* Emoticon button */}
                  <button
                    onClick={() => setShowEmoticonModal(true)}
                    disabled={chatLoading || isTaskMode}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      isDark
                        ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                        : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-600',
                      isTaskMode && 'opacity-50 cursor-not-allowed'
                    )}
                    title="이모티콘"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  {/* Task mode button */}
                  <button
                    onClick={() => {
                      setIsTaskMode(!isTaskMode)
                      if (pendingTask) {
                        setPendingTask(null)
                      }
                    }}
                    disabled={chatLoading || isAnalyzingTask || !!pendingTask}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      isTaskMode
                        ? 'bg-accent text-white hover:bg-accent/90'
                        : isDark
                          ? 'hover:bg-accent/20 text-zinc-400 hover:text-accent'
                          : 'hover:bg-accent/10 text-zinc-500 hover:text-accent',
                      (chatLoading || isAnalyzingTask || !!pendingTask) && 'opacity-50 cursor-not-allowed'
                    )}
                    title={isTaskMode ? '업무 지시 모드 해제' : '업무 지시'}
                  >
                    <ClipboardList className="w-4 h-4" />
                  </button>
                  {/* Task model dropdown - 업무지시 모드일 때만 표시 (위로 펼쳐짐) */}
                  {isTaskMode && (
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setIsTaskModelDropdownOpen(!isTaskModelDropdownOpen)}
                        disabled={chatLoading || isAnalyzingTask || !!pendingTask}
                        className={cn(
                          'h-8 px-3 rounded-lg text-xs border-none outline-none transition-all flex items-center gap-1',
                          isDark
                            ? 'bg-accent/20 text-accent hover:bg-accent/30'
                            : 'bg-accent/10 text-accent hover:bg-accent/20',
                          (chatLoading || isAnalyzingTask || !!pendingTask) && 'opacity-50 cursor-not-allowed'
                        )}
                        title="업무 분석 모델 선택"
                      >
                        {TASK_MODE_MODELS.find(m => m.id === selectedTaskModel)?.name || 'Model'}
                        <ChevronUp className={cn('w-3 h-3 transition-transform', isTaskModelDropdownOpen && 'rotate-180')} />
                      </button>
                      {isTaskModelDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsTaskModelDropdownOpen(false)}
                          />
                          <div className={cn(
                            'absolute bottom-full left-0 mb-1 py-1 rounded-lg shadow-lg border z-50 min-w-[160px]',
                            isDark
                              ? 'bg-zinc-900 border-zinc-700'
                              : 'bg-white border-zinc-200'
                          )}>
                            {TASK_MODE_MODELS.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setSelectedTaskModel(model.id)
                                  setIsTaskModelDropdownOpen(false)
                                }}
                                className={cn(
                                  'w-full px-3 py-2 text-xs text-left transition-colors',
                                  selectedTaskModel === model.id
                                    ? isDark
                                      ? 'bg-accent/20 text-accent'
                                      : 'bg-accent/10 text-accent'
                                    : isDark
                                      ? 'text-zinc-300 hover:bg-zinc-800'
                                      : 'text-zinc-700 hover:bg-zinc-100'
                                )}
                              >
                                {model.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      // 한글 조합 중이면 무시 (IME 입력 중 Enter 두 번 전송 방지)
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (isTaskMode) {
                          handleTaskInstruction()
                        } else {
                          handleSendChat()
                        }
                      }
                    }}
                    placeholder={isTaskMode
                      ? '업무를 자유롭게 말씀하세요... (예: "경쟁사 분석해줘")'
                      : `${agent?.name}에게 메시지 보내기...`
                    }
                    className={cn(
                      'flex-1 bg-transparent border-none outline-none text-sm py-1',
                      'focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0',
                      '!outline-none !ring-0',
                      isDark ? 'text-white placeholder:text-zinc-500' : 'text-zinc-900 placeholder:text-zinc-400',
                      isTaskMode && 'placeholder:text-accent/70'
                    )}
                    style={{ outline: 'none', boxShadow: 'none' }}
                    disabled={chatLoading || isAnalyzingTask || !!pendingTask}
                    autoFocus
                  />
                  <button
                    onClick={isTaskMode ? handleTaskInstruction : handleSendChat}
                    disabled={(!chatInput.trim() && !chatImage) || chatLoading || isAnalyzingTask || !!pendingTask}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      (chatInput.trim() || chatImage) && !chatLoading && !isAnalyzingTask && !pendingTask
                        ? isTaskMode
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'bg-accent text-white hover:bg-accent/90'
                        : isDark
                          ? 'bg-zinc-800 text-zinc-500'
                          : 'bg-zinc-100 text-zinc-400'
                    )}
                  >
                    {isAnalyzingTask ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                  {/* Voice Call Button */}
                  <button
                    onClick={() => {
                      if (isVoiceCallActive) {
                        endVoiceCall()
                      } else if (!isVoiceConnecting) {
                        startVoiceCall()
                      }
                    }}
                    disabled={chatLoading || isAnalyzingTask || !!pendingTask}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      isVoiceCallActive
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : isVoiceConnecting
                          ? 'bg-accent/50 text-white'
                          : isDark
                            ? 'hover:bg-zinc-800 text-zinc-400 hover:text-accent'
                            : 'hover:bg-zinc-100 text-zinc-500 hover:text-accent'
                    )}
                    title={isVoiceCallActive ? '통화 종료' : isVoiceConnecting ? '연결 중...' : '음성 통화'}
                  >
                    {isVoiceConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isVoiceCallActive ? (
                      <PhoneOff className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </button>
                  {/* Mute Button (only show during voice call) */}
                  {isVoiceCallActive && (
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                        isMuted
                          ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                          : isListening
                            ? 'bg-green-500 text-white'
                            : isDark
                              ? 'hover:bg-zinc-800 text-zinc-400'
                              : 'hover:bg-zinc-100 text-zinc-500'
                      )}
                      title={isMuted ? '음소거 해제' : '음소거'}
                    >
                      {isMuted ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className={cn('w-4 h-4', isListening && 'animate-pulse')} />
                      )}
                    </button>
                  )}
                  {/* Exit Button - Moved from header */}
                  <button
                    onClick={() => {
                      // 채팅방 나가기
                      if (isVoiceCallActive) {
                        endVoiceCall()
                      }
                      setChatMessages([])
                      setHistoryLoaded(false)
                      setActiveTab('about')
                    }}
                    disabled={chatLoading}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      isDark
                        ? 'hover:bg-zinc-800 text-zinc-400 hover:text-red-400'
                        : 'hover:bg-zinc-100 text-zinc-500 hover:text-red-500'
                    )}
                    title="나가기"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History Tab - 대화 기록 */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  대화 기록
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              <ChatHistoryView agentId={agentId} isDark={isDark} />
            </div>
          )}

          {/* Workspace Tab */}
          {activeTab === 'workspace' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  워크스페이스
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {/* Team Info */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-blue-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>소속 팀</h4>
                </div>
                {agent.team ? (
                  <div
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl cursor-pointer hover:bg-opacity-80 transition',
                      isDark ? 'bg-zinc-900' : 'bg-white'
                    )}
                    onClick={() => router.push(`/dashboard-group/team/${agent.team!.id}`)}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      )}
                    >
                      <Building className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                        {agent.team.name}
                      </p>
                      {agent.team.description && (
                        <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                          {agent.team.description}
                        </p>
                      )}
                    </div>
                    <ArrowLeft className="w-5 h-5 rotate-180 text-zinc-400" />
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    소속된 팀이 없습니다
                  </p>
                )}
              </div>

              {/* Active Chat Rooms */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>참여 중인 채팅방</h4>
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    )}
                  >
                    {agent.chat_rooms?.length || 0}개
                  </span>
                </div>
                {agent.chat_rooms && agent.chat_rooms.length > 0 ? (
                  <div className="space-y-2">
                    {agent.chat_rooms.map((room: any) => (
                      <div
                        key={room.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-opacity-80 transition',
                          isDark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-white hover:bg-zinc-50'
                        )}
                        onClick={() => router.push(`/dashboard-group/messenger?room=${room.id}`)}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                          )}
                        >
                          {room.type === 'group' ? (
                            <Users className="w-5 h-5 text-green-500" />
                          ) : (
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                            {room.name || '채팅방'}
                          </p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                            {formatTimeAgo(room.last_message_at, mounted)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    참여 중인 채팅방이 없습니다
                  </p>
                )}
              </div>

              {/* Related Tasks */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>관련 태스크</h4>
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    )}
                  >
                    {agent.tasks?.length || 0}개
                  </span>
                </div>
                {agent.tasks && agent.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {agent.tasks.map((task: any) => (
                      <div
                        key={task.id}
                        className={cn('p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              task.status === 'done'
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : task.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            )}
                          >
                            {task.status === 'done' ? '완료' : task.status === 'in_progress' ? '진행 중' : '대기'}
                          </span>
                          {task.project && (
                            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              {task.project.name}
                            </span>
                          )}
                        </div>
                        <p className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                          {task.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    관련 태스크가 없습니다
                  </p>
                )}
              </div>

              {/* Project Activity Stats */}
              {agent.project_stats && agent.project_stats.length > 0 && (
                <div
                  className={cn(
                    'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                    isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <FolderOpen className="w-5 h-5 text-orange-500" />
                    <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>프로젝트 활동</h4>
                  </div>
                  <div className="space-y-2">
                    {agent.project_stats.map((stat: any) => (
                      <div
                        key={stat.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          isDark ? 'bg-zinc-900' : 'bg-white'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center',
                              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                            )}
                          >
                            <FolderOpen className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                              {stat.name}
                            </p>
                            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              마지막 활동: {formatTimeAgo(stat.lastActivity, mounted)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-accent">{stat.count}</p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>활동 수</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Timeline */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-cyan-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>최근 활동 타임라인</h4>
                </div>
                {agent.work_logs && agent.work_logs.length > 0 ? (
                  <div className="relative">
                    <div className={cn('absolute left-5 top-0 bottom-0 w-px', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
                    <div className="space-y-4">
                      {agent.work_logs.slice(0, 10).map((log: any) => {
                        const logType = logTypeLabels[log.log_type] || {
                          label: log.log_type,
                          icon: FileText,
                          color: '#6b7280',
                        }
                        const LogIcon = logType.icon
                        return (
                          <div key={log.id} className="flex items-start gap-4 relative">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                              style={{ backgroundColor: `${logType.color}20` }}
                            >
                              <LogIcon className="w-5 h-5" style={{ color: logType.color }} />
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center justify-between">
                                <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                                  {log.title}
                                </span>
                                <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                                  {formatTimeAgo(log.created_at, mounted)}
                                </span>
                              </div>
                              {log.summary && (
                                <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                                  {log.summary}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    아직 활동 기록이 없습니다
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Brain Map Tab */}
          {activeTab === 'brainmap' && (
            <div className="h-[calc(100vh-200px)] min-h-[600px]">
              <BrainMapLayout agentId={agent.id} isDark={isDark} />
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <KnowledgeBaseTab agentId={agentId} isDark={isDark} mounted={mounted} />
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <IntegrationsTab agentId={agentId} isDark={isDark} />
          )}

          {/* APIs Tab */}
          {activeTab === 'apis' && (
            <ApiConnectionsTab agentId={agentId} isDark={isDark} />
          )}

          {/* Workflow Tab */}
          {activeTab === 'workflow' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  워크플로우
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {agent.workflow_nodes && agent.workflow_nodes.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      총 {agent.workflow_nodes.length}개의 노드
                    </p>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/agent-builder/${agentId}`)}>
                      편집하기
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {agent.workflow_nodes.map((node: any, idx: number) => (
                      <div
                        key={node.id}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-xl border',
                          isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                        )}
                      >
                        <span
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                            isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                            {node.data?.label || node.type}
                          </p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{node.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Workflow className={cn('w-16 h-16 mx-auto mb-4', isDark ? 'text-zinc-700' : 'text-zinc-300')} />
                  <p className={cn('text-sm mb-4', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    워크플로우가 없습니다
                  </p>
                  <Button variant="outline" onClick={() => router.push(`/agent-builder/${agentId}`)}>
                    워크플로우 만들기
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab - Editable */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  설정
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {/* LLM Settings - Editable */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Bot className="w-5 h-5 text-blue-500" />
                    LLM 설정
                  </h3>
                  {editingSection !== 'llm' && (
                    <button
                      onClick={() =>
                        startEditing('llm', {
                          llm_provider: agent.llm_provider || 'ollama',
                          model: agent.model || 'qwen2.5:3b',
                          temperature: agent.temperature ?? 0.7,
                        })
                      }
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'llm' ? (
                  <div className="space-y-4">
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Provider
                      </label>
                      <select
                        value={editForm.llm_provider || 'ollama'}
                        onChange={(e) => {
                          const newProvider = e.target.value as LLMProvider
                          const models = AVAILABLE_MODELS[newProvider]
                          setEditForm({
                            ...editForm,
                            llm_provider: newProvider,
                            model: models?.[0] || '',
                          })
                        }}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                      >
                        {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Model
                      </label>
                      <select
                        value={editForm.model || ''}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                      >
                        {(AVAILABLE_MODELS[editForm.llm_provider as LLMProvider] || []).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Temperature: {editForm.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editForm.temperature || 0.7}
                        onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-xs mt-1">
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>정확한 (0)</span>
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>창의적 (2)</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('llm')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Provider', value: providerInfo?.name || agent.llm_provider || 'Ollama' },
                      { label: 'Model', value: agent.model || 'qwen2.5:3b' },
                      { label: 'Temperature', value: agent.temperature ?? 0.7 },
                      { label: '상태', value: status.label, color: status.color },
                    ].map((item, idx) => (
                      <div key={idx} className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                        <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {item.label}
                        </p>
                        <p
                          className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}
                          style={item.color ? { color: item.color } : undefined}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 에이전트 프롬프트 (8섹션) - Editable */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Brain className="w-5 h-5 text-purple-500" />
                    에이전트 행동 프롬프트 (8섹션)
                  </h3>
                  {editingSection !== 'prompt_sections' && (
                    <button
                      onClick={() => {
                        const promptSections = (agent as any).prompt_sections || {}
                        startEditing('prompt_sections', {
                          work_operating_model: promptSections.work_operating_model || DEFAULT_PROMPT_VALUES.work_operating_model,
                          human_communication: promptSections.human_communication || DEFAULT_PROMPT_VALUES.human_communication,
                          professional_habits: promptSections.professional_habits || DEFAULT_PROMPT_VALUES.professional_habits,
                          no_hallucination: promptSections.no_hallucination || DEFAULT_PROMPT_VALUES.no_hallucination,
                          collaboration_conflict: promptSections.collaboration_conflict || DEFAULT_PROMPT_VALUES.collaboration_conflict,
                          deliverable_templates: promptSections.deliverable_templates || DEFAULT_PROMPT_VALUES.deliverable_templates,
                          context_anchor: promptSections.context_anchor || DEFAULT_PROMPT_VALUES.context_anchor,
                          response_format: promptSections.response_format || DEFAULT_PROMPT_VALUES.response_format,
                          messenger_rules: promptSections.messenger_rules || DEFAULT_PROMPT_VALUES.messenger_rules,
                        })
                      }}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  에이전트가 사람처럼 행동하도록 8개 영역의 프롬프트를 설정합니다.
                </p>

                {editingSection === 'prompt_sections' ? (
                  <div className="space-y-3">
                    {PROMPT_SECTIONS.map((section) => {
                      const IconComponent = section.icon
                      const isExpanded = expandedPromptSections[section.key]
                      return (
                        <div
                          key={section.key}
                          className={cn(
                            'rounded-lg border overflow-hidden',
                            isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedPromptSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                            className={cn(
                              'w-full flex items-center justify-between p-4 text-left',
                              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent className="w-5 h-5 text-accent" />
                              <div>
                                <span className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                                  {section.label}
                                </span>
                                <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                                  {section.description}
                                </p>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                            ) : (
                              <ChevronDown className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <textarea
                                value={editForm[section.key] || ''}
                                onChange={(e) => setEditForm({ ...editForm, [section.key]: e.target.value })}
                                className={cn(
                                  'w-full px-3 py-2 rounded-lg border resize-none font-mono text-sm',
                                  isDark
                                    ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                                )}
                                rows={10}
                                placeholder={`${section.label} 관련 프롬프트를 입력하세요...`}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('prompt_sections')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {PROMPT_SECTIONS.map((section) => {
                      const IconComponent = section.icon
                      const promptSections = (agent as any).prompt_sections || {}
                      const hasCustomValue = promptSections[section.key] && promptSections[section.key].trim() !== ''
                      return (
                        <div
                          key={section.key}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg',
                            isDark ? 'bg-zinc-900' : 'bg-white'
                          )}
                        >
                          <IconComponent className={cn('w-4 h-4', hasCustomValue ? 'text-green-500' : 'text-zinc-400')} />
                          <span className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                            {section.label}
                          </span>
                          {hasCustomValue ? (
                            <span className="text-xs text-green-500 ml-auto">설정됨</span>
                          ) : (
                            <span className={cn('text-xs ml-auto', isDark ? 'text-zinc-500' : 'text-zinc-400')}>기본값</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 채팅 메인 이미지 설정 */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <ImagePlus className="w-5 h-5 text-cyan-500" />
                    채팅 메인 이미지
                  </h3>
                </div>
                <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  채팅 시작 화면에 표시될 대표 GIF/이미지를 설정하세요.
                </p>

                <div className="flex items-start gap-6">
                  {/* 이미지 미리보기 */}
                  <div
                    className={cn(
                      'relative w-40 h-40 rounded-2xl overflow-hidden cursor-pointer group',
                      isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    )}
                    onClick={() => chatMainGifInputRef.current?.click()}
                  >
                    {uploadingChatMainGif ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-accent" />
                      </div>
                    ) : chatMainGif ? (
                      <>
                        <img
                          src={chatMainGif}
                          alt="채팅 메인"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              chatMainGifInputRef.current?.click()
                            }}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                            title="변경"
                          >
                            <Upload className="w-5 h-5 text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleChatMainGifDelete()
                            }}
                            className="p-2 rounded-full bg-red-500/50 hover:bg-red-500/70"
                            title="삭제"
                          >
                            <Trash2 className="w-5 h-5 text-white" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <Upload className={cn('w-8 h-8', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                        <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          클릭하여 업로드
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 설명 */}
                  <div className="flex-1">
                    <div className={cn('text-sm space-y-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      <p>• 채팅을 시작하기 전 화면에 크게 표시됩니다</p>
                      <p>• GIF 또는 이미지 파일을 업로드할 수 있습니다</p>
                      <p>• 최대 10MB까지 지원됩니다</p>
                      <p>• 미설정 시 기본 감정 아바타가 표시됩니다</p>
                    </div>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={chatMainGifInputRef}
                  type="file"
                  accept="image/*,.gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleChatMainGifUpload(file)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </div>

              {/* 감정별 표정 이미지 설정 */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Sparkles className="w-5 h-5 text-pink-500" />
                    감정별 표정 이미지
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-1 rounded-full', isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-600')}>
                      {Object.keys(emotionAvatars).length}/{allEmotions.length} 설정됨
                    </span>
                    <button
                      onClick={() => {
                        setNewEmotion({ label: '', emoji: '', description: '', keywords: [] })
                        setShowAddEmotionModal(true)
                      }}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        isDark
                          ? 'bg-pink-600 hover:bg-pink-500 text-white'
                          : 'bg-pink-500 hover:bg-pink-600 text-white'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      새 감정
                    </button>
                  </div>
                </div>
                <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  대화 맥락에 따라 에이전트의 표정이 자동으로 바뀝니다. 각 감정에 맞는 GIF 이미지를 업로드하세요.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allEmotions.map((emotion) => (
                    <div
                      key={emotion.id}
                      className={cn(
                        'relative group rounded-xl border-2 p-3 transition-all',
                        emotion.isDefault ? 'border-dashed' : 'border-solid',
                        emotionAvatars[emotion.id]
                          ? isDark
                            ? 'border-zinc-600 bg-zinc-900'
                            : 'border-zinc-300 bg-white'
                          : isDark
                            ? 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                            : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300',
                        !emotion.isDefault && (isDark ? 'border-pink-600/50' : 'border-pink-400/50')
                      )}
                    >
                      {/* 커스텀 감정 배지 */}
                      {!emotion.isDefault && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            isDark ? 'bg-pink-600 text-white' : 'bg-pink-500 text-white'
                          )}>
                            커스텀
                          </span>
                        </div>
                      )}

                      {/* 감정 헤더 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{emotion.emoji}</span>
                          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                            {emotion.label}
                          </span>
                        </div>
                        {/* 감정 편집/삭제 버튼 */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingEmotion({ ...emotion })
                              setKeywordInput('')
                            }}
                            className={cn(
                              'p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700',
                              isDark ? 'text-zinc-400' : 'text-zinc-500'
                            )}
                            title="키워드 편집"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          {/* 커스텀 감정만 삭제 가능 */}
                          {!emotion.isDefault && (
                            <button
                              onClick={() => handleDeleteCustomEmotion(emotion.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 이미지 영역 - 최대 4개 GIF 지원 */}
                      {(() => {
                        const avatarData = emotionAvatars[emotion.id]
                        const imageUrls: string[] = avatarData
                          ? (Array.isArray(avatarData) ? avatarData : [avatarData])
                          : []
                        return (
                          <div
                            className={cn(
                              'relative aspect-square rounded-lg overflow-hidden cursor-pointer',
                              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                            )}
                            onClick={() => emotionFileInputRefs.current[emotion.id]?.click()}
                          >
                            {uploadingEmotion === emotion.id ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                              </div>
                            ) : imageUrls.length > 0 ? (
                              <>
                                {imageUrls.length === 1 ? (
                                  <img
                                    src={imageUrls[0]}
                                    alt={emotion.label}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full p-0.5">
                                    {imageUrls.slice(0, 4).map((url, idx) => (
                                      <div key={idx} className="rounded-sm overflow-hidden">
                                        <img src={url} alt={`${emotion.label}-${idx + 1}`} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                    {imageUrls.length < 4 && Array.from({ length: 4 - imageUrls.length }).map((_, idx) => (
                                      <div key={`empty-${idx}`} className={cn('rounded-sm', isDark ? 'bg-zinc-700/50' : 'bg-zinc-200/50')} />
                                    ))}
                                  </div>
                                )}
                                {/* 이미지 개수 표시 */}
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium">
                                  {imageUrls.length}/4
                                </div>
                                {/* 삭제/추가 버튼 - hover 시 표시 */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      emotionFileInputRefs.current[emotion.id]?.click()
                                    }}
                                    className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                                    title={imageUrls.length < 4 ? "추가" : "변경"}
                                  >
                                    <Camera className="w-4 h-4 text-white" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEmotionAvatarDelete(emotion.id)
                                    }}
                                    className="p-2 rounded-full bg-red-500/80 hover:bg-red-500"
                                    title="삭제"
                              >
                                <Trash2 className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Plus className={cn('w-8 h-8 mb-1', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
                            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              업로드
                            </span>
                          </div>
                        )}
                          </div>
                        )
                      })()}

                      {/* 설명 */}
                      <p className={cn('text-xs mt-2 text-center', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        {emotion.description}
                      </p>

                      {/* 키워드 표시 (커스텀 감정만) */}
                      {!emotion.isDefault && emotion.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 justify-center">
                          {emotion.keywords.slice(0, 3).map((kw, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded',
                                isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                              )}
                            >
                              {kw}
                            </span>
                          ))}
                          {emotion.keywords.length > 3 && (
                            <span className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              +{emotion.keywords.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 숨겨진 파일 입력 */}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                        ref={(el) => { emotionFileInputRefs.current[emotion.id] = el }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleEmotionAvatarUpload(emotion.id, file)
                          }
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </div>
                  ))}
                </div>

                <div className={cn('mt-4 p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-zinc-100')}>
                  <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    💡 <strong>팁:</strong> GIF 이미지를 사용하면 더 생동감 있는 표정을 표현할 수 있어요!
                    권장 크기: 256x256px ~ 512x512px, 최대 10MB
                  </p>
                  <p className={cn('text-xs mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    ✨ <strong>커스텀 감정:</strong> 키워드를 추가하면 대화에서 해당 단어가 감지될 때 자동으로 표정이 바뀝니다.
                  </p>
                </div>
              </div>

              {/* 음성 통화 설정 */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Phone className="w-5 h-5 text-green-500" />
                    음성 통화 설정
                  </h3>
                  {editingSection !== 'voice_settings' && (
                    <button
                      onClick={() => {
                        const voiceSettings = (agent as any).voice_settings || {}
                        startEditing('voice_settings', {
                          voice: voiceSettings.voice || 'sol',
                          conversation_style: voiceSettings.conversation_style || 'friendly',
                          vad_sensitivity: voiceSettings.vad_sensitivity || 'medium',
                        })
                      }}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>
                <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  음성 통화 시 에이전트의 목소리와 대화 스타일을 설정합니다.
                </p>

                {editingSection === 'voice_settings' ? (
                  <div className="space-y-6">
                    {/* 음성 선택 */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        🎤 음성 선택
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {VOICE_OPTIONS.map((voice) => (
                          <button
                            key={voice.id}
                            onClick={() => setEditForm({ ...editForm, voice: voice.id })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              editForm.voice === voice.id
                                ? 'border-accent bg-accent/10'
                                : isDark
                                  ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-900'
                                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">
                                {voice.gender === 'female' ? '👩' : voice.gender === 'male' ? '👨' : '🧑'}
                              </span>
                              <span className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                                {voice.name}
                              </span>
                            </div>
                            <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              {voice.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 대화 스타일 */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        💬 대화 스타일
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {CONVERSATION_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setEditForm({ ...editForm, conversation_style: style.id })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              editForm.conversation_style === style.id
                                ? 'border-accent bg-accent/10'
                                : isDark
                                  ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-900'
                                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
                            )}
                          >
                            <span className={cn('font-medium block mb-1', isDark ? 'text-white' : 'text-zinc-900')}>
                              {style.name}
                            </span>
                            <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              {style.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* VAD 감도 */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        🎚️ 음성 인식 감도
                      </label>
                      <div className="flex gap-3">
                        {VAD_SENSITIVITY_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setEditForm({ ...editForm, vad_sensitivity: option.id })}
                            className={cn(
                              'flex-1 p-3 rounded-xl border-2 text-center transition-all',
                              editForm.vad_sensitivity === option.id
                                ? 'border-accent bg-accent/10'
                                : isDark
                                  ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-900'
                                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
                            )}
                          >
                            <span className={cn('font-medium block', isDark ? 'text-white' : 'text-zinc-900')}>
                              {option.name}
                            </span>
                            <p className={cn('text-xs mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              {option.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('voice_settings')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {(() => {
                      const voiceSettings = (agent as any).voice_settings || {}
                      const selectedVoice = VOICE_OPTIONS.find(v => v.id === (voiceSettings.voice || 'sol'))
                      const selectedStyle = CONVERSATION_STYLES.find(s => s.id === (voiceSettings.conversation_style || 'friendly'))
                      const selectedVad = VAD_SENSITIVITY_OPTIONS.find(v => v.id === (voiceSettings.vad_sensitivity || 'medium'))
                      return (
                        <>
                          <div className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              음성
                            </p>
                            <p className={cn('font-medium flex items-center gap-2', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                              <span>
                                {selectedVoice?.gender === 'female' ? '👩' : selectedVoice?.gender === 'male' ? '👨' : '🧑'}
                              </span>
                              {selectedVoice?.name || 'Sol'}
                            </p>
                          </div>
                          <div className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              대화 스타일
                            </p>
                            <p className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                              {selectedStyle?.name || '친근함'}
                            </p>
                          </div>
                          <div className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              인식 감도
                            </p>
                            <p className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                              {selectedVad?.name || '보통'}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <h3 className={cn('font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                  <Briefcase className="w-5 h-5 text-zinc-500" />
                  메타데이터
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'ID', value: agent.id },
                    { label: '생성일', value: formatDate(agent.created_at, mounted) },
                    { label: '마지막 수정', value: formatDate(agent.updated_at, mounted) },
                    { label: '마지막 활동', value: formatDate(agent.last_active_at, mounted) },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{item.label}</span>
                      <span
                        className={cn(
                          'text-sm',
                          isDark ? 'text-zinc-300' : 'text-zinc-700',
                          item.label === 'ID' && 'font-mono text-xs'
                        )}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 새 감정 추가 모달 */}
      {showAddEmotionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddEmotionModal(false)}>
          <div
            className={cn(
              'w-full max-w-md mx-4 p-6 rounded-2xl shadow-xl',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
              <Plus className="w-5 h-5 text-pink-500" />
              새 감정 추가
            </h3>

            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  감정 이름 *
                </label>
                <input
                  type="text"
                  value={newEmotion.label || ''}
                  onChange={(e) => setNewEmotion({ ...newEmotion, label: e.target.value })}
                  placeholder="예: 설렘, 당황, 집중..."
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 설명 */}
              <div>
                <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  설명
                </label>
                <input
                  type="text"
                  value={newEmotion.description || ''}
                  onChange={(e) => setNewEmotion({ ...newEmotion, description: e.target.value })}
                  placeholder="언제 이 감정이 나타나는지 설명해주세요"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 키워드 */}
              <div>
                <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  감지 키워드 (대화에서 이 단어가 나오면 감정이 활성화됩니다)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddKeyword(false)
                      }
                    }}
                    placeholder="키워드 입력 후 Enter"
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg border',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                    )}
                  />
                  <button
                    onClick={() => handleAddKeyword(false)}
                    className={cn(
                      'px-3 py-2 rounded-lg',
                      isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(newEmotion.keywords?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newEmotion.keywords?.map((kw, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'px-2 py-1 rounded-lg text-sm flex items-center gap-1',
                          isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-600'
                        )}
                      >
                        {kw}
                        <button onClick={() => handleRemoveKeyword(kw, false)} className="hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddEmotionModal(false)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm',
                  isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                )}
              >
                취소
              </button>
              <button
                onClick={handleAddCustomEmotion}
                className="px-4 py-2 rounded-lg text-sm text-white flex items-center gap-1 bg-pink-500 hover:bg-pink-600 active:bg-pink-700"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 감정 편집 모달 (기본 감정 + 커스텀 감정 모두 지원) */}
      {editingEmotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingEmotion(null)}>
          <div
            className={cn(
              'w-full max-w-md mx-4 p-6 rounded-2xl shadow-xl',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
              <Edit3 className="w-5 h-5 text-pink-500" />
              감정 편집
            </h3>

            <div className="space-y-4">
              {/* 이모지 & 이름 */}
              <div className="flex gap-3">
                <div className="w-20">
                  <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                    이모지 *
                  </label>
                  <input
                    type="text"
                    value={editingEmotion.emoji}
                    onChange={(e) => setEditingEmotion({ ...editingEmotion, emoji: e.target.value })}
                    maxLength={2}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-center text-2xl',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                  />
                </div>
                <div className="flex-1">
                  <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                    이름 *
                  </label>
                  <input
                    type="text"
                    value={editingEmotion.label}
                    onChange={(e) => setEditingEmotion({ ...editingEmotion, label: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                  />
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  설명
                </label>
                <input
                  type="text"
                  value={editingEmotion.description}
                  onChange={(e) => setEditingEmotion({ ...editingEmotion, description: e.target.value })}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                  )}
                />
              </div>

              {/* 키워드 */}
              <div>
                <label className={cn('text-xs font-medium mb-1 block', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  감지 키워드
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddKeyword(true)
                      }
                    }}
                    placeholder="키워드 입력 후 Enter"
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg border',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                    )}
                  />
                  <button
                    onClick={() => handleAddKeyword(true)}
                    className={cn(
                      'px-3 py-2 rounded-lg',
                      isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {editingEmotion.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editingEmotion.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'px-2 py-1 rounded-lg text-sm flex items-center gap-1',
                          isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-600'
                        )}
                      >
                        {kw}
                        <button onClick={() => handleRemoveKeyword(kw, true)} className="hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingEmotion(null)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm',
                  isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                )}
              >
                취소
              </button>
              <button
                onClick={handleUpdateCustomEmotion}
                disabled={!editingEmotion.label || !editingEmotion.emoji}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm text-white flex items-center gap-1',
                  editingEmotion.label && editingEmotion.emoji
                    ? 'bg-pink-500 hover:bg-pink-600'
                    : 'bg-zinc-400 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이모티콘 라이브러리 모달 */}
      {showEmoticonModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowEmoticonModal(false)}>
          <div
            className={cn(
              'w-full sm:max-w-md sm:mx-4 p-4 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[70vh] overflow-hidden flex flex-col',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn('text-lg font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                <Smile className="w-5 h-5 text-yellow-500" />
                이모티콘
              </h3>
              <button
                onClick={() => setShowEmoticonModal(false)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 이모티콘 그리드 */}
            <div className="flex-1 overflow-y-auto">
              {emoticonsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : emoticons.length === 0 ? (
                <div className={cn('text-center py-12', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  <Smile className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm mb-2">이모티콘이 없어요</p>
                  <a
                    href="/dashboard-group/mypage/emoticons"
                    className="text-xs text-accent hover:underline"
                    onClick={() => setShowEmoticonModal(false)}
                  >
                    이모티콘 라이브러리에서 추가하기 →
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {emoticons.map((emoticon) => {
                    const imageUrls = emoticon.image_urls?.length > 0 ? emoticon.image_urls : [emoticon.image_url]
                    return (
                      <button
                        key={emoticon.id}
                        onClick={() => handleSelectEmoticon(emoticon)}
                        className={cn(
                          'aspect-square rounded-xl overflow-hidden transition-transform hover:scale-105 active:scale-95 p-0.5',
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                        )}
                        title={emoticon.name}
                      >
                        {imageUrls.length === 1 ? (
                          <img
                            src={imageUrls[0]}
                            alt={emoticon.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                            {imageUrls.slice(0, 4).map((url, idx) => (
                              <div key={idx} className="rounded-sm overflow-hidden">
                                <img src={url} alt={`${emoticon.name}-${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                            {imageUrls.length < 4 && Array.from({ length: 4 - imageUrls.length }).map((_, idx) => (
                              <div key={`empty-${idx}`} className={cn('rounded-sm', isDark ? 'bg-zinc-700/50' : 'bg-zinc-200/50')} />
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 메시지 보내기 모달 */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowMessageModal(false)}>
          <div
            className={cn(
              'w-full max-w-md p-6 rounded-2xl shadow-xl',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                {chatMainGif || getRandomEmotionGif('neutral') || agent?.avatar_url ? (
                  <img
                    src={chatMainGif || getRandomEmotionGif('neutral') || agent?.avatar_url || undefined}
                    alt={agent?.name || '에이전트'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={cn('w-full h-full flex items-center justify-center', isDark ? 'bg-zinc-800' : 'bg-zinc-200')}>
                    <Bot className="w-7 h-7 text-accent" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  {agent?.name}에게 메시지
                </h3>
                <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  메시지를 입력하고 보내세요
                </p>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 메시지 입력 */}
            <div className="mb-4">
              <textarea
                value={modalMessage}
                onChange={(e) => setModalMessage(e.target.value)}
                placeholder={`${agent?.name}에게 전달할 메시지를 입력하세요...`}
                className={cn(
                  'w-full h-32 px-4 py-3 rounded-xl border resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                )}
                autoFocus
              />
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMessageModal(false)
                  setModalMessage('')
                }}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium transition-colors',
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (!modalMessage.trim() || !agent || chatLoading) return

                  const messageToSend = modalMessage.trim()
                  setShowMessageModal(false)
                  setModalMessage('')

                  // 메시지 전송
                  const userMessage = {
                    id: `user-${Date.now()}`,
                    role: 'user' as const,
                    content: messageToSend,
                    timestamp: new Date(),
                  }
                  setChatMessages((prev) => [...prev, userMessage])
                  saveMessageToHistory('user', messageToSend)
                  setChatLoading(true)

                  try {
                    const res = await fetch(`/api/agents/${agent.id}/chat`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: messageToSend,
                        conversation_history: chatMessages.map((m) => ({
                          role: m.role === 'user' ? 'user' : 'assistant',
                          content: m.content,
                        })),
                      }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      const responseContent = data.response || '응답을 생성하지 못했습니다.'
                      const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
                      const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'neutral'
                      const agentMessage = {
                        id: `agent-${Date.now()}`,
                        role: 'agent' as const,
                        content: responseContent,
                        timestamp: new Date(),
                        emotion: detectedEmotion,
                        emotions: detectedEmotions,
                      }
                      setChatMessages((prev) => [...prev, agentMessage])
                      setCurrentEmotion(detectedEmotion)
                      saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)
                    }
                  } catch (err) {
                    console.error('Chat error:', err)
                  } finally {
                    setChatLoading(false)
                    setChatTypingStatus('none')
                  }
                }}
                disabled={!modalMessage.trim() || chatLoading}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                  modalMessage.trim()
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                )}
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 대화 기록 컴포넌트
function ChatHistoryView({ agentId, isDark }: { agentId: string; isDark: boolean }) {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  // 날짜별 대화 기록 가져오기
  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}/history`)
      if (res.ok) {
        const { data } = await res.json()
        if (data && data.length > 0) {
          // 날짜별로 그룹화
          const grouped = data.reduce((acc: any, msg: any) => {
            const date = new Date(msg.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            if (!acc[date]) acc[date] = []
            acc[date].push(msg)
            return acc
          }, {})

          // 날짜 목록 생성 (최신순)
          const dateList = Object.keys(grouped).sort((a, b) => {
            return new Date(b).getTime() - new Date(a).getTime()
          })

          setConversations(dateList.map(date => ({
            date,
            messages: grouped[date],
            messageCount: grouped[date].length,
          })))
        } else {
          setConversations([])
        }
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [agentId])

  // 전체 대화 기록 삭제
  const handleDeleteAll = async () => {
    if (!confirm('모든 대화 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return

    try {
      setDeleting(true)
      const res = await fetch(`/api/agents/${agentId}/history`, { method: 'DELETE' })
      if (res.ok) {
        setConversations([])
        setSelectedDate(null)
      }
    } catch (err) {
      console.error('Failed to delete history:', err)
    } finally {
      setDeleting(false)
    }
  }

  // 특정 날짜의 대화 기록 삭제
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const handleDeleteDate = async (date: string, messages: any[]) => {
    if (!confirm(`${date}의 대화 기록(${messages.length}개)을 삭제하시겠습니까?`)) return

    try {
      setDeletingDate(date)
      const messageIds = messages.map(m => m.id).join(',')
      const res = await fetch(`/api/agents/${agentId}/history?messageIds=${messageIds}`, { method: 'DELETE' })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.date !== date))
        if (selectedDate === date) setSelectedDate(null)
      }
    } catch (err) {
      console.error('Failed to delete date history:', err)
    } finally {
      setDeletingDate(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={cn('w-8 h-8 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className={cn(
        'text-center py-12 rounded-xl border',
        isDark ? 'bg-zinc-800/50 border-zinc-800 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400'
      )}>
        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>아직 대화 기록이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 - 전체 삭제 버튼 */}
      <div className="flex items-center justify-between">
        <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          총 {conversations.reduce((acc, c) => acc + c.messageCount, 0)}개의 메시지
        </p>
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
            isDark
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'bg-red-50 text-red-500 hover:bg-red-100'
          )}
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          전체 삭제
        </button>
      </div>

      {/* 날짜별 대화 목록 */}
      {conversations.map((conv) => (
        <div
          key={conv.date}
          className={cn(
            'rounded-xl border overflow-hidden',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}
        >
          {/* 날짜 헤더 */}
          <div
            className={cn(
              'px-4 py-3 flex items-center justify-between transition-colors',
              isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-zinc-50'
            )}
          >
            <button
              onClick={() => setSelectedDate(selectedDate === conv.date ? null : conv.date)}
              className="flex items-center gap-3 flex-1"
            >
              <Calendar className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
              <span className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                {conv.date}
              </span>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                {conv.messageCount}개 메시지
              </span>
              <ChevronRight
                className={cn(
                  'w-5 h-5 transition-transform',
                  isDark ? 'text-zinc-500' : 'text-zinc-400',
                  selectedDate === conv.date && 'rotate-90'
                )}
              />
            </button>
            {/* 개별 날짜 삭제 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteDate(conv.date, conv.messages)
              }}
              disabled={deletingDate === conv.date}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isDark
                  ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400'
                  : 'hover:bg-red-50 text-zinc-400 hover:text-red-500'
              )}
              title={`${conv.date} 대화 삭제`}
            >
              {deletingDate === conv.date ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 메시지 목록 (펼쳐졌을 때) */}
          {selectedDate === conv.date && (
            <div className={cn(
              'border-t px-4 py-3 space-y-3 max-h-96 overflow-y-auto',
              isDark ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-100 bg-zinc-50'
            )}>
              {conv.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-3 py-2 rounded-xl text-sm',
                      msg.role === 'user'
                        ? 'bg-accent text-white'
                        : isDark
                          ? 'bg-zinc-800 text-zinc-200'
                          : 'bg-white text-zinc-800 border border-zinc-200'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn(
                      'text-xs mt-1 opacity-60',
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
