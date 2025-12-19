# Session Room v2 - 기술 명세서

## 0. 목적 (Why)

현재 멀티에이전트 채팅은 "대화하는 척"이 발생한다.
Session Room v2의 핵심은 **에이전트가 실제로 공유 자료(PDF/이미지/영상)를 '보고' 근거 기반으로 판단/토론**하도록 만드는 것이다.

### 0.1 근본 원인 분석

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 에이전트가 실제로 자료를 못 봄 | 화면은 사람만 보고, 에이전트는 텍스트 입력만 받음 | Context Pack 주입 |
| 질문-되묻기 루프 발생 | 근거가 없어서 검증 불가 | Evidence 강제 |
| 회의 운영 규칙 없음 | 사회자 고정/없음 둘 다 문제 | Orchestrator 동적 할당 |
| 결론이 안 남 | 수렴 강제 규칙 없음 | Protocol Manager |

---

## 1. 절대 규칙 (Hard Constraints)

1. UI에서 이모지/사람 얼굴/사람 실루엣/캐릭터 아바타/만화풍 아이콘 **금지**
2. 다크모드 고정 **금지** - 사용자 정의 테마(Theme Tokens)로만 처리
3. Viewer는 **항상 좌측(또는 상단) 고정 패널** + Chat은 **우측(또는 하단) 패널**의 분할 레이아웃
   - "Viewer가 중앙에 떡" 같은 레이아웃 **금지**
4. 에이전트가 "봤다/읽었다" 발언을 하려면 **Evidence(근거) 오브젝트**가 메시지에 반드시 포함되어야 함 (없으면 발언 거부)
5. 사회자(Moderator)는 **고정 불가** - 유저 지정/없음/교체 모두 가능
6. 끝없는 되묻기 루프 방지: 프로토콜이 "수렴(결론)"을 강제

---

## 2. "진짜로 본다"의 최소 조건

### 조건 A: 자료 원문 입력 경로

| 자료 유형 | 입력 데이터 |
|-----------|-------------|
| PDF | 페이지별 텍스트 + 페이지 이미지(렌더) |
| 이미지 | 원본 이미지 + 캡션/텍스트(OCR) |
| 영상 | 자막/스크립트 + 대표 프레임(키프레임) |

### 조건 B: 뷰어 상태 실시간 동기화

- 현재 문서/페이지/확대/선택영역/하이라이트/포인터가 모든 에이전트에게 state 이벤트로 전달
- WebSocket 기반 실시간 브로드캐스트

### 조건 C: 답변에 근거 강제

- 모든 발화는 Evidence 포함: `[Evidence: 문서명 p.N "인용문"]`
- 선택영역 있으면 좌표 포함: `[Evidence: 문서명 p.N region(x,y,w,h)]`
- 근거 없이 "봤다" 금지 - 검증 실패 시 재생성

---

## 3. 시스템 아키텍처

### 3.1 핵심 컴포넌트

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Room v2                          │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│  Viewer Panel   │              Chat Panel                   │
│  (50% width)    │              (50% width)                  │
│                 │                                           │
│  ┌───────────┐  │  ┌─────────────────────────────────────┐  │
│  │ PDF/Image │  │  │ Message List                        │  │
│  │ /Video    │  │  │  - MessageCard (EvidenceTag)        │  │
│  │           │  │  │  - Evidence 클릭 → Viewer 점프      │  │
│  │ Zoom/Pan  │  │  │                                     │  │
│  │ Selection │  │  │                                     │  │
│  └───────────┘  │  ├─────────────────────────────────────┤  │
│                 │  │ Composer (입력창)                    │  │
│  Page Nav       │  │  - "자료 기반 답변" 토글             │  │
│  Thumbnails     │  │  - 결론 도출 버튼                    │  │
└─────────────────┴───────────────────────────────────────────┘
```

### 3.2 백엔드 서비스

1. **Viewer Service**
   - PDF 렌더/페이지 이미지 생성
   - 텍스트 추출
   - 영역 crop
   - 주석 저장

2. **Realtime Session Gateway (WebSocket)**
   - viewer_state 브로드캐스트
   - chat_event 브로드캐스트
   - turn_event 브로드캐스트
   - mode_event 브로드캐스트

3. **Agent Runtime**
   - 에이전트가 "필요한 페이지/영역"을 API로 가져감
   - 모델 입력에 포함
   - 답변 시 Evidence 강제

4. **Orchestrator**
   - 사회자 '고정'이 아니라 '역할'의 동적 할당
   - 회의/발표/진영/자유 모드마다 턴 규칙 적용
   - 결론/액션아이템/리스크 레드라인 강제 산출

---

## 4. 데이터 모델

### 4.1 Session (회의실)

```typescript
interface Session {
  id: string
  mode: 'meeting' | 'presentation' | 'debate' | 'free'
  participants: Participant[]
  roles: Role[]
  ruleset_version: string
  created_at: string
}
```

### 4.2 Document

```typescript
interface Document {
  id: string
  type: 'pdf' | 'image' | 'video'
  name: string
  url: string
  pages?: PageData[]        // PDF
  transcript?: string       // Video
}

