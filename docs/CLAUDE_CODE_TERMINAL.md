# Claude Code Terminal Integration

> 에이전트가 Claude Code 터미널을 사용하여 실제 개발 작업을 수행하는 방법

## Quick Start

```bash
# 터미널 서버 실행
node server/terminal-server.js

# 또는 개발 모드로 전체 실행
npm run electron:dev
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GlowUS Agent                           │
│  (Amy, Jeremy, Rachel, etc.)                                │
└─────────────────┬───────────────────────────────────────────┘
                  │ Tool Call
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Terminal Tools (lib/agent/terminal-tool.ts)     │
│  • createRunTerminalTool() - 명령어 실행                     │
│  • createGitTool() - Git 작업                               │
│  • createNpmTool() - NPM 작업                               │
│  • createDiagnosticsTool() - 빌드/린트/테스트               │
└─────────────────┬───────────────────────────────────────────┘
                  │ child_process / WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           Terminal Server (server/terminal-server.js)        │
│  • node-pty for real shell (zsh/bash)                       │
│  • WebSocket on ws://localhost:3001                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

### 1. 에이전트에서 터미널 도구 사용

```typescript
import { getToolsForAgent } from '@/lib/agent/tools'

// Jeremy 에이전트용 도구 가져오기
const tools = getToolsForAgent('jeremy')

// 사용 가능한 도구:
// - run_terminal: 쉘 명령어 실행
// - git_operation: Git 작업
// - npm_operation: NPM 작업
// - run_diagnostics: 빌드/린트/테스트
// - use_claude_code: Claude Code 브라우저 자동화
```

### 2. 개별 도구 사용

```typescript
import {
  createRunTerminalTool,
  createGitTool,
  createNpmTool
} from '@/lib/agent/terminal-tool'

// 터미널 도구 생성 (역할 기반 권한)
const terminalTool = createRunTerminalTool('jeremy')
const gitTool = createGitTool('jeremy')
const npmTool = createNpmTool('jeremy')
```

### 3. 직접 API 호출

```typescript
import { repoRun, repoDiagnostics } from '@/lib/neural-map/tools/terminal-tools'

// 명령어 실행
const result = await repoRun({
  command: 'npm install lodash',
  cwd: '/path/to/project',
  timeout: 60000
})

// 진단 실행
const diagnostics = await repoDiagnostics({
  source: 'all', // 'build' | 'lint' | 'test' | 'typescript'
  cwd: '/path/to/project'
})
```

---

## Agent Permissions

| Agent | Role | 허용 명령어 | 제한 |
|-------|------|-------------|------|
| **Jeremy** | Engineer | `npm`, `npx`, `node`, `git`, `tsc`, `eslint`, `prettier` | 시스템 명령 금지 |
| **Rachel** | Analyst | `curl`, `jq`, `python`, `grep`, `cat` | 파일 수정 금지 |
| **Amy** | Chief | 없음 | Jeremy에게 위임 |
| **Antigravity** | Admin | `npm`, `git`, `docker` | 제한적 시스템 접근 |

---

## Security

### Blocked Patterns (모든 에이전트)

```typescript
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,     // rm -rf / or ~
  /sudo/,                  // sudo commands
  /chmod\s+777/,           // chmod 777
  /curl.*\|\s*(ba)?sh/,   // curl | sh
  /\.env/i,               // .env files
  /password|secret|token/ // sensitive keywords
]
```

### Safety Measures

1. **Command Whitelist** - 역할별 허용 명령어만 실행
2. **Output Sanitization** - API 키, 비밀번호 등 민감정보 필터링
3. **Timeout** - 기본 60초, 최대 5분
4. **Audit Logging** - 모든 명령어 기록

---

## Tool Reference

### `run_terminal`

쉘 명령어 직접 실행

```typescript
{
  command: string,    // 실행할 명령어
  cwd?: string,       // 작업 디렉토리
  timeout?: number    // 타임아웃 (ms)
}
```

### `git_operation`

Git 작업 래퍼

```typescript
{
  operation: 'status' | 'diff' | 'log' | 'branch' | 'add' | 'commit' | 'pull' | 'push',
  args?: string,      // 추가 인수
  cwd?: string
}
```

### `npm_operation`

NPM 작업 래퍼

```typescript
{
  operation: 'install' | 'uninstall' | 'run' | 'list' | 'outdated' | 'audit',
  packages?: string,  // install/uninstall 용
  script?: string,    // run 용
  cwd?: string
}
```

### `run_diagnostics`

프로젝트 진단

```typescript
{
  source: 'build' | 'lint' | 'test' | 'typescript' | 'all',
  cwd?: string
}
```

---

## Example: Feature Development Flow

```json
{
  "from": "Jeremy",
  "to": "Terminal",
  "intent": "EXECUTE",
  "payload": {
    "commands": [
      "git checkout -b feature/new-button",
      "npm install react-icons",
      "npm run typecheck",
      "npm run lint --fix",
      "git add .",
      "git commit -m 'feat: add new button component'"
    ],
    "cwd": "/Users/jinsoo/Projects/GlowUS",
    "on_error": "STOP_AND_REPORT"
  }
}
```

---

## App Integration

### Claude Code API for Apps

Apps에서 Claude Code 에이전트를 사용할 수 있는 통합 API.

```typescript
// POST /api/claude-code
{
  task: string,           // 수행할 작업
  context?: string,       // 추가 컨텍스트
  agentRole?: 'jeremy' | 'rachel' | 'amy' | 'antigravity',
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'gemini-1.5-pro',
  tools?: ['web_search', 'youtube_transcript', 'web_fetch', 'image_search'],
  systemPrompt?: string,
  maxIterations?: number
}
```

### Terminal API for Apps

앱에서 터미널 명령을 실행할 수 있는 API.

```typescript
// POST /api/claude-code/terminal
{
  command: string,        // 실행할 명령어
  agentRole?: 'jeremy',   // 역할 (권한 결정)
  cwd?: string,           // 작업 디렉토리
  timeout?: number        // 타임아웃
}

