# OpenClaw Telegram 호환 레이어 설계

> **"기존 OpenClaw 명령어 그대로 + GlowUS 팀 파워"**

**Version**: 1.0
**Date**: 2026-02-01
**Status**: Design

---

## Executive Summary

### 현재 상황

**OpenClaw Telegram 명령어:**
```
/status     - 봇 상태 확인
/reset      - 대화 초기화
/model      - 모델 선택/확인
/whoami     - 사용자 ID 표시
/activation - 그룹 응답 설정 (always/mention)
/config     - 설정 관리
+ 자연어 대화
```

**GlowUS Telegram 명령어 (기존 구현):**
```
/start, /list, /agents  - 에이전트 목록
/agent <name> <msg>     - 특정 에이전트에게 명령
@<name> <msg>           - 멘션으로 에이전트 호출
/reset, /clear          - 대화 초기화
/link <email>           - GlowUS 계정 연결
/status, /me            - 계정 상태 확인
+ 자연어 대화 (기본 에이전트)
```

### 목표

1. **OpenClaw 명령어 100% 호환** - 기존 사용자 그대로 마이그레이션
2. **GlowUS 확장 명령어 추가** - 팀, 워크플로우, 대시보드
3. **점진적 확장 경험** - 단일 에이전트 → 팀 → 조직

---

## Command Architecture

### Layer 1: OpenClaw 호환 명령어

#### 기본 명령어 (1:1 매핑)

| OpenClaw | GlowUS | 동작 |
|----------|--------|------|
| `/status` | `/status` | ✅ 이미 구현 |
| `/reset` | `/reset` | ✅ 이미 구현 |
| `/model` | `/model` | 🆕 모델 선택/확인 |
| `/whoami` | `/me` | ✅ 이미 구현 |
| `/activation` | `/activation` | 🆕 그룹 응답 설정 |
| `/config` | `/config` | 🆕 설정 관리 |
| 자연어 | 자연어 | ✅ 기본 에이전트로 라우팅 |

#### 구현 필요 명령어

```typescript
// /model - 모델 선택/확인
// OpenClaw: 단일 모델
// GlowUS: 에이전트별 모델 (더 강력)

interface ModelCommand {
  // 현재 모델 확인
  '/model': () => `현재 모델: ${agent.llm_provider}/${agent.llm_model}`

  // 모델 변경 (에이전트 기반이므로 에이전트 전환으로 대체)
  '/model list': () => 에이전트별 모델 목록
  '/model <name>': () => 해당 모델의 에이전트로 전환
}

// /activation - 그룹 응답 설정
interface ActivationCommand {
  '/activation always': () => 모든 메시지에 응답
  '/activation mention': () => 멘션시에만 응답 (기본)
}

// /config - 설정 관리
interface ConfigCommand {
  '/config': () => 현재 설정 표시
  '/config set <key> <value>': () => 설정 변경
  '/config reset': () => 기본값 복원
}
```

### Layer 2: GlowUS 확장 명령어

#### 팀 명령어 (NEW)

```bash
# 팀에게 태스크 할당 (병렬 실행)
/team <팀명> "<태스크>"
/team 마케팅 "Q1 리포트 작성해줘"
/team 개발 "버그 리포트 분석해줘"

# 팀 목록
/teams

# 팀 상태
/team <팀명> status
```

#### 에이전트 지정 명령어 (확장)

```bash
# 특정 에이전트에게 명령 (기존 호환)
/agent <이름> <메시지>
/to <이름> "<메시지>"
@<이름> <메시지>

# 여러 에이전트에게 동시 명령 (NEW)
/to 리서처,작가 "마케팅 트렌드 리서치 후 블로그 글 작성"
```

#### 워크플로우 명령어 (NEW)

```bash
# 워크플로우 실행
/workflow <이름> "<입력>"
/workflow 콘텐츠제작 "AI 트렌드 주제로"
/workflow 영업리드 "핀테크 스타트업 대상"

# 워크플로우 목록
/workflows

# 워크플로우 상태
/workflow status <id>
```

#### 상태 & 모니터링 (NEW)

```bash
# 전체 상태 대시보드
/dashboard

# 특정 태스크 진행률
/progress <task_id>

# 비용 현황
/costs
/costs today
/costs week

# 성과 리포트
/report
/report <팀명>
```

#### 제어 명령어 (NEW)

```bash
# 에이전트/팀 일시정지
/pause <이름>
/pause 마케팅팀

# 재개
/resume <이름>

# 태스크 취소
/cancel <task_id>

# 승인 (HITL)
/approve <request_id>
/reject <request_id>
```

