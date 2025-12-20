# 📘 AI Agent OS: Organizational AI Workforce Operating System (v4.0)

> **"개인 도구(Tool)에서 조직 인력(Workforce)으로"**
>
> 본 문서는 AI 에이전트를 단순한 도구가 아닌, 조직의 **"디지털 직원(Digital Workforce)"**으로 운용하기 위한 운영체제(OS)의 기술 사양서입니다.

---

## 1. 제품 정의 및 차별성 (Product Definition)

### 1.1. 정의
AI 에이전트 OS는 사용자의 업무에 최적화된 에이전트를 설계하고, 다양한 스킬들을 조합해 **‘실행 가능한 워크플로우’**로 자동 전환함으로써 마치 팀의 일원처럼 업무를 수행하게 만드는 조직형 운영체제입니다.

### 1.2. 핵심 차별점
1.  **개인 도구 → 조직 인력**: 개인 PC의 툴이 아니라, 조직 전체가 공유하는 **가상 인력(Virtual Workforce)**.
2.  **기능 연동 → 직원 운영**: 단순 API 연동(MCP)을 넘어, **권한/책임/성과/감사** 체계를 갖춘 직원 운영 시스템.
3.  **개인 최적화 → 자산화**: 에이전트를 조직의 **자산(Asset)**으로 이식, 판매, 재투입 가능한 경제 구축.
4.  **모델 무관(Model Agnostic)**: 특정 LLM에 종속되지 않고, 모든 모델을 두뇌로 교체 사용 가능한 **OS 커널 레이어** 제공.
5.  **신뢰/통제 내재**: **HITL(Human-In-The-Loop)**, 정책 준수, 감사 로그를 OS 커널 레벨에서 강제.

---

## 2. 핵심 철학 (Core Philosophy): 성장하는 자아

### 2.1. 6대 원칙
1.  **기억은 자산**: 원본 정보 보존 + 요약/학습 레이어 분리 축적.
2.  **프라이버시/권한**: 1:1 기억 격리, 팀 메모리 권한 기반 통제.
3.  **경험 = 성장**: 대화뿐 아니라 **실행(Execution)과 실패(Failure)** 경험이 축적되어 역량 성장.
4.  **일관된 자아**: Core Self는 유지하되, 상대에 따라 **Tone & Manner** 조정.
5.  **실행 우선 OS**: 대화는 결국 **실행 가능한 아티팩트(Artifact)**로 수렴해야 함.
6.  **사람 승인 (HITL)**: 고위험 행동(결제, 데이터 삭제)은 **반드시 인간 승인** 필요.

### 2.2. 성장 로드맵 (Evolution)
*   **Day 1**: 주입된 기본 지식으로 업무 시작.
*   **Day 30**: 팀 문서/선호도를 학습해 자체 템플릿 형성.
*   **Day 100**: 반복 업무 자동 제안 및 리스크 선제 표시.
*   **Day 365**: 팀 표준 실행 설계를 스스로 만들고 최적화.

---

## 3. 시스템 아키텍처: 4대 코어 엔진

이 시스템은 다음 4가지 엔진이 유기적으로 결합되어 작동합니다.

### 3.1. Agent Identity & Growth Engine (자아 및 성장 엔진)
*   **Core Self**: 기본 성격, 가치관.
*   **Relationship Layer**: 상대방별 친밀도/신뢰도 관리.
*   **Memory Layer**: 5계층 메모리 구조.
    1.  **Private Memory**: 1:1 대화 (완전 격리).
    2.  **Meeting Memory**: 회의 참석자 공유.
    3.  **Team Memory**: 조직 전체 공유.
    4.  **Injected Knowledge**: 외부 주입 매뉴얼.
    5.  **Execution Memory**: 워크플로우 실행 이력 및 결과.

### 3.2. Skill OS & Marketplace Engine (스킬 엔진)
*   **Skill Registry**: 스킬 카탈로그 (Input/Output 스키마, 권한, 비용 정의).
*   **Integration Support**: 내부 API, 외부 SaaS, MCP 등 모든 기능을 '스킬'로 래핑.
*   **Marketplace**: 검증된 에이전트 패키지(Blueprint + Skills + Policy)를 거래/이식.

