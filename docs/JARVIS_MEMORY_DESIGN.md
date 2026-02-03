# Jarvis Memory System Design

## 개요
자비스Claude의 Long-term Memory 시스템. 팩트와 추론을 명확히 구분.

## 메모리 타입

### 1. FACT (사실)
- **정의**: 원본 그대로 저장되는 객관적 데이터
- **수정 불가**: AI가 변형/요약 금지
- **출처 필수**: 언제, 어디서 온 정보인지 기록

```typescript
type FactMemory = {
  type: 'FACT'
  content: string           // 원본 내용
  source: {
    type: 'email' | 'meeting' | 'file' | 'chat' | 'manual'
    id?: string             // 원본 문서 ID
    timestamp: Date         // 생성 시점
  }
  tags: string[]            // 검색용 태그
  created_at: Date
}
```

**예시:**
- 거래처에 보낸 이메일 원문
- 미팅 녹취록
- 계약서 내용
- 사용자가 직접 입력한 정보

---

### 2. PREFERENCE (선호도)
- **정의**: 사용자의 취향, 습관, 설정
- **수정 가능**: 새 정보로 업데이트 가능
- **AI 학습용**: 추천/제안 시 참고

```typescript
type PreferenceMemory = {
  type: 'PREFERENCE'
  category: 'work_style' | 'tech_stack' | 'communication' | 'schedule' | 'other'
  key: string               // "preferred_framework"
  value: string             // "React"
  confidence: number        // 0.0 ~ 1.0 (확신도)
  learned_from?: string     // 어떻게 알게 됐는지
  updated_at: Date
}
```

**예시:**
- "React보다 Vue 선호"
- "오전 미팅 싫어함"
- "코드 주석은 영어로"

---

### 3. SUMMARY (요약)
- **정의**: AI가 생성한 요약/분석
- **명시 필수**: 반드시 "AI 요약임"을 표시
- **원본 참조**: 어떤 팩트를 기반으로 했는지 기록

```typescript
type SummaryMemory = {
  type: 'SUMMARY'
  content: string           // 요약 내용
  based_on: string[]        // 참조한 FACT ID 목록
  generated_at: Date
  model: string             // 생성한 모델 (ex: "claude-opus-4-5")
}
```

**예시:**
- "지난주 프로젝트 진행 요약"
- "Q4 미팅 내용 정리"

---

## 조회 규칙

### 팩트 질문 감지
```typescript
const FACT_INDICATORS = [
  '뭐였지', '뭐야', '뭐였어',
  '정확히', '원문', '원본',
  '언제', '몇 시', '며칠',
  '누가', '누구',
  '얼마', '몇 개',
  '보낸', '받은', '했던'
]

function isFactQuestion(query: string): boolean {
  return FACT_INDICATORS.some(indicator => query.includes(indicator))
}
```

### 응답 전략

#### 팩트 질문일 때
```
1. DB에서 FACT 타입만 검색
2. 있으면 → 원본 그대로 반환 + 출처 명시
3. 없으면 → "해당 기록을 찾을 수 없습니다" (추론 금지!)
```

#### 의견/추천 질문일 때
```
1. 관련 FACT + PREFERENCE 검색
2. 팩트 기반으로 추론
3. 응답 시 구분:
   - "[기록] ..." ← 팩트
   - "[제 생각에는] ..." ← 추론
```

---

## DB 스키마