interface PageData {
  page_number: number
  text: string
  image_url: string
}
```

### 4.3 Viewer State (핵심)

```typescript
interface ViewerState {
  session_id: string
  active_doc_id: string | null
  page_index: number
  viewport: {
    zoom: number
    x: number
    y: number
  }
  selection: {
    x: number
    y: number
    w: number
    h: number
  } | null
  annotations: Annotation[]
  presenter_id: string | null
  updated_at: string
}

interface Annotation {
  id: string
  type: 'highlight' | 'note' | 'pointer'
  page: number
  region?: { x: number, y: number, w: number, h: number }
  content?: string
  created_by: string
}
```

### 4.4 Evidence (답변 근거)

```typescript
interface Evidence {
  doc_id: string
  doc_name: string
  page?: number
  timestamp?: number        // 영상용
  region?: { x: number, y: number, w: number, h: number }
  quote?: string            // 인용문
}

interface MessageWithEvidence {
  content: string
  evidence: Evidence[]
  has_valid_evidence: boolean
}
```

---

## 5. API 명세

### 5.1 Viewer State API

```
GET  /api/sessions/:id/viewer-state
     → ViewerState

PATCH /api/sessions/:id/viewer-state
     Body: { page_index?, viewport?, selection?, presenter_id? }
     → ViewerState
```

### 5.2 Document API

```
GET  /api/docs/:docId
     → Document (메타데이터)

GET  /api/docs/:docId/pages/:n/text
     → { page: number, text: string }

GET  /api/docs/:docId/pages/:n/image
     → { page: number, image_url: string }

GET  /api/docs/:docId/selection
     Query: { x, y, w, h, page }
     → { crop_image_url: string, text: string }
```

### 5.3 Agent API

```
POST /api/agents/:id/pre-read
     Body: { doc_id, pages: number[] }
     → { success: boolean }

GET  /api/agents/:id/context-pack
     Query: { session_id }
     → { viewer_state, current_page_text, current_page_image }
```

### 5.4 Turn/Orchestrator API

```
POST /api/sessions/:id/turn/claim
     Body: { agent_id }
     → { granted: boolean, turn_id?: string }

POST /api/sessions/:id/turn/release
     Body: { turn_id }
     → { success: boolean }

POST /api/sessions/:id/conclude
     → { decision, action_items, risks }
```

---

## 6. Evidence 강제 검증

### 6.1 검증 규칙

```typescript
function validateEvidence(response: string, sharedContent: ViewerState): ValidationResult {
  // 1. "봤다/확인했다/읽었다" 표현 검출
  const claimsToSee = /봤|확인했|읽었|보니|살펴보|검토/g
  const hasClaims = claimsToSee.test(response)

  // 2. Evidence 태그 검출
  const evidencePattern = /\[Evidence:\s*([^\]]+)\]/g
  const evidences = [...response.matchAll(evidencePattern)]

  // 3. 검증
  if (hasClaims && evidences.length === 0) {
    return {
      valid: false,
      reason: '근거 없이 "봤다/확인했다" 표현 사용',
      action: 'regenerate'
    }
  }

  return { valid: true }
}
```

### 6.2 재생성 프롬프트

```
이전 답변이 거부되었습니다.
이유: 근거 없이 "봤다/확인했다" 표현 사용

규칙:
- 자료를 언급할 때는 반드시 [Evidence: 문서명 p.N "인용"] 형식으로 근거를 포함하세요
- 근거가 없으면 "해당 페이지를 확인해야 합니다" 또는 "p.N을 봐주세요"라고 말하세요
- 추측이나 가정은 명시적으로 표현하세요

