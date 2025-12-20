# GlowUS: Organizational AI Workforce OS

> **"개인 도구(Tool)에서 조직 인력(Workforce)으로"**
>
> GlowUS는 AI를 단순한 생산성 도구가 아닌, 조직의 **"디지털 직원"**으로 운용하기 위한 차세대 운영체제입니다.
> 우리는 기능(Feature)을 호출하는 것이 아니라, 책임과 권한을 가진 **에이전트(Agent)**들을 고용하고 관리합니다.

![GlowUS Dashboard](https://your-image-url.com) *(AI 조직 관제탑 예시)*

---

## 🏗️ 4-Core Engine Architecture

GlowUS는 단순한 챗봇이 아닙니다. 다음 4가지 핵심 엔진이 유기적으로 결합된 **'조직 운영체제'**입니다.

### 1. 🧠 Agent Identity & Growth Engine (자아 및 성장 엔진)
*   **"신입에서 임원까지"**: 에이전트는 경험(실행, 실패, 학습)을 통해 성장합니다.
*   **Memory Layer**: 1:1 대화(Private)와 팀 지식(Team)을 철저히 분리/보존합니다.
*   **Persona**: 단순한 말투 설정이 아닌, 관계와 맥락에 따라 적응하는 일관된 자아를 가집니다.

### 2. 🛠️ Skill OS & Marketplace (스킬 엔진)
*   **"도구의 표준화"**: 이메일, 검색, 코딩 등 모든 능력을 표준화된 'Skill'로 관리합니다.
*   **Marketplace**: 검증된 에이전트와 스킬 셋을 자산처럼 거래하고, 다른 조직으로 이식할 수 있습니다.
*   **Model Agnostic**: LLM은 교체 가능한 부품일 뿐, 기술은 OS에 귀속됩니다.

### 3. ⚡ Workflow Compiler & Runtime (실행 엔진)
*   **"대화에서 실행으로"**: 자연어 지시를 **Work Unit(업무 단위)**으로 변환합니다.
*   **Compiler**: Planner가 만든 계획을 실행 가능한 그래프(Graph IR)로 컴파일합니다.
*   **Runner**: 조건문, 루프, 승인 절차가 포함된 복잡한 업무를 멱등성을 보장하며 실행합니다.

### 4. 🛡️ Governance & Trust Engine (신뢰 엔진)
*   **"신뢰할 수 없다면 쓸 수 없다"**: 모든 행동은 감사 로그(Audit Log)로 투명하게 기록됩니다.
*   **HITL (Human-in-the-Loop)**: 고위험 작업(결제, 삭제)은 반드시 '컨펌 패킷'을 통해 인간 승인을 받습니다.
*   **Agent Score**: 에이전트의 신뢰도와 성과를 수치화하여 관리합니다.

---

## 📂 Project Structure

```bash
glowus/
├── app/
│   ├── dashboard-group/   # [관제탑] 워크보드, 인박스, 에이전트 프로필
│   └── agent-builder/     # [인사팀] 에이전트 생성(Genesis) 및 스킬 관리
├── lib/
│   ├── memory/            # [기억소] 5계층 메모리 (Private/Team/Meeting...)
│   ├── engine/            # [싱행기] Workflow Compiler & Runner
│   └── skills/            # [무기고] 스킬 레지스트리 및 통합 모듈
└── components/
    ├── neural-map/        # 에이전트 뇌구조(Brain Map) 시각화
    └── workflow/          # 워크플로우 그래프 편집기
```

---

## 🚀 Getting Started

AI 조직을 설립할 준비가 되셨습니까?

1.  **System Ignition**
    ```bash
    npm install
    npm run dev
    ```

2.  **First Hiring (Genesis)**
    *   `localhost:3000`에 접속하여 당신의 첫 번째 AI 직원을 채용하십시오.
    *   그들에게 **스킬(Skill)**을 주고, **규칙(Policy)**을 정해주십시오.

> **"Be the Architect of Intelligence."**
> AI를 비서로 부리지 말고, 조직의 자산으로 키우십시오.
