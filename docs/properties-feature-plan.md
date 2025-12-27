# Properties 기능 기획서

## 1. 개요

| 항목 | 내용 |
|------|------|
| 기능명 | Properties (YAML Frontmatter 메타데이터 편집기) |
| 위치 | MarkdownEditorPanel 상단 |
| 저장형식 | YAML Frontmatter (파일 맨 위 `---` 블록) |
| **핵심** | Properties + Neural Map = AI Agent가 사용자를 이해하는 인터페이스 |
| **차별점** | 옵시디언 = 사람용 / **GlowUS = AI Agent가 읽고 이해하고 행동** |
| **철학** | 양방향 신뢰 사슬 (Trust Chain) 구축 |

---

## 2. 옵시디언 Properties 기능 (기준점)

### 2.1 등록 방법
1. **UI로 추가**: 노트 상단 Properties 영역 → [+ Add property] → 키/타입/값 입력
2. **커맨드 팔레트**: Cmd+P → "Add property" 실행
3. **YAML 직접 입력**: 파일 맨 위에 `---` 블록 작성

### 2.2 Property 타입

| 타입 | 설명 | 예시 값 |
|------|------|---------|
| Text | 일반 문자열 | "제목" |
| Number | 숫자 (정렬/필터용) | 42 |
| Checkbox | true/false | true |
| Date | 날짜 | 2025-12-27 |
| DateTime | 날짜+시간 | 2025-12-27T09:30 |
| Tags | 태그 배열 | [react, typescript] |
| List | 문자열 배열 | ["항목1", "항목2"] |
| Link | 내부 문서 링크 | [[문서A]] |
| Multi-select | 제한된 값 선택 | "진행중" / "완료" |

### 2.3 Properties 전역 관리 뷰

옵시디언 왼쪽 사이드바에서 **All Properties** 화면 제공:

```
┌─────────────────────────────────────┐
│ All Properties                      │
├─────────────────────────────────────┤
│ • type                              │
│   • spec                            │
│   • task                            │
│   • meeting                         │
│ • status                            │
│   • todo                            │
│   • doing                           │
│   • done                            │
│ • project                           │
│   • glowus                          │
│   • befun                           │
│ • tags        #research #articles   │
│ • author                            │
│   • [[구요한]]                      │
│ • date created    #linter           │
│ • date modified   #linter           │
└─────────────────────────────────────┘
```

**기능:**
- 프로젝트 내 모든 Property **키** 목록
- 각 키 아래 **사용된 값** 목록 (들여쓰기)
- 값 클릭 시 해당 값을 가진 문서 필터링

### 2.4 [[링크]] 입력 시 자동완성 모달

Property 값에 `[[` 입력하면 **실시간 문서 검색 모달** 표시:

```
┌─────────────────────────────────────┐
│ [[research n                        │
├─────────────────────────────────────┤
│ Research                            │
│ Resources                           │
│ Research101 - 30. Permanent Notes/… │
│ Research201 - 30. Permanent Notes/… │
│ researchnote                        │
└─────────────────────────────────────┘
│ # 헤딩링크  ^ 블록링크  | 표시텍스트 │
└─────────────────────────────────────┘
```

**특수 문법:**
| 입력 | 기능 | 예시 |
|------|------|------|
| `[[문서#` | 헤딩 링크 | `[[문서#섹션1]]` |
| `[[문서^` | 블록 링크 | `[[문서^abc123]]` |
| `[[문서\|` | 표시 텍스트 변경 | `[[문서\|다른이름]]` |

### 2.5 핵심 사용처

| 기능 | 설명 |
|------|------|
| **검색/필터/정렬** | 메타데이터 기반 노트 검색 |
| **템플릿 결합** | 새 문서 생성 시 표준 필드 자동 삽입 |
| **Dataview 연동** | 쿼리로 대시보드 생성 (상태별/마감일별/담당자별) |
| **관계 모델링** | `depends_on: [[모듈B]]` 형태로 의존성 표현 |

### 2.6 표준 메타데이터 예시

```yaml
---
type: spec
project: glowus
module: editor
status: todo
priority: P1
owner: jinsu
created: 2025-12-27
updated: 2025-12-27
tags:
  - spec
  - ui
depends_on:
  - [[FrameEngine]]
  - [[Step3Content]]
---
```

---