다시 답변해주세요.
```

---

## 7. 모드별 운영 규칙

### 7.1 회의 모드 (Meeting)

**산출물 필수:**
- Decision 1개 이상
- Why-now/Why-us 근거 5개
- 2주 실험 플랜 1개
- 리스크 레드라인 5개

**규칙:**
- 발언은 "주장 → 근거(Evidence) → 반론 → 수정/합의" 사이클
- 같은 질문 2회 반복 시: 결정 프레임 강제 (옵션 A/B/C)
- 타임박스 종료 시: 강제 요약 + 결론 후보 2개 + 투표

### 7.2 발표 모드 (Presentation)

**역할:**
- Presenter: 포커스 권한 보유, 페이지 넘기기
- Audience: Q&A 라운드에서만 질문

**흐름:**
1. 발표자가 페이지별로 "핵심 3줄" 설명
2. 데이터/도표 해석
3. Q&A 라운드
4. 발표 요약 + 반론/보완 + 실행안

### 7.3 진영토론 모드 (Debate)

**팀 분리:** A팀 vs B팀

**라운드:**
1. Opening 주장 (근거 필수)
2. Cross-exam (상대 약점 2개씩)
3. Rebuttal (수정/보완)
4. Synthesis (합의안 또는 최종 판정)

**점수:** 근거 기반 점수표 (증거 없는 말 = 0점)

### 7.4 자유토론 모드 (Free)

**자유 발언 가능**

**되묻기 루프 방지:**
- 3회 연속 질문 감지 시: "결론 질문으로 바꿔라" 또는 "3개 옵션 중 선택하라"

---

## 8. UI 컴포넌트 구조

```
components/
├── session-room/
│   ├── SessionLayout.tsx       # 분할 레이아웃
│   ├── ViewerPanel/
│   │   ├── PdfViewer.tsx       # canvas 기반
│   │   ├── ImageViewer.tsx
│   │   ├── VideoViewer.tsx
│   │   ├── FocusOverlay.tsx    # region highlight
│   │   ├── PageThumbnails.tsx
│   │   └── ViewerControls.tsx  # zoom, pan
│   ├── ChatPanel/
│   │   ├── MessageList.tsx
│   │   ├── MessageCard.tsx     # EvidenceTag clickable
│   │   ├── EvidenceTag.tsx     # 클릭 → Viewer 점프
│   │   └── Composer.tsx
│   ├── ModeToolkit/
│   │   ├── AgendaPanel.tsx
│   │   ├── ProtocolStatus.tsx
│   │   ├── DecisionPanel.tsx
│   │   └── TurnIndicator.tsx
│   └── SessionHeader.tsx       # 모드 전환, 타이머, 테마
```

---

## 9. 구현 순서

### Phase 1: UI Skeleton
- [ ] SessionLayout (분할 레이아웃)
- [ ] ViewerPanel (placeholder)
- [ ] ChatPanel (기존 컴포넌트 재활용)
- [ ] Theme Tokens

### Phase 2: Viewer 동기화
- [ ] ViewerState 테이블
- [ ] WebSocket 브로드캐스트
- [ ] Focus/Selection 동기화
- [ ] EvidenceTag → Viewer 점프

### Phase 3: Context Pack 주입
- [ ] PDF 텍스트 추출 API
- [ ] PDF 페이지 이미지 API
- [ ] Agent Runtime에 Context Pack 전달
- [ ] Vision 모델 자동 전환

### Phase 4: Evidence 강제
- [ ] Evidence 태그 파서
- [ ] 검증 로직
- [ ] 재생성 프롬프트
- [ ] UI에서 Evidence 하이라이트

### Phase 5: 모드 엔진
- [ ] Protocol Manager
- [ ] 모드별 산출물 템플릿
- [ ] 턴 관리
- [ ] 결론 강제

---

## 10. 현재 구현 상태

### 완료
- [x] shared_viewer_state 테이블 (migration 101)
- [x] viewer API (GET/POST/PATCH/DELETE)
- [x] useSharedViewer 훅
- [x] SharedViewer 컴포넌트 (PDF/Image/Video 렌더)
- [x] 에이전트 응답 시 shared_viewer_state 조회
- [x] 공유 자료 컨텍스트를 시스템 프롬프트에 추가
- [x] 이미지 → Vision 모델에 전달
- [x] Evidence 형식 가이드 프롬프트에 포함
- [x] 회의 모드에서 자동 화면 분할 (messenger page)
- [x] Evidence 검증 로직 (`lib/meeting/evidence-validator.ts`)
  - 에이전트가 "봤다/확인했다" 표현 시 Evidence 태그 필수
  - 검증 실패 시 최대 2회 재생성
  - Evidence 태그 파싱 및 메타데이터 저장

### 진행 중
- [x] PDF 페이지별 텍스트 추출 API
  - `/api/docs/:docId/pages/:pageNum/text` - 단일 페이지 텍스트
  - `/api/docs/:docId/text` - 전체/범위 텍스트
  - 에이전트 응답 시 자동으로 현재 PDF 페이지 텍스트 주입

### 완료 (추가)
- [x] WebSocket 실시간 동기화
  - `useSharedViewer` 훅에 Supabase Realtime 구독 추가
  - INSERT/UPDATE/DELETE 이벤트 실시간 반영
  - 기존 polling 방식 대체

### 미착수
- [ ] Session Room 전용 페이지/라우트
- [ ] ViewerState에 selection 추가
- [ ] Protocol Manager
- [ ] 모드별 운영 규칙 엔진