---

## Command Parser Design

### 통합 파서

```typescript
interface CommandParseResult {
  type: 'openclaw' | 'glowus' | 'natural';
  command: string;
  subcommand?: string;
  target?: string;      // 에이전트/팀 이름
  targets?: string[];   // 다중 대상
  message?: string;     // 태스크/메시지
  options?: Record<string, any>;
}

function parseCommand(text: string): CommandParseResult {
  const trimmed = text.trim();

  // === OpenClaw 호환 명령어 ===
  if (trimmed === '/status' || trimmed === '/me') {
    return { type: 'openclaw', command: 'status' };
  }

  if (trimmed === '/reset' || trimmed === '/clear') {
    return { type: 'openclaw', command: 'reset' };
  }

  if (trimmed.startsWith('/model')) {
    const args = trimmed.substring(6).trim();
    return {
      type: 'openclaw',
      command: 'model',
      subcommand: args || 'show'
    };
  }

  if (trimmed.startsWith('/activation')) {
    const mode = trimmed.substring(11).trim();
    return {
      type: 'openclaw',
      command: 'activation',
      options: { mode: mode || 'mention' }
    };
  }

  if (trimmed.startsWith('/config')) {
    const args = trimmed.substring(7).trim().split(' ');
    return {
      type: 'openclaw',
      command: 'config',
      subcommand: args[0] || 'show',
      options: { key: args[1], value: args[2] }
    };
  }

  // === GlowUS 확장 명령어 ===

  // /team 마케팅 "태스크"
  if (trimmed.startsWith('/team ')) {
    const match = trimmed.match(/^\/team\s+(\S+)\s+(.+)$/);
    if (match) {
      return {
        type: 'glowus',
        command: 'team',
        target: match[1],
        message: match[2].replace(/^["']|["']$/g, '')
      };
    }
    // /teams (팀 목록)
    if (trimmed === '/teams') {
      return { type: 'glowus', command: 'teams' };
    }
  }

  // /to 에이전트 "메시지" (다중 지원)
  if (trimmed.startsWith('/to ')) {
    const match = trimmed.match(/^\/to\s+([\S,]+)\s+(.+)$/);
    if (match) {
      const targets = match[1].split(',').map(t => t.trim());
      return {
        type: 'glowus',
        command: 'to',
        targets,
        target: targets[0],
        message: match[2].replace(/^["']|["']$/g, '')
      };
    }
  }

  // /workflow 이름 "입력"
  if (trimmed.startsWith('/workflow')) {
    if (trimmed === '/workflows') {
      return { type: 'glowus', command: 'workflows' };
    }
    const match = trimmed.match(/^\/workflow\s+(\S+)\s+(.+)$/);
    if (match) {
      return {
        type: 'glowus',
        command: 'workflow',
        target: match[1],
        message: match[2].replace(/^["']|["']$/g, '')
      };
    }
  }

  // /dashboard, /costs, /report
  if (trimmed === '/dashboard') {
    return { type: 'glowus', command: 'dashboard' };
  }

  if (trimmed.startsWith('/costs')) {
    const period = trimmed.substring(6).trim() || 'today';
    return {
      type: 'glowus',
      command: 'costs',
      options: { period }
    };
  }

  if (trimmed.startsWith('/report')) {
    const target = trimmed.substring(7).trim();
    return {
      type: 'glowus',
      command: 'report',
      target: target || undefined
    };
  }

  // /progress, /pause, /resume, /cancel
  if (trimmed.startsWith('/progress ')) {
    return {
      type: 'glowus',
      command: 'progress',
      target: trimmed.substring(10).trim()
    };
  }

  if (trimmed.startsWith('/pause ')) {
    return {
      type: 'glowus',
      command: 'pause',
      target: trimmed.substring(7).trim()
    };
  }

  if (trimmed.startsWith('/resume ')) {
    return {
      type: 'glowus',
      command: 'resume',
      target: trimmed.substring(8).trim()
    };
  }

  if (trimmed.startsWith('/cancel ')) {
    return {
      type: 'glowus',
      command: 'cancel',
      target: trimmed.substring(8).trim()
    };
  }

  // /approve, /reject
  if (trimmed.startsWith('/approve ')) {
    return {
      type: 'glowus',
      command: 'approve',
      target: trimmed.substring(9).trim()
    };
  }

  if (trimmed.startsWith('/reject ')) {
    return {
      type: 'glowus',
      command: 'reject',
      target: trimmed.substring(8).trim()
    };
  }

  // === 기존 GlowUS 명령어 (호환) ===

  // /agent <name> <message>
  if (trimmed.startsWith('/agent ')) {
    const args = trimmed.substring(7).trim();
    const firstSpace = args.indexOf(' ');
    if (firstSpace > 0) {
      return {
        type: 'glowus',
        command: 'agent',
        target: args.substring(0, firstSpace),
        message: args.substring(firstSpace + 1)
      };
    }
  }

  // @멘션 <message>
  if (trimmed.startsWith('@')) {
    const args = trimmed.substring(1).trim();
    const firstSpace = args.indexOf(' ');
    if (firstSpace > 0) {
      return {
        type: 'glowus',
        command: 'mention',
        target: args.substring(0, firstSpace),
        message: args.substring(firstSpace + 1)
      };
    }
  }

  // /list, /agents, /start
  if (['/list', '/agents', '/start'].includes(trimmed)) {
    return { type: 'glowus', command: 'list' };
  }

  // /link <email>
  if (trimmed.startsWith('/link ')) {
    return {
      type: 'glowus',
      command: 'link',
      options: { email: trimmed.substring(6).trim() }
    };
  }

  // === 자연어 (기본 에이전트로 라우팅) ===
  return {
    type: 'natural',
    command: 'chat',
    message: trimmed
  };
}
```