## 3. 핵심 차별점: AI Agent의 눈

### 3.1 옵시디언 vs GlowUS

| 항목 | 옵시디언 | GlowUS |
|------|----------|--------|
| Properties | 사람이 보는 메타데이터 | **AI Agent가 읽는 이해 기반** |
| Graph | 사람이 보는 시각화 | **AI Agent가 분석하는 지식 구조** |
| 목적 | 사람의 PKM 도구 | **AI Agent가 사용자를 이해하는 인터페이스** |

### 3.2 핵심 개념

**Properties + Neural Map = 사용자의 뇌를 AI에게 열어주는 인터페이스**

사용자의 모든 생각, 문서, 프로젝트가 방사형 노드로 구현되고:
- 관계 (어떤 문서가 어떤 문서와 연결되는지)
- 키워드 (문서의 핵심 주제)
- 연관성 (얼마나 관련 있는지)
- 종속성 (뭐가 뭐에 의존하는지)
- 가중치 (뭐가 더 중요한지)

이 모든 걸 AI Agent가 파악할 수 있으면:
- 사용자가 "이거 해줘"라고만 해도 맥락 파악
- 개떡같이 말해도 찰떡같이 알아들음
- 문서 정리, 기획, 코딩, 개발 다 알아서 수행
- AI Agent가 사용자 분신처럼 행동

### 3.3 AI 자동 분석

Properties가 비어있으면 AI Agent가 제대로 이해 못함.
그래서 AI가 문서 분석해서 Properties를 자동으로 채움 = **필수 기능**

**동작:**
```
1. 문서 본문 분석
2. 관계, 키워드, 종속성 자동 추출
3. Properties 자동 생성/제안
4. Neural Map에 노드/엣지 반영
5. AI Agent가 전체 지식 구조 파악
```

**분석 항목:**
- type: 문서 성격 (spec, task, meeting, research)
- project: 소속 프로젝트
- status: 진행 상태
- priority: 중요도/가중치
- depends_on: 종속성 (선행 문서)
- related: 연관 문서
- tags: 키워드

### 3.4 Agent 메모리 + RAG

**문제: 현재 AI (Short-term memory)**
- 컨텍스트 끝나면 다 잊음
- 대충 얼버무림
- 기억 못해서 거짓말
- 사용자가 검증 불가

**해결: Long-term memory + RAG**

AI Agent의 모든 것이 Properties + Neural Map으로 저장:
- 사용자와의 대화 기록
- 회의 내용
- 날짜별 대화
- 지시받은 업무
- 수행 기록
- 학습한 내용

모든 게 관계형으로 연결 (키워드, 종속성, 가중치):
```
┌─────────────────────────────────────────────────────────┐
│                   Agent Memory Store                    │
├─────────────────────────────────────────────────────────┤
│ conversations/        대화 기록 (날짜별)                │
│ tasks/                지시받은 업무                     │
│ executions/           수행 기록                         │
│ meetings/             회의 내용                         │
│ learnings/            학습한 내용                       │
└─────────────────────────────────────────────────────────┘
          │
          ↓ RAG (검색 증강 생성)
┌─────────────────────────────────────────────────────────┐
│                      LLM Engine                         │
│  (GPT / Claude / Gemini / 어떤 모델이든)                │
└─────────────────────────────────────────────────────────┘
```

**결과:**
- "이거 했어?" → 수행 기록 조회 → 거짓말 불가
- "저번에 뭐라고 했지?" → 대화 기록 조회 → 정확히 답변
- "진행 상황?" → 전체 맥락 파악 → 정확한 보고
- AI가 대충 못함, 얼버무림 불가, 속임 불가
- 모든 게 추적 가능

**LLM 교체 시:**
- 메모리는 그대로 유지
- 더 좋은 모델 장착 = 똑똑함만 증가
- Agent의 기억/경험/학습 내용 보존

### 3.5 신뢰 사슬 (Trust Chain)

**현재: 신뢰 사슬 없음**

```
사람 → AI (불신)
- AI가 뭘 했는지 모름
- 거짓말해도 검증 불가
- 대충해도 추적 불가
- 그래서 못 믿음

AI → 사람 (불완전)
- 사용자가 뭘 원하는지 모름
- 맥락 없음
- 그래서 제대로 못함
```

**GlowUS: 양방향 신뢰 사슬 구축**