```sql
-- Jarvis 메모리 테이블
CREATE TABLE jarvis_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),

  -- 메모리 타입
  memory_type TEXT NOT NULL CHECK (memory_type IN ('FACT', 'PREFERENCE', 'SUMMARY')),

  -- 공통 필드
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- FACT 전용
  source_type TEXT,  -- 'email', 'meeting', 'file', 'chat', 'manual'
  source_id TEXT,    -- 원본 문서 ID
  source_timestamp TIMESTAMPTZ,

  -- PREFERENCE 전용
  pref_category TEXT,
  pref_key TEXT,
  pref_value TEXT,
  confidence FLOAT DEFAULT 1.0,
  learned_from TEXT,

  -- SUMMARY 전용
  based_on UUID[],   -- 참조한 FACT ID들
  generated_by TEXT, -- 모델명

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 검색용 인덱스
CREATE INDEX idx_jarvis_memories_user ON jarvis_memories(user_id);
CREATE INDEX idx_jarvis_memories_type ON jarvis_memories(memory_type);
CREATE INDEX idx_jarvis_memories_tags ON jarvis_memories USING GIN(tags);

-- 전문 검색
ALTER TABLE jarvis_memories ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('korean', content)) STORED;
CREATE INDEX idx_jarvis_memories_fts ON jarvis_memories USING GIN(content_tsv);
```

---

## MCP 도구

### 1. `jarvis_remember`
새 메모리 저장

```typescript
{
  name: 'jarvis_remember',
  description: '정보를 장기 기억에 저장합니다',
  parameters: {
    memory_type: 'FACT' | 'PREFERENCE' | 'SUMMARY',
    content: string,
    source_type?: string,  // FACT일 때 필수
    tags?: string[],
    // ... 타입별 추가 파라미터
  }
}
```

### 2. `jarvis_recall`
메모리 검색

```typescript
{
  name: 'jarvis_recall',
  description: '장기 기억에서 정보를 검색합니다',
  parameters: {
    query: string,
    memory_type?: 'FACT' | 'PREFERENCE' | 'SUMMARY' | 'ALL',
    tags?: string[],
    limit?: number
  },
  returns: {
    memories: Memory[],
    is_fact_question: boolean,  // 팩트 질문인지 여부
    warning?: string  // "추론하지 마세요" 등
  }
}
```

### 3. `jarvis_forget`
메모리 삭제

```typescript
{
  name: 'jarvis_forget',
  description: '특정 기억을 삭제합니다',
  parameters: {
    memory_id?: string,
    query?: string,  // 검색 후 삭제
  }
}
```

### 4. `jarvis_update_preference`
선호도 업데이트

```typescript
{
  name: 'jarvis_update_preference',
  description: '사용자 선호도를 업데이트합니다',
  parameters: {
    category: string,
    key: string,
    value: string,
    confidence?: number
  }
}
```

---

## 자동 메모리 로드

Claude Code 시작 시 최근 기억을 자동 로드:

```typescript
// MCP 서버 초기화 시
async function onSessionStart(userId: string) {
  // 최근 PREFERENCE 로드
  const preferences = await db.query(`
    SELECT * FROM jarvis_memories
    WHERE user_id = $1
    AND memory_type = 'PREFERENCE'
    AND is_deleted = FALSE
    ORDER BY updated_at DESC
    LIMIT 50
  `, [userId])

  // 시스템 프롬프트에 주입
  return formatAsContext(preferences)
}
```

---

## 응답 포맷

### 팩트 응답
```
📋 [기록 - 2024.01.15 이메일]
ABC Corp 김철수 대리에게 보낸 이메일:

"견적서 첨부드립니다.
검토 후 피드백 부탁드립니다.
감사합니다."
```

### 팩트 없을 때
```
❌ 해당 기록을 찾을 수 없습니다.

검색한 범위:
- 이메일 기록
- 미팅 기록

혹시 다른 키워드로 검색해볼까요?
```

### 추론 포함 응답
```
📋 [기록]
지난 미팅에서 A안과 B안을 논의했습니다.

💭 [제 생각]
A안이 더 적합해 보입니다. 이유는...
(이 부분은 제 추론입니다)
```

---

## 구현 우선순위

1. **Phase 1**: DB 스키마 + 기본 MCP 도구 (remember, recall)
2. **Phase 2**: 팩트/추론 구분 로직
3. **Phase 3**: 자동 메모리 로드
4. **Phase 4**: GlowUS 데이터 연동 (이메일, 캘린더, 태스크)
