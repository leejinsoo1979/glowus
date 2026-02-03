# Claude Code CLI Bridge

웹 브라우저에서 로컬 Claude Code CLI를 사용하기 위한 브릿지 시스템.
Max 플랜 사용 시 API 비용 없이 CLI를 통해 Claude를 호출할 수 있습니다.

## 아키텍처

```
웹 브라우저 → localhost:3333 (브릿지 서버) → Claude Code CLI (Max 플랜)
```

## 설치

### 1. 의존성 설치

```bash
npm install express cors
```

### 2. package.json에 스크립트 추가

```json
{
  "scripts": {
    "claude-bridge": "node server/claude-bridge-server.js"
  }
}
```

## 사용법

### 1. 브릿지 서버 시작

```bash
# 기본 포트 (3333)
npm run claude-bridge

# 커스텀 포트
CLAUDE_BRIDGE_PORT=4000 npm run claude-bridge

# 작업 디렉토리 지정
CLAUDE_BRIDGE_CWD=/path/to/project npm run claude-bridge
```

### 2. 웹 클라이언트 사용

#### 기본 사용

```typescript
import { ClaudeWebClient, askClaude } from '@/lib/claude-bridge'

// 싱글톤 클라이언트 사용
const response = await askClaude('React의 useEffect 훅에 대해 설명해줘')
console.log(response)

// 또는 인스턴스 생성
const claude = new ClaudeWebClient('http://localhost:3333')
const response = await claude.ask('TypeScript 제네릭에 대해 알려줘')
```

#### 코드와 함께 질문

```typescript
import { askClaudeWithCode } from '@/lib/claude-bridge'

const code = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`

const response = await askClaudeWithCode(
  '이 코드의 시간 복잡도를 분석하고 최적화해줘',
  code,
  'javascript'
)
```

#### 스트리밍 응답

```typescript
import { ClaudeWebClient } from '@/lib/claude-bridge'

const claude = new ClaudeWebClient()

await claude.stream('긴 에세이를 작성해줘', (chunk) => {
  if (chunk.type === 'text') {
    // 실시간으로 응답 표시
    console.log(chunk.delta)
  } else if (chunk.type === 'done') {
    // 완료
    console.log('Final:', chunk.content)
  } else if (chunk.type === 'error') {
    console.error('Error:', chunk.message)
  }
})
```

#### 대화 세션 유지

```typescript
const sessionId = 'my-session-123'

// 첫 번째 메시지
await claude.conversation(sessionId, '안녕, 나는 리액트 개발자야', (chunk) => {
  console.log(chunk.delta)
})

// 두 번째 메시지 (컨텍스트 유지됨)
await claude.conversation(sessionId, '내가 뭐라고 했지?', (chunk) => {
  console.log(chunk.delta)
})

// 세션 삭제
await claude.deleteSession(sessionId)
```

### 3. Monaco Editor 연동

```typescript
import * as monaco from 'monaco-editor'
import { initMonacoClaudePlugin, injectClaudeStyles } from '@/lib/claude-bridge'

// CSS 스타일 주입 (한 번만)
injectClaudeStyles()

// 에디터 생성
const editor = monaco.editor.create(document.getElementById('editor'), {
  value: 'function hello() { console.log("Hello") }',
  language: 'javascript',
})

// Claude 플러그인 초기화
const plugin = initMonacoClaudePlugin(editor, {
  bridgeUrl: 'http://localhost:3333',

  onStart: (type) => {
    console.log(`Started: ${type}`)
    showLoadingSpinner()
  },

  onStreaming: (chunk) => {
    if (chunk.type === 'text') {
      updateResponsePanel(chunk.content)
    }
  },

  onResponse: (response, type) => {
    console.log(`Response for ${type}:`, response)
    hideLoadingSpinner()
    showResponseInPanel(response)
  },

  onError: (error) => {
    console.error('Error:', error)
    showErrorToast(error.message)
  },
})
```

#### 등록된 단축키

| 단축키 | 액션 |
|--------|------|
| `Cmd/Ctrl + Shift + C` | 선택한 코드에 대해 질문 |
| `Cmd/Ctrl + Shift + R` | 리팩토링 제안 |
| `Cmd/Ctrl + Shift + B` | 버그 찾기 |
| `Cmd/Ctrl + Shift + K` | 커스텀 프롬프트 |

#### 컨텍스트 메뉴 액션

코드 선택 후 우클릭:
- Claude: 선택한 코드에 대해 질문하기
- Claude: 코드 설명
- Claude: 리팩토링 제안
- Claude: 버그 찾기
- Claude: 성능 최적화
- Claude: 주석 추가
- Claude: 테스트 코드 작성

#### 응답 삽입

```typescript
// 커서 위치에 코드 삽입
plugin.insertCode(generatedCode, 'cursor')