```
사람 → AI (신뢰)
┌─────────────────────────────────────┐
│ 모든 수행 기록 추적                 │
│ 거짓말 불가, 대충 불가              │
│ 검증 가능 → 신뢰                    │
└─────────────────────────────────────┘

AI → 사람 (신뢰)
┌─────────────────────────────────────┐
│ 모든 맥락 구조화                    │
│ 사용자를 완전히 이해                │
│ 제대로 수행 → 신뢰                  │
└─────────────────────────────────────┘
```

**양방향 신뢰 사슬 = GlowUS AI Agent OS의 핵심 철학**

---

## 4. 데이터 흐름

```
┌──────────────┐     gray-matter      ┌──────────────┐
│  .md 파일    │ ──── 파싱 ────────→  │ JSON 객체    │
│  (YAML)      │ ←─── 직렬화 ───────  │ (Properties) │
└──────────────┘                      └──────────────┘
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      ↓                     ↓                     ↓
               ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
               │ Neural Map  │      │ AI Agent    │      │ 검색/필터   │
               │ 노드/엣지   │ ←──→ │ 맥락 파악   │      │ 쿼리 기반   │
               │ 관계 시각화 │      │ 행동 실행   │      │             │
               └─────────────┘      └─────────────┘      └─────────────┘
```

**핵심:** Properties가 변경되면 Neural Map에 즉시 반영, AI Agent가 실시간으로 지식 구조 파악

---

## 5. UI 구조

### 5.1 Properties 패널 (문서별)

```
┌─────────────────────────────────────────────────────┐
│ Properties                            [+] [AI 추천] │
├─────────────────────────────────────────────────────┤
│ ≡ type      │ ▼ spec                                │
│ ≡ project   │ glowus                                │
│ ≡ status    │ ▼ todo                                │
│ ≡ tags      │ [react] [typescript] [+]              │
│ ≡ created   │ 2025-12-27                            │
│ ≡ depends_on│ [[FrameEngine]] [+]                   │
├─────────────────────────────────────────────────────┤
│ AI 추천 (2개)                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ module: frontend                                │ │
│ │ 이유: React 관련 문서                           │ │
│ │                              [수락] [거절]      │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.2 Property 타입 변경 (≡ 아이콘 클릭)

```
┌─────────────────────────────────────────────────────┐
│ ≡ keyword   │ keyword                               │
└─────────────────────────────────────────────────────┘
      │
      ▼ (≡ 클릭)
┌─────────────────┐
│ Property type ▶ │───┐
├─────────────────┤   │
│ Cut             │   │  ┌─────────────┐
│ Copy            │   └─▶│ Text        │
│ Paste           │      │ ✓ List      │
├─────────────────┤      │ Number      │
│ Remove          │      │ Checkbox    │
└─────────────────┘      │ Date        │
                         │ Date & time │
                         └─────────────┘
```

### 5.3 타입별 UI 차이

| 타입 | UI 표시 | 예시 |
|------|---------|------|
| Text | 단일 입력 필드 | `keyword` |
| List | 태그 칩 (x로 삭제) | `[key1] x [key2] x [key3]` |
| Number | 숫자 입력 | `42` |
| Checkbox | 체크박스 | `[v]` / `[ ]` |
| Date | 날짜 선택기 | `2025-12-27` |
| Date & time | 날짜+시간 선택기 | `2025-12-27 09:30` |
| Link | [[문서]] + 백링크 카운트 | `[[구요한]] [388]` |

---

## 6. 파일 구조

```
components/neural-map/panels/
├── MarkdownEditorPanel.tsx      # 기존 (Properties 영역 추가)
├── AllPropertiesPanel.tsx       # 전역 Properties 관리 뷰 (사이드바)
└── properties/
    ├── PropertiesPanel.tsx      # 메인 패널 (문서별)
    ├── PropertyRow.tsx          # 개별 Property 행
    ├── PropertyInput.tsx        # 타입별 입력 컴포넌트
    ├── PropertyTypeSelect.tsx   # 타입 선택 모달
    ├── PropertyLinkInput.tsx    # [[링크]] 입력 + 자동완성 모달
    ├── LinkAutocomplete.tsx     # 문서 검색 자동완성 모달
    ├── AIRecommendation.tsx     # AI 추천 UI
    └── types.ts                 # 타입 정의