---

## Response Formats

### 팀 실행 응답

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ 마케팅팀에 태스크 할당됨                                   │
│                                                             │
│  📋 태스크: Q1 리포트 작성해줘                                │
│  🆔 ID: task_abc123                                         │
│                                                             │
│  팀 구성:                                                    │
│  ├── 🔍 리서처: 시장 조사 시작                               │
│  ├── 📊 분석가: 데이터 수집 시작                             │
│  └── ✍️ 작가: 대기 중 (리서치 완료 후)                        │
│                                                             │
│  ⏱️ 예상 완료: 35분                                          │
│                                                             │
│  /progress task_abc123 로 진행 상황 확인                     │
└─────────────────────────────────────────────────────────────┘
```

### 진행 상황 알림 (자동 푸시)

```
🔔 마케팅팀 진행 상황

[Phase 1: 리서치] ██████████ 100% ✅
  ├── 시장조사 ✅
  └── 경쟁분석 ✅

[Phase 2: 작성] ████████░░ 80% 🔄
  └── 초안 작성 중...

[Phase 3: 검토] ░░░░░░░░░░ 대기중

예상 완료: 12분 후
```

### 승인 요청 (인라인 버튼)

```
⏳ 승인 요청 #req_456

📧 이메일 전송 승인 필요

요청자: ✍️ 작가 에이전트
시간: 방금 전

To: client@example.com
Subject: Q1 마케팅 리포트
첨부: marketing_report_q1.pdf

[✅ 승인] [❌ 거부] [👁️ 미리보기]
```

### 대시보드 응답

```
📊 GlowUS 대시보드 (오늘)
━━━━━━━━━━━━━━━━━━━━━━━

🤖 에이전트: 12개 활성 / 3개 대기
📋 태스크: 47개 완료 / 5개 진행중
💰 비용: $12.34 (예산 대비 24%)
⏱️ 절약 시간: 4.2시간

🏆 Top 성과:
1. 리서처 - 작업 15건 완료
2. 작가 - 품질 점수 4.9/5
3. 분석가 - 응답 속도 1위

⚠️ 주의:
• QA봇 오류율 상승 (8%)
• 마케팅팀 태스크 지연 중