// Diagnostics
{
  source: 'build' | 'lint' | 'test' | 'typescript' | 'all',
  cwd?: string
}
```

### React Hooks

```typescript
import { useClaudeCode, useTerminal } from '@/hooks'

// Claude Code Agent Hook
const {
  execute,           // 작업 실행
  executeDocument,   // 문서 생성
  executeCode,       // 코드 생성
  executeSearch,     // 웹 검색
  executeYouTube,    // YouTube 분석
  isLoading,
  result
} = useClaudeCode({
  model: 'gpt-4o-mini',
  tools: ['web_search']
})

// Terminal Hook
const {
  run,               // 명령어 실행
  npm,               // NPM 명령 (npm install xxx)
  git,               // Git 명령 (git status)
  runDiagnostics,    // 진단 실행
  isRunning,
  result
} = useTerminal({ agentRole: 'jeremy' })
```

### Pre-configured Hooks

```typescript
// 문서 작성 전용
import { useDocumentAgent } from '@/hooks'

// 연구/검색 전용
import { useResearchAgent } from '@/hooks'

// 코딩 전용
import { useCodingAgent } from '@/hooks'

// 개발자 터미널
import { useDeveloperTerminal } from '@/hooks'
```

---

## Files

| 파일 | 설명 |
|------|------|
| [lib/agent/terminal-tool.ts](../lib/agent/terminal-tool.ts) | 에이전트용 터미널 도구 |
| [lib/agent/tools.ts](../lib/agent/tools.ts) | 도구 통합 및 export |
| [lib/neural-map/tools/terminal-tools.ts](../lib/neural-map/tools/terminal-tools.ts) | 저수준 터미널 API |
| [app/api/claude-code/route.ts](../app/api/claude-code/route.ts) | Claude Code API |
| [app/api/claude-code/terminal/route.ts](../app/api/claude-code/terminal/route.ts) | Terminal API |
| [hooks/useClaudeCode.ts](../hooks/useClaudeCode.ts) | Claude Code Hook |
| [hooks/useTerminal.ts](../hooks/useTerminal.ts) | Terminal Hook |
| [server/terminal-server.js](../server/terminal-server.js) | WebSocket 터미널 서버 |
| [AGENTS.md](../AGENTS.md) | 에이전트 행동 강령 |
