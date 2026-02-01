/**
 * Agent Mode System
 *
 * Claude Code CLI가 PM/리더로서 서브 에이전트를 동적으로 생성하고 관리하는 시스템
 *
 * 아키텍처:
 * - Quick Mode: Claude Code가 직접 모든 작업 처리
 * - Agent Mode: Claude Code가 PM으로서 프로젝트 분석 → 필요한 에이전트 결정 → Task 도구로 위임
 */

// 서브 에이전트 역할 정의
export interface SubAgentRole {
  id: string
  name: string
  nameKr: string
  expertise: string[]
  systemPrompt: string
  suggestedFor: string[] // 이런 키워드가 있으면 이 에이전트 추천
}

// 미리 정의된 에이전트 역할 템플릿 (PM이 필요에 따라 선택)
export const AGENT_ROLE_TEMPLATES: SubAgentRole[] = [
  {
    id: 'planner',
    name: 'Planner',
    nameKr: '기획자',
    expertise: ['architecture', 'design', 'planning', 'structure'],
    suggestedFor: ['설계', '구조', '아키텍처', 'design', 'plan', 'structure'],
    systemPrompt: `당신은 Planner 에이전트입니다.
역할: 프로젝트 구조 설계, 폴더 구조 정의, 모듈 분리, 데이터 흐름 설계
출력: 폴더 구조, 파일 목록, 인터페이스 정의, 작업 순서`
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    nameKr: 'UI 개발자',
    expertise: ['react', 'vue', 'css', 'ui', 'component', 'responsive'],
    suggestedFor: ['UI', 'component', '컴포넌트', 'frontend', '프론트', 'react', 'vue', 'css', '디자인', 'tailwind'],
    systemPrompt: `당신은 Frontend Developer 에이전트입니다.
역할: UI 컴포넌트 개발, 반응형 디자인, 사용자 경험 최적화
기술: React, Vue, Tailwind CSS, CSS-in-JS, 접근성`
  },
  {
    id: 'backend',
    name: 'Backend Developer',
    nameKr: '백엔드 개발자',
    expertise: ['api', 'database', 'server', 'auth', 'security'],
    suggestedFor: ['API', 'server', '서버', 'backend', '백엔드', 'database', 'DB', '인증', 'auth'],
    systemPrompt: `당신은 Backend Developer 에이전트입니다.
역할: API 설계 및 구현, 데이터베이스 스키마, 인증/인가, 서버 로직
기술: Node.js, Python, SQL, REST, GraphQL`
  },
  {
    id: 'tester',
    name: 'QA Tester',
    nameKr: '테스터',
    expertise: ['test', 'qa', 'jest', 'cypress', 'playwright'],
    suggestedFor: ['test', '테스트', 'QA', 'jest', 'cypress', 'e2e', '검증'],
    systemPrompt: `당신은 QA Tester 에이전트입니다.
역할: 테스트 케이스 작성, 단위/통합/E2E 테스트, 버그 발견
기술: Jest, Vitest, Cypress, Playwright`
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    nameKr: '코드 리뷰어',
    expertise: ['review', 'quality', 'security', 'performance'],
    suggestedFor: ['리뷰', 'review', '품질', 'quality', '보안', 'security', '성능'],
    systemPrompt: `당신은 Code Reviewer 에이전트입니다.
역할: 코드 품질 검토, 보안 취약점 발견, 성능 이슈 탐지, 아키텍처 준수 확인
체크리스트: SOLID, DRY, 보안, 성능, 에러 핸들링`
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    nameKr: 'DevOps',
    expertise: ['docker', 'ci', 'cd', 'deploy', 'infrastructure'],
    suggestedFor: ['docker', 'deploy', '배포', 'CI', 'CD', 'infrastructure', '인프라'],
    systemPrompt: `당신은 DevOps Engineer 에이전트입니다.
역할: 배포 파이프라인, Docker 설정, CI/CD, 인프라 구성
기술: Docker, GitHub Actions, Vercel, AWS`
  },
  {
    id: 'data',
    name: 'Data Engineer',
    nameKr: '데이터 엔지니어',
    expertise: ['data', 'analytics', 'etl', 'schema'],
    suggestedFor: ['data', '데이터', 'analytics', '분석', 'schema', 'ETL'],
    systemPrompt: `당신은 Data Engineer 에이전트입니다.
역할: 데이터 모델링, 스키마 설계, ETL 파이프라인, 분석 쿼리
기술: SQL, Supabase, PostgreSQL, 데이터 정규화`
  },
  {
    id: 'security',
    name: 'Security Expert',
    nameKr: '보안 전문가',
    expertise: ['security', 'auth', 'encryption', 'vulnerability'],
    suggestedFor: ['보안', 'security', 'auth', '인증', '암호화', 'encryption', 'vulnerability'],
    systemPrompt: `당신은 Security Expert 에이전트입니다.
역할: 보안 취약점 분석, 인증/인가 설계, 암호화, 보안 베스트 프랙티스
체크: OWASP Top 10, XSS, SQL Injection, CSRF, 인증 플로우`
  },
  {
    id: 'payment',
    name: 'Payment Specialist',
    nameKr: '결제 전문가',
    expertise: ['payment', 'stripe', 'billing', 'subscription'],
    suggestedFor: ['결제', 'payment', 'stripe', '구독', 'subscription', 'billing', '쇼핑'],
    systemPrompt: `당신은 Payment Specialist 에이전트입니다.
역할: 결제 시스템 통합, Stripe/Paddle 연동, 구독 관리, 결제 보안
기술: Stripe API, 웹훅, PCI 컴플라이언스`
  },
  {
    id: 'ai-integration',
    name: 'AI Integration Expert',
    nameKr: 'AI 통합 전문가',
    expertise: ['ai', 'llm', 'openai', 'langchain', 'embedding'],
    suggestedFor: ['AI', 'LLM', 'OpenAI', 'ChatGPT', 'embedding', 'langchain', '인공지능'],
    systemPrompt: `당신은 AI Integration Expert 에이전트입니다.
역할: LLM API 통합, 프롬프트 엔지니어링, 임베딩, RAG 시스템
기술: OpenAI, Anthropic, LangChain, Vector DB`
  },
]

