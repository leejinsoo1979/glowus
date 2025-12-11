# Agent Builder MCP Server

Claude Code에서 Agent Builder 캔버스를 제어할 수 있게 해주는 MCP (Model Context Protocol) 서버입니다.

## 설치 및 설정

### 1. 터미널 서버 실행

먼저 터미널 서버를 실행해야 합니다:

```bash
node server/terminal-server.js
```

### 2. Claude Code에 MCP 등록

Claude Code에 MCP 서버를 등록합니다:

```bash
claude mcp add agent-builder -- node /path/to/startupshow/server/mcp-server.js
```

또는 프로젝트 디렉토리에서:

```bash
claude mcp add agent-builder -- node server/mcp-server.js
```

### 3. Agent Builder 실행

Next.js 앱을 실행합니다:

```bash
npm run dev
```

브라우저에서 Agent Builder 페이지로 이동하면 "MCP Connected" 표시가 나타납니다.

## 사용 방법

Claude Code 터미널에서 자연어로 명령하면 됩니다:

```
> LLM 노드 하나 만들어줘
> 입력 노드랑 LLM 노드 연결해
> 현재 캔버스 상태 보여줘
> 기본 챗봇 템플릿 로드해
```

## 사용 가능한 도구 (Tools)

| 도구 | 설명 |
|------|------|
| `get_canvas_state` | 현재 캔버스 상태(노드, 엣지) 조회 |
| `create_node` | 새 노드 생성 |
| `update_node` | 기존 노드 수정 |
| `delete_node` | 노드 삭제 |
| `connect_nodes` | 두 노드 연결 |
| `disconnect_nodes` | 연결 해제 |
| `clear_canvas` | 캔버스 초기화 |
| `load_template` | 템플릿 로드 |
| `validate_agent` | 에이전트 유효성 검증 |
| `export_agent` | JSON으로 내보내기 |

## 노드 타입

- `start` - 시작 노드
- `prompt` - 프롬프트 입력
- `llm` - 텍스트 모델 (GPT, Claude 등)
- `image_generation` - 이미지 생성
- `tool` - HTTP 요청
- `router` - 조건 분기
- `javascript` - JavaScript 코드 실행
- `embedding` - 임베딩 모델
- `custom_tool` - 커스텀 도구
- `end` - 종료 노드
- `memory` - 메모리
- `rag` - RAG 검색
- `input` - 입력
- `output` - 출력

## 템플릿

- `chatbot-basic` - 기본 챗봇
- `rag-assistant` - RAG 어시스턴트
- `tool-agent` - 도구 활용 에이전트
- `multi-agent` - 멀티 에이전트 시스템

## 아키텍처

```
Claude Code → MCP Server → WebSocket → Terminal Server → Agent Builder (Frontend)
                                                              ↓
                                                       React Flow Canvas
```

## 문제 해결

### MCP 연결 안됨

1. 터미널 서버가 실행 중인지 확인: `node server/terminal-server.js`
2. Agent Builder 페이지가 열려 있는지 확인
3. MCP 서버 재시작: Claude Code에서 `/mcp` 명령으로 확인

### 노드가 생성되지 않음

1. 브라우저 콘솔에서 에러 확인
2. 터미널 서버 로그 확인
3. WebSocket 연결 상태 확인

## 개발

MCP 서버 수정 후 Claude Code에서 재등록:

```bash
claude mcp remove agent-builder
claude mcp add agent-builder -- node server/mcp-server.js
```
