# Agent System Access Documentation

완전한 시스템 접근 제어를 위한 GlowUS 에이전트 시스템 문서입니다.

## 개요

GlowUS 에이전트는 이제 다음 기능에 접근할 수 있습니다:
- **파일 시스템**: 지정된 폴더 내 파일 읽기/쓰기
- **애플리케이션 제어**: PC 프로그램 실행 및 제어
- **브라우저 자동화**: 웹 브라우저 완전 제어 (Stagehand 기반)
- **네트워크**: 웹 검색, API 호출

모든 접근은 역할 기반 권한 시스템으로 보호됩니다.

## 아키텍처

```
┌─────────────────────────────────────────────┐
│         Claude Code API                      │
│     /api/claude-code/system                  │
└──────────────┬──────────────────────────────┘
               │
               ├── 🔒 Permissions System
               │   └── lib/agent/permissions.ts
               │
               ├── 📁 File System Tools
               │   └── lib/agent/filesystem-tools.ts
               │
               ├── 🚀 App Control Tools
               │   └── lib/agent/app-control-tools.ts
               │
               └── 🌐 Browser Control Tools
                   └── lib/agent/browser-control-tools.ts
                       └── Stagehand (Playwright)
```

## 1. 권한 시스템

### 역할 정의

**jeremy** (개발자)
- 전체 Documents, Desktop, Downloads, Projects 접근
- 모든 개발 도구 (VSCode, Chrome, Notion, Slack)
- 모든 브라우저 제어
- npm, git, node, tsc 등 개발 명령어

**rachel** (연구원)
- Documents/Research, Downloads 접근
- Notion, Chrome, Python, Jupyter
- Chrome 브라우저 제어만
- curl, wget, python, pip 등 연구 명령어

**amy** (제한된 사용자)
- Documents 접근만
- Notion만
- 브라우저 제어 불가
- 읽기 전용 명령어만 (cat, ls, pwd)

**antigravity** (빌드/배포)
- Projects 폴더만
- npm, git, docker
- 브라우저 제어 불가
- 빌드 관련 명령어만

### 권한 설정 파일 위치

```
~/.glowus/agent-permissions.json
```

### 권한 구조

```typescript
interface AgentPermissions {
  // 파일 시스템
  allowedDirectories: string[]      // 접근 가능한 폴더
  deniedDirectories: string[]       // 명시적 차단 폴더

  // 애플리케이션
  allowedApplications: string[]     // 실행 가능한 앱

  // 브라우저
  allowBrowserControl: boolean      // 브라우저 제어 허용 여부
  allowedBrowsers: Browser[]        // 허용된 브라우저 목록

  // 명령어
  allowedCommands: string[]         // 실행 가능한 명령어
  deniedCommands: string[]          // 차단된 명령어

  // 네트워크
  allowNetworkAccess: boolean       // 네트워크 접근 허용
  allowedDomains?: string[]         // 허용된 도메인 (선택)
}
```

## 2. 파일 시스템 접근

### 사용 가능한 도구

#### `read_file`
파일 내용 읽기
```json
{
  "tool": "read_file",
  "args": {
    "path": "/Users/username/Documents/note.txt"
  }
}
```

#### `write_file`
파일 작성/수정
```json
{
  "tool": "write_file",
  "args": {
    "path": "/Users/username/Documents/report.md",
    "content": "# Report\n\nContent here..."
  }
}
```

#### `list_directory`
폴더 내용 보기
```json
{
  "tool": "list_directory",
  "args": {
    "path": "/Users/username/Documents"
  }
}
```

#### `search_files`
파일 검색
```json
{
  "tool": "search_files",
  "args": {
    "directory": "/Users/username/Documents",
    "pattern": ".*\\.pdf$"
  }
}
```

### 예제: 파일 시스템 작업