app/api/properties/
├── recommend/route.ts           # AI 추천 API
└── all/route.ts                 # 전역 Properties 조회 API
```

---

## 7. 컴포넌트 설계

### types.ts
```typescript
type PropertyType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'tags'
  | 'list'
  | 'link'
  | 'select'

interface Property {
  key: string
  value: unknown
  type: PropertyType
}

interface Recommendation {
  key: string
  value: unknown
  type: PropertyType
  reason: string
}
```

### PropertiesPanel.tsx
```typescript
interface PropertiesPanelProps {
  properties: Record<string, unknown>
  content: string  // AI 분석용 본문
  onUpdate: (properties: Record<string, unknown>) => void
}
```

### AIRecommendation.tsx
```typescript
interface AIRecommendationProps {
  recommendations: Recommendation[]
  onAccept: (rec: Recommendation) => void
  onReject: (rec: Recommendation) => void
  isLoading: boolean
}
```

### LinkAutocomplete.tsx
```typescript
interface LinkAutocompleteProps {
  query: string                    // 검색어 (예: "research n")
  onSelect: (link: string) => void // 선택 시 콜백
  onClose: () => void
}

// 특수 문법 지원
// [[문서#헤딩]] - 헤딩 링크
// [[문서^블록ID]] - 블록 링크
// [[문서|표시텍스트]] - 별칭
```

### AllPropertiesPanel.tsx
```typescript
interface AllPropertiesPanelProps {
  projectPath: string
}

interface PropertySummary {
  key: string                      // Property 키 (예: "status")
  values: string[]                 // 사용된 값들 (예: ["todo", "doing", "done"])
  count: number                    // 이 키를 가진 문서 수
}
```

---

## 8. 구현 순서

### Phase 1: 기본 UI
- [ ] gray-matter 설치
- [ ] YAML frontmatter 파싱/저장 로직
- [ ] PropertiesPanel 컴포넌트
- [ ] PropertyRow (text, number, checkbox)
- [ ] MarkdownEditorPanel에 통합

### Phase 2: 타입 확장
- [ ] date, datetime 입력
- [ ] tags (태그 칩 UI)
- [ ] list (배열 입력)
- [ ] select (드롭다운)
- [ ] PropertyTypeSelect 모달

### Phase 2.5: [[링크]] 자동완성
- [ ] LinkAutocomplete 컴포넌트
- [ ] `[[` 입력 감지 → 모달 트리거
- [ ] 실시간 문서 검색 (fuzzy search)
- [ ] `#` 헤딩 링크 지원
- [ ] `^` 블록 링크 지원
- [ ] `|` 표시 텍스트 변경 지원
- [ ] 키보드 네비게이션 (↑↓ Enter Esc)

### Phase 3: AI 자동 분석 + Neural Map 연동
- [ ] /api/properties/analyze 엔드포인트 (문서 분석 → Properties 자동 추출)
- [ ] AI 프롬프트 설계 (관계, 키워드, 종속성, 가중치 추출)
- [ ] Properties 변경 → Neural Map 노드/엣지 자동 반영
- [ ] Neural Map에서 연결 → Properties에 자동 반영 (양방향)
- [ ] AI Agent 맥락 파악 API 연동

### Phase 4: 전역 Properties 관리 뷰
- [ ] /api/properties/all 엔드포인트 (프로젝트 전체 스캔)
- [ ] AllPropertiesPanel 컴포넌트
- [ ] Property 키 목록 + 사용된 값 트리뷰
- [ ] 값 클릭 시 해당 문서 필터링
- [ ] 사이드바 통합

### Phase 5: 고급 기능
- [ ] Property 템플릿 (문서 타입별)
- [ ] 검색/필터 연동

---

## 9. 에러 처리

| 상황 | 처리 |
|------|------|
| YAML 파싱 실패 | 토스트 에러, 원본 유지 |
| AI API 실패 | "추천 불가" 표시, 수동 입력은 정상 |
| 잘못된 타입 입력 | 빨간 테두리 + 에러 메시지 |
| 중복 key | "이미 존재하는 키" 경고 |
| 링크 대상 없음 | "문서를 찾을 수 없음" 경고 |

---

## 10. 확인 요청

위 기획서대로 개발을 진행해도 될까요?

- [ ] 전체 승인
- [ ] 수정 필요 (피드백 주세요)