### 3.3. Workflow Compiler & Runtime (실행 엔진)
사용자의 자연어 지시를 실제 실행으로 변환하는 컴파일러 구조입니다.
1.  **Planner**: 지시 → **WBS(작업 분해 구조)** 및 대안 플랜 생성.
2.  **Compiler**: Plan → **Graph IR(중간 표현)** 그래프로 변환 (분기/루프 포함).
3.  **Approval Gate**: 위험 노드 식별 및 **'컨펌 패킷'** 생성.
4.  **Runner**: 그래프 실행 (재시도, 멱등성 보장).
5.  **Reporter**: 실행 결과 요약 및 감사 로그(Audit Log) 생성.

### 3.4. Governance & Trust Engine (신뢰 엔진)
*   **Agent Score**: 신뢰도 점수화 (성공률, 정책 위반 0건 유지 등).
*   **Audit Logging**: 모든 행동의 근거(Evidence)와 사용 권한 기록.
*   **Policy Enforcer**: 권한 없는 데이터 접근 차단 및 리스크 관리.

---

## 4. 핵심 UX 개념 (Core UX Concepts)

### 4.1. Work Unit (업무 단위)
에이전트의 일은 '채팅'이 아니라 'Work Unit'으로 관리됩니다.
*   **Work Item**: 목표, 기한, 성공 기준.
*   **Assignment**: 담당 에이전트 및 허용 권한.
*   **Artifact**: 결과물 (문서, 코드, 보고서).
*   **Evidence**: 판단 근거 로그.
*   **Review**: 검수 및 승인 이력.

### 4.2. Confirm Packet (컨펌 패킷)
실행 전 사용자가 한눈에 판단할 수 있도록 제공하는 요약 패킷입니다.
*   **Plan 요약**: 비용, 시간, 목표.
*   **Workflow Graph**: 실행 흐름도 시각화.
*   **Risk & Perms**: 요구 권한 및 위험 요소 하이라이트.
*   **A/B Alternatives**: "빠르지만 위험한 안" vs "느리지만 안전한 안".
*   **Result Preview**: 예상 결과물 미리보기.

---

## 5. 데이터베이스 스키마 (Database Schema)

### 5.1. Workflow & Execution

```sql
-- 워크플로우 정의
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  org_id UUID,
  graph_ir JSONB,        -- 실행 가능한 그래프 구조
  status TEXT,           -- draft, approved, archived
  created_at TIMESTAMPTZ
);

-- 워크플로우 실행 (Run)
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  status TEXT,           -- running, success, failed
  trigger_type TEXT,     -- manual, schedule
  cost_total NUMERIC,    -- 소모 토큰/비용
  result_summary TEXT,   -- 최종 보고 요약
  created_at TIMESTAMPTZ
);

-- 실행 노드 로그 (Audit)
CREATE TABLE run_nodes (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES workflow_runs(id),
  node_id TEXT,          -- 그래프 상의 노드 ID
  input JSONB,
  output JSONB,
  error_log TEXT,
  used_permissions JSONB, -- 사용한 권한 목록
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
```

### 5.2. Skills & Governance

```sql
-- 스킬 레지스트리
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  name TEXT,
  schema_input JSONB,    -- 입력 파라미터 정의
  schema_output JSONB,   -- 출력 데이터 정의
  risk_level TEXT,       -- low, medium, high (critical)
  required_auth TEXT[],  -- 필요 권한 목록
  created_at TIMESTAMPTZ
);

-- 에이전트 신뢰도 (Score)
CREATE TABLE agent_scores (
  agent_id UUID REFERENCES agents(id),
  reliability_score FLOAT, -- 신뢰도 점수 (0.0 ~ 1.0)
  tasks_completed INT,
  tasks_failed INT,
  policy_violations INT,
  updated_at TIMESTAMPTZ
);
```

---

## 6. 구현 로드맵 (MVP 4 Weeks)

*   **Week 1 (Foundation)**: Skill Registry (이메일/검색 5종), Planner v0 (WBS 생성).
*   **Week 2 (Execution)**: Workflow Compiler v0 (그래프 변환), Runner v0 (직렬 실행).
*   **Week 3 (Reporting)**: Reporter v0 (결과 요약), Execution Memory (경험 축적).
*   **Week 4 (Visualization)**: Agent Profile v0 (능력치 레이더), Marketplace v0 (템플릿 공유).