```typescript
const response = await fetch('/api/claude-code/system', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'Documents 폴더에 있는 모든 PDF 파일 목록을 만들어줘',
    agentRole: 'jeremy',
    tools: ['list_directory', 'search_files', 'write_file']
  })
})
```

## 3. 애플리케이션 제어

### 사용 가능한 도구

#### `launch_app`
애플리케이션 실행
```json
{
  "tool": "launch_app",
  "args": {
    "app": "/Applications/Visual Studio Code.app",
    "args": ["."]
  }
}
```

#### `list_installed_apps`
설치된 앱 목록
```json
{
  "tool": "list_installed_apps",
  "args": {}
}
```

#### `open_url`
기본 브라우저에서 URL 열기
```json
{
  "tool": "open_url",
  "args": {
    "url": "https://github.com"
  }
}
```

### 예제: VSCode에서 프로젝트 열기

```typescript
const response = await fetch('/api/claude-code/system', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'VSCode로 현재 프로젝트 열어줘',
    agentRole: 'jeremy',
    tools: ['launch_app']
  })
})
```

## 4. 브라우저 자동화

### 사용 가능한 도구

#### `start_browser`
브라우저 세션 시작
```json
{
  "tool": "start_browser",
  "args": {
    "browser": "chrome",
    "url": "https://google.com",
    "headless": false
  }
}
```

#### `browser_navigate`
페이지 이동
```json
{
  "tool": "browser_navigate",
  "args": {
    "sessionId": "chrome-1234567890",
    "url": "https://github.com"
  }
}
```

#### `browser_click`
요소 클릭 (AI 기반)
```json
{
  "tool": "browser_click",
  "args": {
    "sessionId": "chrome-1234567890",
    "description": "로그인 버튼"
  }
}
```

#### `browser_type`
텍스트 입력
```json
{
  "tool": "browser_type",
  "args": {
    "sessionId": "chrome-1234567890",
    "description": "검색창",
    "text": "Claude AI"
  }
}
```

#### `browser_extract`
정보 추출
```json
{
  "tool": "browser_extract",
  "args": {
    "sessionId": "chrome-1234567890",
    "description": "페이지의 모든 링크"
  }
}
```

#### `browser_screenshot`
스크린샷 촬영
```json
{
  "tool": "browser_screenshot",
  "args": {
    "sessionId": "chrome-1234567890"
  }
}
```

#### `close_browser`
브라우저 종료
```json
{
  "tool": "close_browser",
  "args": {
    "sessionId": "chrome-1234567890"
  }
}
```

### 예제: 웹 스크래핑

```typescript
const response = await fetch('/api/claude-code/system', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'GitHub trending 페이지에서 인기 있는 저장소 10개 가져와줘',
    agentRole: 'jeremy',
    tools: [
      'start_browser',
      'browser_navigate',
      'browser_extract',
      'close_browser'
    ]
  })
})
```

## 5. 권한 관리 UI

### 설정 페이지

```
/dashboard-group/settings/agent-permissions
```

### 기능

1. **역할 선택**: jeremy, rachel, amy, antigravity
2. **폴더 추가/제거**: 접근 가능한 디렉토리 관리
3. **앱 추가/제거**: 실행 가능한 애플리케이션 관리
4. **브라우저 제어**: 브라우저 자동화 허용 여부
5. **명령어 확인**: 허용된 터미널 명령어 보기

### 사용법

1. 대시보드 → 설정 → Agent Permissions
2. 역할 선택 (jeremy, rachel, amy, antigravity)
3. 폴더 또는 앱 경로 입력
4. "Add Directory" 또는 "Add Application" 클릭
5. 변경사항은 즉시 저장됨

## 6. API 엔드포인트

### System Access API

```
POST /api/claude-code/system
```

**Request:**
```json
{
  "task": "작업 설명",
  "agentRole": "jeremy",
  "model": "gpt-4o-mini",
  "tools": ["read_file", "write_file", "start_browser"],
  "maxIterations": 10
}
```