// 선택 영역 교체
plugin.insertCode(refactoredCode, 'replace')

// 파일 끝에 추가
plugin.insertCode(testCode, 'end')
```

### 4. 연결 상태 확인

```typescript
import { checkClaudeConnection } from '@/lib/claude-bridge'

const isConnected = await checkClaudeConnection()
if (!isConnected) {
  alert('브릿지 서버가 실행 중이 아닙니다. npm run claude-bridge를 실행해주세요.')
}
```

## API 엔드포인트

### GET /health
서버 상태 확인

```bash
curl http://localhost:3333/health
```

### GET /check-cli
Claude Code CLI 설치 확인

```bash
curl http://localhost:3333/check-cli
```

### POST /claude
프롬프트 전송 (SSE 스트리밍)

```bash
curl -X POST http://localhost:3333/claude \
  -H "Content-Type: application/json" \
  -d '{"prompt": "안녕하세요"}'
```

### POST /claude/with-file
파일 내용과 함께 질문

```bash
curl -X POST http://localhost:3333/claude/with-file \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "이 코드를 설명해줘",
    "code": "function add(a, b) { return a + b }",
    "language": "javascript",
    "filename": "math.js"
  }'
```

### POST /claude/edit
파일 편집 요청

```bash
curl -X POST http://localhost:3333/claude/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "함수에 타입을 추가해줘",
    "filepath": "src/utils.ts",
    "cwd": "/path/to/project"
  }'
```

### POST /claude/conversation
대화 세션

```bash
curl -X POST http://localhost:3333/claude/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-123",
    "prompt": "안녕!"
  }'
```

## 옵션

### ClaudeBridgeOptions

```typescript
interface ClaudeBridgeOptions {
  model?: string           // Claude 모델 지정
  maxTokens?: number       // 최대 토큰 수
  allowedTools?: string[]  // 허용할 도구 목록
  disallowedTools?: string[] // 비허용 도구 목록
}
```

### MonacoClaudePluginOptions

```typescript
interface MonacoClaudePluginOptions {
  bridgeUrl?: string       // 브릿지 서버 URL
  onResponse?: (response: string, type: ClaudeActionType) => void
  onStreaming?: (chunk: StreamChunk) => void
  onError?: (error: Error) => void
  onStart?: (type: ClaudeActionType) => void
  onEnd?: (type: ClaudeActionType) => void
  showInlineResponse?: boolean  // 인라인 응답 표시
}
```

## React 컴포넌트 예시

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ClaudeWebClient, checkClaudeConnection } from '@/lib/claude-bridge'

export function ClaudeChatPanel() {
  const [client] = useState(() => new ClaudeWebClient())
  const [connected, setConnected] = useState(false)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkClaudeConnection().then(setConnected)
  }, [])

  const handleAsk = async (prompt: string) => {
    setLoading(true)
    setResponse('')

    await client.stream(prompt, (chunk) => {
      if (chunk.type === 'text') {
        setResponse(chunk.content || '')
      }
    })

    setLoading(false)
  }

  if (!connected) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-800 rounded">
        브릿지 서버가 실행되고 있지 않습니다.
        <br />
        <code>npm run claude-bridge</code> 를 실행해주세요.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-auto">
        <pre className="whitespace-pre-wrap">{response}</pre>
      </div>
      <input
        type="text"
        placeholder="질문을 입력하세요..."
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleAsk(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
        className="p-2 border-t"
      />
    </div>
  )
}
```

## 트러블슈팅

### "Claude Code CLI not found" 에러

Claude Code CLI가 설치되어 있지 않습니다.

```bash
# Claude Code CLI 설치 확인
claude --version

# 설치가 안 되어 있다면
npm install -g @anthropic-ai/claude-code
```

### CORS 에러

브릿지 서버가 CORS를 허용하지만, 브라우저 보안 정책으로 인해 문제가 발생할 수 있습니다.
`http://localhost` 또는 `http://127.0.0.1`에서 접근하세요.

### 연결 실패

1. 브릿지 서버가 실행 중인지 확인
2. 포트가 이미 사용 중인지 확인: `lsof -i :3333`
3. 방화벽 설정 확인

## 파일 구조

```
server/
  claude-bridge-server.js   # 로컬 브릿지 서버

lib/claude-bridge/
  index.ts                  # 메인 exports
  claude-web-client.ts      # 웹 클라이언트
  monaco-claude-plugin.ts   # Monaco Editor 플러그인
  README.md                 # 이 문서
```