[상세 보기] [설정]
```

---

## Implementation Plan

### Phase 1: OpenClaw 호환 (1주)

**목표**: OpenClaw 사용자가 바로 사용 가능

```typescript
// 추가할 명령어
const phase1Commands = [
  '/model',       // 모델 확인/목록
  '/activation',  // 그룹 응답 설정
  '/config',      // 설정 관리
];
```

**작업 목록:**
- [ ] 명령어 파서 확장
- [ ] `/model` 핸들러 구현
- [ ] `/activation` 핸들러 구현
- [ ] `/config` 핸들러 구현
- [ ] 테스트

### Phase 2: 팀 명령어 (2주)

**목표**: 팀 기반 태스크 실행

```typescript
const phase2Commands = [
  '/team',        // 팀에게 태스크
  '/teams',       // 팀 목록
  '/to',          // 다중 에이전트 명령
  '/progress',    // 진행 상황
  '/pause',       // 일시정지
  '/resume',      // 재개
  '/cancel',      // 취소
];
```

**작업 목록:**
- [ ] 팀 실행 엔진 연동
- [ ] 병렬 실행 지원
- [ ] 실시간 진행 알림
- [ ] 제어 명령어 구현

### Phase 3: 워크플로우 & 대시보드 (2주)

**목표**: 고급 기능

```typescript
const phase3Commands = [
  '/workflow',    // 워크플로우 실행
  '/workflows',   // 목록
  '/dashboard',   // 대시보드
  '/costs',       // 비용
  '/report',      // 리포트
  '/approve',     // 승인
  '/reject',      // 거부
];
```

**작업 목록:**
- [ ] 워크플로우 엔진 연동
- [ ] HITL 승인 시스템 (인라인 버튼)
- [ ] 대시보드 생성
- [ ] 비용 추적 연동

---

## Telegram Bot Menu Registration

### 명령어 등록

```typescript
const commands = [
  // OpenClaw 호환
  { command: 'status', description: '상태 확인' },
  { command: 'reset', description: '대화 초기화' },
  { command: 'model', description: '모델 확인/변경' },
  { command: 'me', description: '내 정보' },

  // GlowUS 기본
  { command: 'list', description: '에이전트 목록' },
  { command: 'link', description: 'GlowUS 계정 연결' },

  // GlowUS 팀
  { command: 'teams', description: '팀 목록' },
  { command: 'team', description: '팀에게 태스크 할당' },
  { command: 'to', description: '에이전트에게 명령' },

  // GlowUS 워크플로우
  { command: 'workflows', description: '워크플로우 목록' },
  { command: 'workflow', description: '워크플로우 실행' },

  // GlowUS 모니터링
  { command: 'dashboard', description: '대시보드' },
  { command: 'progress', description: '진행 상황' },
  { command: 'costs', description: '비용 현황' },

  // GlowUS 제어
  { command: 'approve', description: '승인' },
  { command: 'cancel', description: '취소' },
];

// Telegram API로 등록
await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commands })
});
```

---

## Migration Guide for OpenClaw Users

### 마이그레이션 없이 바로 사용

```
기존 OpenClaw 사용자:

1. GlowUS Telegram Bot 추가
2. 기존 명령어 그대로 사용
   /status, /reset, /model 등
3. 준비 완료!

추가 기능을 원하면:
- /link email@example.com 으로 GlowUS 연결
- /teams 로 팀 기능 사용
- /workflows 로 워크플로우 사용
```

### 비교표

| 기능 | OpenClaw | GlowUS | 비고 |
|------|----------|--------|------|
| 기본 대화 | ✅ | ✅ | 동일 |
| `/status` | ✅ | ✅ | 동일 |
| `/reset` | ✅ | ✅ | 동일 |
| `/model` | ✅ | ✅ | 에이전트 기반 |
| 다중 에이전트 | ❌ | ✅ `/to` | 신규 |
| 팀 실행 | ❌ | ✅ `/team` | 신규 |
| 병렬 처리 | ❌ | ✅ | 신규 |
| 워크플로우 | ❌ | ✅ `/workflow` | 신규 |
| HITL 승인 | ❌ | ✅ `/approve` | 신규 |
| 비용 추적 | ❌ | ✅ `/costs` | 신규 |
| 대시보드 | ❌ | ✅ `/dashboard` | 신규 |
| 크로스 플랫폼 | ❌ | ✅ `/link` | 신규 |

---

## Success Metrics

| 메트릭 | 목표 |
|--------|------|
| OpenClaw 명령어 호환율 | 100% |
| 마이그레이션 시간 | 0분 (바로 사용) |
| 팀 명령어 사용률 | 30% (2주 내) |
| 워크플로우 사용률 | 20% (4주 내) |
| 사용자 만족도 | NPS > 50 |

---

## Appendix: Command Reference Card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GlowUS Telegram 명령어 카드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 기본 (OpenClaw 호환)
  /status          상태 확인
  /reset           대화 초기화
  /model           모델 확인
  /me              내 정보

📌 에이전트
  /list            에이전트 목록
  /to 이름 메시지    에이전트에게 명령
  @이름 메시지       멘션으로 호출

📌 팀
  /teams           팀 목록
  /team 이름 태스크  팀에게 할당

📌 워크플로우
  /workflows       워크플로우 목록
  /workflow 이름    워크플로우 실행

📌 모니터링
  /dashboard       대시보드
  /progress ID     진행 상황
  /costs           비용 현황

📌 제어
  /pause 이름       일시정지
  /resume 이름      재개
  /cancel ID       취소
  /approve ID      승인
  /reject ID       거부

📌 계정
  /link 이메일      GlowUS 연결

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Last Updated: 2026-02-01*