**Response:**
```json
{
  "success": true,
  "output": "작업 결과...",
  "toolsUsed": ["read_file", "browser_navigate"],
  "iterations": 3
}
```

### Permissions API

```
GET /api/agent-permissions?role=jeremy
POST /api/agent-permissions
PUT /api/agent-permissions
DELETE /api/agent-permissions
```

## 7. 보안 고려사항

### 권한 검사
모든 파일, 앱, 명령어 실행 전에 권한 검사:
```typescript
if (!isPathAllowed(path, role)) {
  throw new Error('Permission denied')
}
```

### 차단된 디렉토리
다음 폴더는 항상 차단됨:
- `~/.ssh` - SSH 키
- `~/.aws` - AWS 자격증명
- `/System` - 시스템 파일
- `/Library` - 시스템 라이브러리

### 위험 명령어 차단
다음 명령어는 실행 불가:
- `sudo`, `su` - 권한 상승
- `rm -rf /` - 시스템 삭제
- `chmod 777` - 권한 변경
- `dd`, `mkfs` - 디스크 포맷
- `shutdown`, `reboot` - 시스템 재시작

## 8. 실제 사용 예제

### 예제 1: 문서 작업 자동화

```typescript
const { execute } = useClaudeCode({
  agentRole: 'jeremy'
})

await execute(`
  Documents 폴더의 모든 PDF 파일을 분석하고
  각 파일의 제목과 요약을 담은
  index.md 파일을 만들어줘
`)
```

### 예제 2: 웹 리서치 + 문서 작성

```typescript
await execute(`
  1. Chrome으로 "AI trends 2024" 검색
  2. 상위 5개 기사 내용 추출
  3. 요약 보고서를 Documents/research.md에 작성
`)
```

### 예제 3: 앱 실행 + 파일 열기

```typescript
await execute(`
  1. VSCode 실행
  2. ~/Projects/my-app 폴더 열기
  3. README.md 파일 내용 읽어서 요약해줘
`)
```

## 9. 문제 해결

### 권한 오류

```
Error: Permission denied: jeremy cannot access /Users/...
```

**해결방법:**
1. 설정 → Agent Permissions에서 해당 폴더 추가
2. 또는 `~/.glowus/agent-permissions.json` 직접 수정

### 브라우저 연결 실패

```
Error: Failed to start browser session
```

**해결방법:**
1. Stagehand 서버 실행 확인: `npm run mcp:stagehand`
2. 브라우저 제어 권한 확인
3. `.env`에 필요한 환경 변수 설정

### 앱 실행 실패

```
Error: Permission denied: jeremy cannot launch /Applications/...
```

**해결방법:**
1. 설정에서 해당 앱 추가
2. 앱 경로가 정확한지 확인 (전체 경로 사용)

## 10. 개발 가이드

### 새로운 도구 추가

1. `lib/agent/permissions.ts`에 권한 체크 함수 추가
2. 도구 구현 파일 생성 (예: `lib/agent/my-tool.ts`)
3. `app/api/claude-code/system/route.ts`에 도구 정의 추가
4. `executeTool` 함수에 케이스 추가

### 권한 커스터마이징

직접 `~/.glowus/agent-permissions.json` 수정:

```json
{
  "version": "1.0.0",
  "roles": {
    "jeremy": {
      "allowedDirectories": [
        "/Users/username/MyCustomFolder"
      ],
      "allowedApplications": [
        "/Applications/MyApp.app"
      ]
    }
  }
}
```

## 요약

- ✅ **파일 시스템**: 지정 폴더 읽기/쓰기
- ✅ **앱 제어**: PC 프로그램 실행 및 제어
- ✅ **브라우저**: 완전한 웹 자동화 (Stagehand)
- ✅ **보안**: 역할 기반 권한 시스템
- ✅ **UI**: 쉬운 권한 관리 대시보드

모든 기능은 `/api/claude-code/system` 엔드포인트를 통해 사용할 수 있습니다.
