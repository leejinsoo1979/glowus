'use client'

// ============================================
// 슬래시 명령어 시스템
// ============================================

export interface SlashCommand {
  name: string
  description: string
  aliases?: string[]
  args?: string
  execute: (args: string, context: CommandContext) => Promise<CommandResult> | CommandResult
}

export interface CommandContext {
  cwd?: string
  sessionId?: string | null
  currentFile?: string
  selectedCode?: string
  clearMessages: () => void
  addMessage: (message: { role: 'user' | 'assistant' | 'system'; content: string }) => void
  setContext: (ctx: Record<string, unknown>) => void
  updateSettings: (settings: Record<string, unknown>) => void
}

export interface CommandResult {
  type: 'message' | 'action' | 'prompt' | 'clear' | 'settings'
  content?: string
  data?: unknown
  // prompt 타입일 경우 CLI로 전달될 프롬프트
  prompt?: string
  // 바로 실행할지 여부
  immediate?: boolean
}

// 🔥 기본 슬래시 명령어 정의
export const SLASH_COMMANDS: Record<string, SlashCommand> = {
  // ============ 채팅 관련 ============
  clear: {
    name: 'clear',
    description: '채팅 기록을 모두 지웁니다',
    aliases: ['cls', 'reset'],
    execute: (_, ctx) => {
      ctx.clearMessages()
      return { type: 'clear', content: '채팅이 초기화되었습니다.' }
    }
  },

  help: {
    name: 'help',
    description: '사용 가능한 명령어 목록을 보여줍니다',
    aliases: ['?', 'commands'],
    execute: () => {
      const commands = Object.values(SLASH_COMMANDS)
        .map(cmd => `• **/${cmd.name}**${cmd.args ? ` ${cmd.args}` : ''} - ${cmd.description}`)
        .join('\n')
      return {
        type: 'message',
        content: `## 사용 가능한 명령어\n\n${commands}\n\n**Tip**: 명령어 앞에 \`/\`를 붙여서 사용하세요.`
      }
    }
  },

  // ============ Git 관련 ============
  git: {
    name: 'git',
    description: 'Git 작업을 수행합니다 (status, diff, commit 등)',
    aliases: ['g'],
    args: '<command>',
    execute: (args) => {
      const subCommand = args.trim().toLowerCase()

      switch (subCommand) {
        case 'status':
        case 's':
          return {
            type: 'prompt',
            prompt: 'Git 상태를 확인하고 변경된 파일 목록을 보여줘. `git status`를 실행해.',
            immediate: true
          }
        case 'diff':
        case 'd':
          return {
            type: 'prompt',
            prompt: '현재 변경 사항을 diff로 보여줘. `git diff`를 실행해.',
            immediate: true
          }
        case 'log':
        case 'l':
          return {
            type: 'prompt',
            prompt: '최근 커밋 히스토리 10개를 보여줘. `git log --oneline -10`을 실행해.',
            immediate: true
          }
        case 'branch':
        case 'b':
          return {
            type: 'prompt',
            prompt: '모든 브랜치 목록을 보여줘. `git branch -a`를 실행해.',
            immediate: true
          }
        case 'stash':
          return {
            type: 'prompt',
            prompt: '현재 변경사항을 stash해줘. `git stash`를 실행해.',
            immediate: true
          }
        case 'commit':
        case 'c':
          return {
            type: 'prompt',
            prompt: '변경 사항을 분석하고 적절한 커밋 메시지를 작성해서 커밋해줘.',
            immediate: true
          }
        default:
          return {
            type: 'message',
            content: `## Git 명령어\n\n- \`/git status\` (s) - 상태 확인\n- \`/git diff\` (d) - 변경 사항 보기\n- \`/git log\` (l) - 커밋 히스토리\n- \`/git branch\` (b) - 브랜치 목록\n- \`/git stash\` - 변경사항 임시 저장\n- \`/git commit\` (c) - 자동 커밋 메시지 생성 후 커밋`
          }
      }
    }
  },

  // ============ 테스트 관련 ============
  test: {
    name: 'test',
    description: '테스트를 실행합니다',
    aliases: ['t'],
    args: '[file|pattern]',
    execute: (args) => {
      const target = args.trim()
      if (target) {
        return {
          type: 'prompt',
          prompt: `테스트를 실행해줘: ${target}. npm test 또는 적절한 테스트 명령어를 사용해.`,
          immediate: true
        }
      }
      return {
        type: 'prompt',
        prompt: '전체 테스트를 실행하고 결과를 요약해줘.',
        immediate: true
      }
    }
  },

  // ============ 빌드/실행 관련 ============
  build: {
    name: 'build',
    description: '프로젝트를 빌드합니다',
    aliases: ['b'],
    execute: () => ({
      type: 'prompt',
      prompt: '프로젝트를 빌드해줘. package.json의 build 스크립트를 실행해.',
      immediate: true
    })
  },

  run: {
    name: 'run',
    description: '스크립트를 실행합니다',
    args: '<script>',
    execute: (args) => {
      const script = args.trim()
      if (!script) {
        return {
          type: 'message',
          content: '실행할 스크립트 이름을 지정해주세요. 예: `/run dev`'
        }
      }
      return {
        type: 'prompt',
        prompt: `npm run ${script} 명령어를 실행해줘.`,
        immediate: true
      }
    }
  },

  lint: {
    name: 'lint',
    description: '코드 린트를 실행합니다',
    execute: () => ({
      type: 'prompt',
      prompt: '린트를 실행하고 에러가 있으면 수정해줘.',
      immediate: true
    })
  },

  typecheck: {
    name: 'typecheck',
    description: 'TypeScript 타입체크를 실행합니다',
    aliases: ['tsc', 'types'],
    execute: () => ({
      type: 'prompt',
      prompt: 'TypeScript 타입체크를 실행하고 에러가 있으면 알려줘.',
      immediate: true
    })
  },

  // ============ 파일 작업 관련 ============
  find: {
    name: 'find',
    description: '파일을 검색합니다',
    aliases: ['search', 'f'],
    args: '<pattern>',
    execute: (args) => {
      const pattern = args.trim()
      if (!pattern) {
        return {
          type: 'message',
          content: '검색할 패턴을 입력해주세요. 예: `/find *.tsx`'
        }
      }
      return {
        type: 'prompt',
        prompt: `"${pattern}" 패턴에 맞는 파일을 찾아줘.`,
        immediate: true
      }
    }
  },

  grep: {
    name: 'grep',
    description: '코드에서 텍스트를 검색합니다',
    args: '<text>',
    execute: (args) => {
      const text = args.trim()
      if (!text) {
        return {
          type: 'message',
          content: '검색할 텍스트를 입력해주세요. 예: `/grep useState`'
        }
      }
      return {
        type: 'prompt',
        prompt: `코드베이스에서 "${text}"를 검색하고 어디서 사용되는지 보여줘.`,
        immediate: true
      }
    }
  },

  tree: {
    name: 'tree',
    description: '프로젝트 구조를 보여줍니다',
    aliases: ['ls', 'dir'],
    args: '[path]',
    execute: (args) => {
      const targetPath = args.trim() || '.'
      return {
        type: 'prompt',
        prompt: `${targetPath} 경로의 디렉토리 구조를 보여줘. 주요 폴더와 파일 위주로.`,
        immediate: true
      }
    }
  },

  // ============ 분석/설명 ============
  explain: {
    name: 'explain',
    description: '선택된 코드나 파일을 설명합니다',
    aliases: ['e'],
    args: '[file]',
    execute: (args, ctx) => {
      if (ctx.selectedCode) {
        return {
          type: 'prompt',
          prompt: `다음 코드를 자세히 설명해줘:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      const file = args.trim()
      if (file) {
        return {
          type: 'prompt',
          prompt: `${file} 파일의 내용과 역할을 설명해줘.`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '설명할 코드를 선택하거나 파일 경로를 지정해주세요. 예: `/explain src/App.tsx`'
      }
    }
  },

  review: {
    name: 'review',
    description: '코드 리뷰를 수행합니다',
    aliases: ['r'],
    args: '[file]',
    execute: (args, ctx) => {
      if (ctx.selectedCode) {
        return {
          type: 'prompt',
          prompt: `다음 코드를 리뷰해줘. 개선점, 버그, 보안 이슈를 찾아줘:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      const file = args.trim()
      if (file) {
        return {
          type: 'prompt',
          prompt: `${file} 파일을 코드 리뷰해줘. 개선점, 버그, 보안 이슈를 찾아줘.`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '리뷰할 코드를 선택하거나 파일 경로를 지정해주세요.'
      }
    }
  },

  refactor: {
    name: 'refactor',
    description: '코드 리팩토링을 제안합니다',
    execute: (args, ctx) => {
      if (ctx.selectedCode) {
        return {
          type: 'prompt',
          prompt: `다음 코드를 리팩토링해줘. 가독성, 성능, 유지보수성을 개선해:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      const file = args.trim()
      if (file) {
        return {
          type: 'prompt',
          prompt: `${file} 파일을 리팩토링해줘.`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '리팩토링할 코드를 선택하거나 파일 경로를 지정해주세요.'
      }
    }
  },

  // ============ 컨텍스트/설정 ============
  cd: {
    name: 'cd',
    description: '작업 디렉토리를 변경합니다',
    aliases: ['cwd', 'chdir', 'project'],
    args: '<path>',
    execute: (args, ctx) => {
      const path = args.trim()

      if (!path) {
        return {
          type: 'message',
          content: `## 현재 작업 디렉토리\n\n**경로**: \`${ctx.cwd || '미설정'}\`\n\n사용법: \`/cd /path/to/project\``
        }
      }

      // 경로 유효성 검사를 위한 프롬프트 (Claude가 실제로 확인)
      if (path === '~' || path.startsWith('~/')) {
        return {
          type: 'prompt',
          prompt: `홈 디렉토리 경로를 확인해줘. "${path}" 경로가 존재하는지 확인하고, 존재하면 절대 경로로 알려줘.`,
          immediate: true
        }
      }

      // 절대 경로인 경우 바로 설정
      if (path.startsWith('/')) {
        ctx.setContext({ projectPath: path })
        return {
          type: 'settings',
          content: `✅ 작업 디렉토리가 변경되었습니다:\n\n\`${path}\`\n\n이제 모든 명령은 이 경로에서 실행됩니다.`,
          data: { projectPath: path }
        }
      }

      // 상대 경로인 경우
      const newPath = ctx.cwd ? `${ctx.cwd}/${path}`.replace(/\/+/g, '/') : path
      ctx.setContext({ projectPath: newPath })
      return {
        type: 'settings',
        content: `✅ 작업 디렉토리가 변경되었습니다:\n\n\`${newPath}\``,
        data: { projectPath: newPath }
      }
    }
  },

  pwd: {
    name: 'pwd',
    description: '현재 작업 디렉토리를 보여줍니다',
    execute: (_, ctx) => {
      return {
        type: 'message',
        content: `**작업 디렉토리**: \`${ctx.cwd || '미설정 (GlowUS 서버 경로 사용 중)'}\`\n\n변경하려면: \`/cd /path/to/project\``
      }
    }
  },

  context: {
    name: 'context',
    description: '현재 컨텍스트 정보를 보여줍니다',
    aliases: ['ctx'],
    execute: (_, ctx) => {
      const info = [
        `**작업 디렉토리**: ${ctx.cwd || '미설정 (GlowUS 서버 경로 사용 중)'}`,
        `**현재 파일**: ${ctx.currentFile || '없음'}`,
        `**선택된 코드**: ${ctx.selectedCode ? `${ctx.selectedCode.split('\n').length}줄` : '없음'}`,
        `**세션 ID**: ${ctx.sessionId || '없음'}`
      ].join('\n')

      return {
        type: 'message',
        content: `## 현재 컨텍스트\n\n${info}\n\n💡 **Tip**: \`/cd /path/to/project\`로 작업 디렉토리를 변경하세요.`
      }
    }
  },

  model: {
    name: 'model',
    description: '모델 선택 (드롭다운)',
    execute: () => ({
      type: 'action',
      data: { action: 'showModelSelector' }
    })
  },

  opus: {
    name: 'opus',
    description: 'Claude Opus 4.5 (최고 성능)',
    execute: (_, ctx) => {
      ctx.updateSettings({ model: 'opus' })
      return { type: 'action', data: { action: 'modelChanged', model: 'opus' } }
    }
  },

  sonnet: {
    name: 'sonnet',
    description: 'Claude Sonnet 4.5 (균형)',
    execute: (_, ctx) => {
      ctx.updateSettings({ model: 'sonnet' })
      return { type: 'action', data: { action: 'modelChanged', model: 'sonnet' } }
    }
  },

  haiku: {
    name: 'haiku',
    description: 'Claude Haiku 4.5 (빠름)',
    execute: (_, ctx) => {
      ctx.updateSettings({ model: 'haiku' })
      return { type: 'action', data: { action: 'modelChanged', model: 'haiku' } }
    }
  },

  thinking: {
    name: 'thinking',
    description: 'Extended Thinking 모드를 토글합니다',
    aliases: ['think'],
    execute: (args, ctx) => {
      const value = args.trim().toLowerCase()
      if (value === 'on' || value === '1' || value === 'true') {
        ctx.updateSettings({ extendedThinking: true })
        return { type: 'settings', content: 'Extended Thinking 모드가 **활성화**되었습니다.' }
      }
      if (value === 'off' || value === '0' || value === 'false') {
        ctx.updateSettings({ extendedThinking: false })
        return { type: 'settings', content: 'Extended Thinking 모드가 **비활성화**되었습니다.' }
      }
      return {
        type: 'message',
        content: '사용법: `/thinking on` 또는 `/thinking off`'
      }
    }
  },

  // ============ 실행 모드 ============
  agent: {
    name: 'agent',
    description: 'Agent Mode 활성화 (PM으로서 서브 에이전트 생성/위임)',
    aliases: ['pm', 'team'],
    execute: (_, ctx) => {
      console.log('[SlashCommand] /agent 실행 - executionMode를 agent로 변경')
      ctx.updateSettings({ executionMode: 'agent' })
      console.log('[SlashCommand] updateSettings 호출 완료')
      return {
        type: 'settings',
        content: `## 🎯 Agent Mode 활성화

Claude Code가 **PM(프로젝트 매니저)** 역할을 수행합니다.

**작동 방식:**
1. 요청을 분석하여 필요한 전문가 에이전트 결정
2. 프로젝트 규모에 맞는 최적의 팀 구성
3. 각 에이전트에게 작업 위임 (병렬 처리)
4. 결과 취합 및 통합

**사용 가능한 에이전트:**
• Planner (기획자) - 구조 설계
• Frontend (UI 개발자) - React/Vue 컴포넌트
• Backend (백엔드) - API/DB/서버
• Tester (QA) - 테스트 작성
• Reviewer (리뷰어) - 코드 품질
• DevOps - 배포/CI/CD
• Security (보안) - 취약점 분석
• AI Integration - LLM 통합

Quick Mode로 전환: \`/quick\``
      }
    }
  },

  quick: {
    name: 'quick',
    description: 'Quick Mode 활성화 (직접 실행)',
    aliases: ['direct', 'solo'],
    execute: (_, ctx) => {
      console.log('[SlashCommand] /quick 실행 - executionMode를 quick으로 변경')
      ctx.updateSettings({ executionMode: 'quick' })
      console.log('[SlashCommand] updateSettings 호출 완료')
      return {
        type: 'settings',
        content: `## ⚡ Quick Mode 활성화

Claude Code가 **직접** 모든 작업을 처리합니다.

**특징:**
- 빠른 응답 속도
- 단순 작업에 최적
- 직접 파일 읽기/쓰기/수정

Agent Mode로 전환: \`/agent\``
      }
    }
  },

  mode: {
    name: 'mode',
    description: '실행 모드 확인 및 변경',
    execute: (args, ctx) => {
      const value = args.trim().toLowerCase()

      if (value === 'agent' || value === 'pm' || value === 'team') {
        ctx.updateSettings({ executionMode: 'agent' })
        return { type: 'settings', content: '🎯 **Agent Mode** 활성화됨 - PM으로서 서브 에이전트 관리' }
      }
      if (value === 'quick' || value === 'direct' || value === 'solo') {
        ctx.updateSettings({ executionMode: 'quick' })
        return { type: 'settings', content: '⚡ **Quick Mode** 활성화됨 - 직접 실행' }
      }

      return {
        type: 'message',
        content: `## 실행 모드

- \`/mode agent\` - Agent Mode (PM으로서 서브 에이전트 관리)
- \`/mode quick\` - Quick Mode (직접 실행)

**또는 단축 명령어:**
- \`/agent\` - Agent Mode 활성화
- \`/quick\` - Quick Mode 활성화`
      }
    }
  },

  // ============ 디버깅 ============
  debug: {
    name: 'debug',
    description: '디버깅을 도와줍니다',
    args: '[error-message]',
    execute: (args, ctx) => {
      const errorMsg = args.trim()
      if (ctx.selectedCode && errorMsg) {
        return {
          type: 'prompt',
          prompt: `다음 코드에서 발생하는 에러를 디버깅해줘:\n\n에러: ${errorMsg}\n\n코드:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      if (errorMsg) {
        return {
          type: 'prompt',
          prompt: `다음 에러를 분석하고 해결 방법을 알려줘:\n\n${errorMsg}`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '디버깅할 에러 메시지를 입력해주세요. 예: `/debug Cannot read property of undefined`'
      }
    }
  },

  fix: {
    name: 'fix',
    description: '선택된 코드의 문제를 수정합니다',
    execute: (args, ctx) => {
      if (ctx.selectedCode) {
        return {
          type: 'prompt',
          prompt: `다음 코드의 버그나 문제를 찾아서 수정해줘:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      const file = args.trim()
      if (file) {
        return {
          type: 'prompt',
          prompt: `${file} 파일의 버그나 문제를 찾아서 수정해줘.`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '수정할 코드를 선택하거나 파일 경로를 지정해주세요.'
      }
    }
  },

  // ============ 문서화 ============
  doc: {
    name: 'doc',
    description: '문서나 주석을 생성합니다',
    aliases: ['docs', 'jsdoc'],
    execute: (args, ctx) => {
      if (ctx.selectedCode) {
        return {
          type: 'prompt',
          prompt: `다음 코드에 JSDoc 주석을 추가해줘:\n\`\`\`\n${ctx.selectedCode}\n\`\`\``,
          immediate: true
        }
      }
      const file = args.trim()
      if (file) {
        return {
          type: 'prompt',
          prompt: `${file} 파일에 JSDoc 주석과 README 문서를 생성해줘.`,
          immediate: true
        }
      }
      return {
        type: 'message',
        content: '문서화할 코드를 선택하거나 파일 경로를 지정해주세요.'
      }
    }
  },

  readme: {
    name: 'readme',
    description: 'README 파일을 생성합니다',
    execute: () => ({
      type: 'prompt',
      prompt: '이 프로젝트의 README.md 파일을 분석하고, 없다면 생성해줘. 프로젝트 설명, 설치 방법, 사용법을 포함해.',
      immediate: true
    })
  },

  // ============ 유틸리티 ============
  todo: {
    name: 'todo',
    description: 'TODO 항목을 검색합니다',
    aliases: ['fixme'],
    execute: () => ({
      type: 'prompt',
      prompt: '코드베이스에서 모든 TODO, FIXME 주석을 찾아서 목록으로 보여줘.',
      immediate: true
    })
  },

  deps: {
    name: 'deps',
    description: '의존성을 분석합니다',
    aliases: ['dependencies'],
    execute: () => ({
      type: 'prompt',
      prompt: 'package.json의 의존성을 분석하고 업데이트가 필요한 패키지, 보안 취약점이 있는 패키지를 알려줘.',
      immediate: true
    })
  },

  init: {
    name: 'init',
    description: '프로젝트 초기화 작업을 수행합니다',
    args: '<type>',
    execute: (args) => {
      const type = args.trim().toLowerCase()
      switch (type) {
        case 'git':
          return {
            type: 'prompt',
            prompt: 'Git 레포지토리를 초기화하고 .gitignore 파일을 생성해줘.',
            immediate: true
          }
        case 'eslint':
          return {
            type: 'prompt',
            prompt: 'ESLint를 설정하고 .eslintrc 파일을 생성해줘.',
            immediate: true
          }
        case 'prettier':
          return {
            type: 'prompt',
            prompt: 'Prettier를 설정하고 .prettierrc 파일을 생성해줘.',
            immediate: true
          }
        case 'typescript':
        case 'ts':
          return {
            type: 'prompt',
            prompt: 'TypeScript를 설정하고 tsconfig.json 파일을 생성해줘.',
            immediate: true
          }
        default:
          return {
            type: 'message',
            content: `## 초기화 옵션\n\n- \`/init git\` - Git 레포지토리\n- \`/init eslint\` - ESLint 설정\n- \`/init prettier\` - Prettier 설정\n- \`/init typescript\` - TypeScript 설정`
          }
      }
    }
  },

  // ============ 코드 생성 (템플릿 기반) ============
  component: {
    name: 'component',
    description: 'React 컴포넌트를 생성합니다',
    aliases: ['comp', 'c'],
    args: '<name>',
    execute: (args) => {
      const name = args.trim()
      if (!name) {
        return {
          type: 'message',
          content: '컴포넌트 이름을 입력해주세요. 예: `/component Button`'
        }
      }

      const pascalName = name.charAt(0).toUpperCase() + name.slice(1)

      return {
        type: 'prompt',
        prompt: `다음 템플릿을 기반으로 "${pascalName}" React 컴포넌트를 생성해줘:

**파일 위치**: \`components/${pascalName}/${pascalName}.tsx\`

**템플릿**:
\`\`\`tsx
'use client'

import React, { memo } from 'react'
import { cn } from '@/lib/utils'

interface ${pascalName}Props {
  className?: string
  children?: React.ReactNode
}

export const ${pascalName} = memo(function ${pascalName}({
  className,
  children,
}: ${pascalName}Props) {
  return (
    <div className={cn("", className)}>
      {children}
    </div>
  )
})

export default ${pascalName}
\`\`\`

**추가로 생성할 파일**: \`components/${pascalName}/index.ts\` (export 파일)

필요에 따라 props와 스타일을 확장해줘.`,
        immediate: true
      }
    }
  },

  api: {
    name: 'api',
    description: 'Next.js API Route를 생성합니다',
    aliases: ['route'],
    args: '<name>',
    execute: (args) => {
      const name = args.trim()
      if (!name) {
        return {
          type: 'message',
          content: 'API 경로 이름을 입력해주세요. 예: `/api users`'
        }
      }

      const routeName = name.toLowerCase().replace(/\s+/g, '-')

      return {
        type: 'prompt',
        prompt: `다음 템플릿을 기반으로 "${routeName}" Next.js API Route를 생성해줘:

**파일 위치**: \`app/api/${routeName}/route.ts\`

**템플릿**:
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface RequestBody {
  // TODO: Define request body type
}

interface ResponseData {
  success: boolean
  data?: unknown
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // TODO: Implement GET logic

    return NextResponse.json<ResponseData>({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('[API] GET /${routeName} error:', error)
    return NextResponse.json<ResponseData>(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()

    // TODO: Implement POST logic

    return NextResponse.json<ResponseData>({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('[API] POST /${routeName} error:', error)
    return NextResponse.json<ResponseData>(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
\`\`\`

실제 로직은 TODO 부분에 구현해줘.`,
        immediate: true
      }
    }
  },

  hook: {
    name: 'hook',
    description: '커스텀 React Hook을 생성합니다',
    aliases: ['usehook'],
    args: '<name>',
    execute: (args) => {
      const name = args.trim()
      if (!name) {
        return {
          type: 'message',
          content: 'Hook 이름을 입력해주세요. 예: `/hook Auth` → `useAuth`'
        }
      }

      const hookName = name.charAt(0).toUpperCase() + name.slice(1)

      return {
        type: 'prompt',
        prompt: `다음 템플릿을 기반으로 "use${hookName}" 커스텀 훅을 생성해줘:

**파일 위치**: \`hooks/use${hookName}.ts\`

**템플릿**:
\`\`\`typescript
import { useState, useEffect, useCallback } from 'react'

interface Use${hookName}Options {
  // TODO: Define options
}

interface Use${hookName}Return {
  data: unknown | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function use${hookName}(options: Use${hookName}Options = {}): Use${hookName}Return {
  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Implement fetch logic
      setData(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
\`\`\`

필요에 따라 옵션과 반환 타입을 확장해줘.`,
        immediate: true
      }
    }
  },

  store: {
    name: 'store',
    description: 'Zustand Store를 생성합니다',
    aliases: ['zustand'],
    args: '<name>',
    execute: (args) => {
      const name = args.trim()
      if (!name) {
        return {
          type: 'message',
          content: 'Store 이름을 입력해주세요. 예: `/store user` → `useUserStore`'
        }
      }

      const storeName = name.charAt(0).toUpperCase() + name.slice(1)
      const storeNameLower = name.toLowerCase()

      return {
        type: 'prompt',
        prompt: `다음 템플릿을 기반으로 "use${storeName}Store" Zustand 스토어를 생성해줘:

**파일 위치**: \`stores/${storeNameLower}Store.ts\`

**템플릿**:
\`\`\`typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ${storeName}State {
  // State
  items: string[]
  selectedId: string | null

  // Actions
  addItem: (item: string) => void
  removeItem: (item: string) => void
  setSelectedId: (id: string | null) => void
  reset: () => void
}

const initialState = {
  items: [],
  selectedId: null,
}

export const use${storeName}Store = create<${storeName}State>()(
  persist(
    (set) => ({
      ...initialState,

      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),

      removeItem: (item) => set((state) => ({
        items: state.items.filter((i) => i !== item)
      })),

      setSelectedId: (id) => set({ selectedId: id }),

      reset: () => set(initialState),
    }),
    {
      name: '${storeNameLower}-storage',
    }
  )
)
\`\`\`

필요에 따라 상태와 액션을 확장해줘.`,
        immediate: true
      }
    }
  },

  // ============ 스킬 관련 ============
  skill: {
    name: 'skill',
    description: '스킬 파일을 생성합니다 (.claude/skills/)',
    args: '<name>',
    execute: (args) => {
      const name = args.trim()
      if (!name) {
        return {
          type: 'message',
          content: `## 스킬 생성\n\n스킬 이름을 입력해주세요. 예: \`/skill code-review\`\n\n스킬은 \`.claude/skills/\` 폴더에 마크다운 파일로 저장됩니다.`
        }
      }

      const skillName = name.toLowerCase().replace(/\s+/g, '-')

      return {
        type: 'prompt',
        prompt: `".claude/skills/${skillName}.md" 스킬 파일을 생성해줘. 다음 형식을 따라:

\`\`\`markdown
# ${name}

## 목적
[이 스킬의 목적 설명]

## 사용 시점
- 사용 조건 1
- 사용 조건 2

## 지침
1. 첫 번째 지침
2. 두 번째 지침
3. 세 번째 지침

## 예시
\\\`\\\`\\\`typescript
// 코드 예시
\\\`\\\`\\\`
\`\`\`

.claude 폴더가 없으면 먼저 생성해줘.`,
        immediate: true
      }
    }
  },

  memory: {
    name: 'memory',
    description: '대화 메모리를 관리합니다',
    args: '<action>',
    execute: (args) => {
      const action = args.trim().toLowerCase()

      switch (action) {
        case 'list':
        case 'show':
          return {
            type: 'prompt',
            prompt: '.claude/memory.json 파일을 읽어서 저장된 메모리 목록을 보여줘. 각 메모리의 타입, 내용, 시간을 포맷팅해서 보여줘.',
            immediate: true
          }
        case 'clear':
          return {
            type: 'prompt',
            prompt: '.claude/memory.json 파일을 초기화해줘 (빈 배열로 만들어줘).',
            immediate: true
          }
        case 'add':
          return {
            type: 'message',
            content: '메모리에 추가할 내용을 입력해주세요. 예: `/memory add 사용자는 TypeScript를 선호함`'
          }
        default:
          if (action.startsWith('add ')) {
            const content = action.slice(4).trim()
            return {
              type: 'prompt',
              prompt: `.claude/memory.json에 다음 내용을 추가해줘 (type: "preference"): "${content}"`,
              immediate: true
            }
          }
          return {
            type: 'message',
            content: `## 메모리 관리\n\n- \`/memory list\` - 저장된 메모리 보기\n- \`/memory clear\` - 메모리 초기화\n- \`/memory add <내용>\` - 메모리 추가`
          }
      }
    }
  },

  // ============ 프로젝트 템플릿 ============
  scaffold: {
    name: 'scaffold',
    description: '프로젝트 구조를 스캐폴딩합니다',
    aliases: ['gen'],
    args: '<type>',
    execute: (args) => {
      const type = args.trim().toLowerCase()

      switch (type) {
        case 'feature':
          return {
            type: 'prompt',
            prompt: `다음 구조로 새 기능 폴더를 생성해줘:
- components/[feature]/
  - index.ts
  - [Feature].tsx
  - [Feature].test.tsx
- hooks/use[Feature].ts
- stores/[feature]Store.ts
- types/[feature].ts

기능 이름을 물어보고 생성해줘.`,
            immediate: true
          }
        case 'crud':
          return {
            type: 'prompt',
            prompt: `CRUD API 및 UI 구조를 생성해줘:
- app/api/[resource]/route.ts (GET all, POST)
- app/api/[resource]/[id]/route.ts (GET one, PUT, DELETE)
- components/[Resource]/List.tsx
- components/[Resource]/Form.tsx
- components/[Resource]/Item.tsx
- hooks/use[Resource].ts

리소스 이름을 물어보고 생성해줘.`,
            immediate: true
          }
        case 'page':
          return {
            type: 'prompt',
            prompt: `Next.js 페이지 구조를 생성해줘:
- app/[path]/page.tsx
- app/[path]/layout.tsx
- app/[path]/loading.tsx
- app/[path]/error.tsx

페이지 경로를 물어보고 생성해줘.`,
            immediate: true
          }
        default:
          return {
            type: 'message',
            content: `## 스캐폴딩 옵션\n\n- \`/scaffold feature\` - 기능 폴더 구조\n- \`/scaffold crud\` - CRUD API + UI\n- \`/scaffold page\` - Next.js 페이지 구조`
          }
      }
    }
  }
}

// 🔥 명령어 파싱 및 실행
export function parseSlashCommand(input: string): { command: string; args: string } | null {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/)
  if (!match) return null
  return {
    command: match[1].toLowerCase(),
    args: match[2]?.trim() || ''
  }
}

export function findCommand(name: string): SlashCommand | undefined {
  // 직접 매칭
  if (SLASH_COMMANDS[name]) return SLASH_COMMANDS[name]

  // alias로 찾기
  for (const cmd of Object.values(SLASH_COMMANDS)) {
    if (cmd.aliases?.includes(name)) return cmd
  }

  return undefined
}

export async function executeSlashCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult | null> {
  const parsed = parseSlashCommand(input)
  if (!parsed) return null

  const command = findCommand(parsed.command)
  if (!command) {
    return {
      type: 'message',
      content: `알 수 없는 명령어입니다: \`/${parsed.command}\`\n\n\`/help\`를 입력해서 사용 가능한 명령어를 확인하세요.`
    }
  }

  return command.execute(parsed.args, context)
}

// 자동완성을 위한 명령어 목록
export function getCommandSuggestions(partial: string): Array<{
  name: string
  description: string
  fullCommand: string
}> {
  const search = partial.toLowerCase().replace(/^\//, '')

  const suggestions: Array<{ name: string; description: string; fullCommand: string }> = []

  for (const cmd of Object.values(SLASH_COMMANDS)) {
    if (cmd.name.startsWith(search)) {
      suggestions.push({
        name: cmd.name,
        description: cmd.description,
        fullCommand: `/${cmd.name}${cmd.args ? ' ' + cmd.args : ''}`
      })
    }
    // alias도 검색
    for (const alias of cmd.aliases || []) {
      if (alias.startsWith(search) && !suggestions.find(s => s.name === cmd.name)) {
        suggestions.push({
          name: `${cmd.name} (/${alias})`,
          description: cmd.description,
          fullCommand: `/${alias}`
        })
      }
    }
  }

  return suggestions.slice(0, 8) // 최대 8개
}
