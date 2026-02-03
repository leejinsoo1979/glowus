# Claude Code Bridge

Monaco Editor 기반 웹 에디터에서 Claude Code CLI를 사용하기 위한 브릿지 서버.

Max 플랜 사용자는 API 비용 없이 CLI를 통해 Claude를 사용할 수 있습니다.

## 구조

```
웹 브라우저 → localhost:3333 (브릿지 서버) → Claude Code CLI (Max 플랜)
```

## 설치

```bash
# 의존성 설치
npm install

# 서버 실행
npm start
```

## 파일 구조

```
claude-bridge/
├── bridge-server.js      # 브릿지 서버 (로컬에서 실행)
├── claude-web-client.js  # 웹 클라이언트 (브라우저에서 import)
├── monaco-claude-plugin.js  # Monaco Editor 플러그인
├── example.html          # 사용 예시
└── package.json
```

## 사용법

### 1. 브릿지 서버 실행 (터미널에서)

```bash
npm start
```

서버가 http://localhost:3333 에서 실행됩니다.

### 2. 웹에서 사용

```html
<script src="claude-web-client.js"></script>
<script src="monaco-claude-plugin.js"></script>

<script>
  // 클라이언트 생성
  const claude = new ClaudeClient({
    bridgeUrl: 'http://localhost:3333'
  });

  // 일반 질문
  await claude.ask('Node.js 설치 방법 알려줘', {
    onChunk: (text) => console.log(text)
  });

  // 코드와 함께 질문
  await claude.askWithCode('이 코드 설명해줘', code, {
    language: 'javascript',
    onChunk: (text) => console.log(text)
  });

  // 프리셋 기능
  await claude.explain(code, 'javascript');
  await claude.refactor(code, 'javascript');
  await claude.findBugs(code, 'javascript');
</script>
```

### 3. Monaco Editor 연동

```javascript
const plugin = new MonacoClaudePlugin(editor, {
  monaco: monaco,
  claudeClient: claude,
  onOutput: (text, isStreaming) => {
    // 응답 처리
  }
});
```

#### 우클릭 메뉴
- Claude에게 물어보기
- 코드 설명
- 리팩토링 제안
- 버그 찾기
- 주석 추가
- 테스트 작성

#### 단축키
- `Cmd+Shift+C`: 선택한 코드로 질문
- `Cmd+Shift+E`: 코드 설명
- `Cmd+Shift+R`: 리팩토링

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | /health | 서버 상태 확인 |
| GET | /version | Claude Code 버전 |
| POST | /claude | 스트리밍 응답 |
| POST | /claude/code | 코드와 함께 스트리밍 |
| POST | /claude/sync | 동기 응답 |

### POST /claude

```json
{
  "prompt": "질문 내용",
  "cwd": "/작업/디렉토리",
  "model": "claude-opus-4-5-20251101"
}
```

### POST /claude/code

```json
{
  "prompt": "이 코드 설명해줘",
  "code": "function hello() { ... }",
  "language": "javascript",
  "filename": "hello.js",
  "cwd": "/작업/디렉토리"
}
```

## 기존 프로젝트에 통합

### 1. 파일 복사

`claude-web-client.js`와 `monaco-claude-plugin.js`를 프로젝트에 복사.

### 2. HTML에서 로드

```html
<script src="path/to/claude-web-client.js"></script>
<script src="path/to/monaco-claude-plugin.js"></script>
```

### 3. Monaco Editor에 연결

```javascript
// Monaco 에디터 인스턴스가 있다고 가정
const claude = new ClaudeClient();
const plugin = new MonacoClaudePlugin(editor, {
  monaco: monaco,
  claudeClient: claude,
  onOutput: (text) => {
    // 결과를 표시할 DOM 업데이트
    document.getElementById('output').innerHTML = text;
  }
});
```

## Electron 버전

Electron에서는 브릿지 서버 없이 직접 CLI 호출 가능:

```javascript
const { spawn } = require('child_process');

function runClaude(prompt) {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['-p', prompt, '--output-format', 'json'], {
      shell: true
    });
    
    let output = '';
    claude.stdout.on('data', (data) => output += data);
    claude.on('close', () => resolve(output));
  });
}
```

## 주의사항

- 브릿지 서버는 로컬에서만 실행하세요 (보안)
- Claude Code가 로그인되어 있어야 합니다
- Max 플랜 로그인: `claude login --method web`