// PM(리더)용 Agent Mode 시스템 프롬프트
export const AGENT_MODE_SYSTEM_PROMPT = `# 🚨 필수: 당신은 PM(Project Manager)입니다

## ⛔ 절대 금지
- **직접 코드 작성 금지** - Read, Write, Edit, Bash 도구 직접 사용 금지!
- **혼자 작업 금지** - 반드시 Task 도구로 서브 에이전트에게 위임!

## ✅ 반드시 해야 할 것
1. 요청을 분석하고 필요한 에이전트 결정 (최소 1개, 최대 4개)
2. **즉시 Task 도구를 호출**하여 에이전트에게 작업 위임
3. 에이전트 결과를 취합하여 사용자에게 보고

## 🔧 Task 도구 사용법

\`\`\`
Task(
  subagent_type: "general-purpose",
  description: "Frontend Developer - 로그인 폼 개발",
  prompt: "당신은 Frontend Developer입니다.

작업: 로그인 폼 컴포넌트 개발
- components/auth/LoginForm.tsx 생성
- React + Tailwind CSS 사용
- 유효성 검증 추가

완료 후 생성한 파일 목록을 보고하세요."
)
\`\`\`

## 📋 에이전트 역할
- **Frontend Developer**: UI, React, CSS, 컴포넌트
- **Backend Developer**: API, 서버, DB, 인증
- **QA Tester**: 테스트, 검증
- **Security Expert**: 보안, 취약점

## 🎯 지금 바로 실행

사용자 요청을 받으면:
1. 짧게 분석 (2-3문장)
2. **즉시 Task 도구 호출** (여러 에이전트 필요하면 병렬로!)
3. 결과 대기 후 요약 보고

**중요: 분석만 하고 끝내지 마세요. 반드시 Task 도구를 호출하세요!**
`

// Quick Mode용 시스템 프롬프트 (기존과 동일하게 직접 작업)
export const QUICK_MODE_SYSTEM_PROMPT = `## Quick Mode: 직접 실행

당신은 Claude Code입니다. 사용자의 요청을 직접 처리합니다.
- 파일 읽기/쓰기/수정
- 코드 분석 및 작성
- 터미널 명령 실행
- 프로젝트 탐색

빠르고 효율적으로 작업을 완료하세요.
`

// 프로젝트 분석하여 필요한 에이전트 추천
export function analyzeProjectAndSuggestAgents(
  userRequest: string,
  projectContext?: {
    files?: string[]
    packageJson?: any
    techStack?: string[]
  }
): SubAgentRole[] {
  const request = userRequest.toLowerCase()
  const suggestedAgents: SubAgentRole[] = []

  // 키워드 기반 에이전트 추천
  for (const agent of AGENT_ROLE_TEMPLATES) {
    const hasMatchingKeyword = agent.suggestedFor.some(keyword =>
      request.includes(keyword.toLowerCase())
    )
    if (hasMatchingKeyword) {
      suggestedAgents.push(agent)
    }
  }

  // 프로젝트 컨텍스트 기반 추가 추천
  if (projectContext?.packageJson) {
    const deps = {
      ...projectContext.packageJson.dependencies,
      ...projectContext.packageJson.devDependencies
    }

    if (deps['react'] || deps['vue'] || deps['next']) {
      const frontend = AGENT_ROLE_TEMPLATES.find(a => a.id === 'frontend')
      if (frontend && !suggestedAgents.includes(frontend)) {
        suggestedAgents.push(frontend)
      }
    }

    if (deps['stripe'] || deps['@stripe/stripe-js']) {
      const payment = AGENT_ROLE_TEMPLATES.find(a => a.id === 'payment')
      if (payment && !suggestedAgents.includes(payment)) {
        suggestedAgents.push(payment)
      }
    }

    if (deps['openai'] || deps['langchain'] || deps['@anthropic-ai/sdk']) {
      const ai = AGENT_ROLE_TEMPLATES.find(a => a.id === 'ai-integration')
      if (ai && !suggestedAgents.includes(ai)) {
        suggestedAgents.push(ai)
      }
    }
  }

  // 기본적으로 Planner는 복잡한 요청에 항상 포함
  const complexIndicators = ['만들어', 'build', 'create', '개발', 'develop', '구현', 'implement']
  if (complexIndicators.some(i => request.includes(i))) {
    const planner = AGENT_ROLE_TEMPLATES.find(a => a.id === 'planner')
    if (planner && !suggestedAgents.includes(planner)) {
      suggestedAgents.unshift(planner) // 맨 앞에 추가
    }
  }

  return suggestedAgents
}

// 서브 에이전트 스폰 이벤트 발생
export function emitAgentSpawnEvent(config: {
  name: string
  role: string
  task: string
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agent:spawn', {
      detail: config
    }))
  }
}

// 서브 에이전트 상태 업데이트 이벤트
export function emitAgentUpdateEvent(config: {
  id: string
  status: 'idle' | 'working' | 'complete' | 'error'
  progress?: number
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agent:update', {
      detail: config
    }))
  }
}
