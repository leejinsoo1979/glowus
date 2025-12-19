# My Neural Map (Self Map) - 최종 설계 문서

> **버전**: v2.0 Final
> **작성일**: 2025-12-19
> **상태**: 컨펌 대기

---

## 0. Tech Stack (필수 고정)

### 0.1 렌더링 / 3D
| 라이브러리 | 용도 |
|-----------|------|
| `three` | 3D 코어 |
| `@react-three/fiber` | React Three.js 래퍼 |
| `@react-three/drei` | OrbitControls, Html, useTexture 등 헬퍼 |
| `@react-three/postprocessing` | Bloom, SSAO, DOF |

### 0.2 그래프 레이아웃 / 물리
| 라이브러리 | 용도 |
|-----------|------|
| `d3-force-3d` | Force 시뮬레이션 엔진 (R3F와 분리) |
| `three-spritetext` | 3D 텍스트 라벨 (LOD 정책 적용) |
| 커스텀 force | 방사형 링 배치 + 충돌 방지 |

> **중요**: `react-force-graph-3d`는 사용하지 않음. 아래 "렌더링 엔진 결정" 참조.

### 0.2.1 렌더링 엔진 결정 (Architecture Decision)

**문제**: `react-force-graph-3d`와 `@react-three/postprocessing`은 동시 사용 불가
- `react-force-graph-3d`: 자체 Three.js renderer/scene/camera 생성
- `@react-three/postprocessing`: R3F Canvas 내부에서만 동작

**선택지:**
| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. R3F + d3-force-3d** | R3F로 렌더링, d3-force-3d로 물리만 | PostProcessing 완전 제어, 그래픽 최상 | 구현 시간 증가 |
| B. react-force-graph-3d만 | force-graph 내장 렌더러 사용 | 빠른 프로토타입 | Bloom/SSAO 제한적 |

**결정: A안 채택**

이유:
1. 목표가 "옵시디언 초월" 그래픽 → PostProcessing 필수
2. InstancedMesh, 커스텀 쉐이더, LOD 완전 제어 필요
3. 장기적 확장성 (VR, AR 등)

**구현 방식:**
```typescript
// 1. d3-force-3d로 노드 위치 계산 (렌더링과 분리)
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d'

// 2. R3F Canvas에서 노드/엣지 직접 렌더링
<Canvas>
  <EffectComposer>
    <Bloom ... />
    <SSAO ... />
  </EffectComposer>
  <NodeInstances nodes={simulatedNodes} />
  <EdgeLines edges={edges} />
</Canvas>

// 3. useFrame에서 시뮬레이션 틱 연동
useFrame(() => {
  simulation.tick()
  updateNodePositions()
})
```

### 0.3 문서 뷰어
| 라이브러리 | 용도 |
|-----------|------|
| `react-pdf` / `pdfjs-dist` | PDF 뷰어 |
| `react-zoom-pan-pinch` | 이미지 줌/패닝 |
| `hls.js` | HLS 비디오 (필요시) |
| `react-markdown` + `remark-gfm` | 마크다운 렌더링 |
| `shiki` | 코드 하이라이트 |

### 0.4 상태 / 데이터
| 라이브러리 | 용도 |
|-----------|------|
| `zustand` | 전역 상태 관리 |
| `zod` | 스키마 검증 |

### 0.5 UI
| 라이브러리 | 용도 |
|-----------|------|
| `tailwindcss` | 스타일링 |
| `shadcn/ui` | UI 컴포넌트 |
| `lucide-react` | 라인 아이콘 (이모지/캐릭터 금지) |

### 0.6 성능 최적화
| 기법 | 적용 기준 |
|------|----------|
| `InstancedMesh` | 노드 3,000개 이상 |
| LOD (라벨 숨김) | 카메라 거리 > 300 |
| 지연 로딩 | Expand 시에만 children fetch |
| 클러스터 프록시 | 줌아웃 시 노드 합치기 |

### 0.6.1 라벨 정책 (SpriteText 병목 해결)

**문제**: `three-spritetext`는 노드마다 Canvas 텍스처 생성 → 수천 노드에서 메모리/렌더 폭발

**해결책: 엄격한 LOD 라벨 정책**

```typescript
const LABEL_POLICY = {
  // 기본 상태
  defaultVisible: false,              // 라벨 기본 OFF

  // 표시 조건 (OR 조건)
  showConditions: {
    hover: true,                      // 호버 시 표시
    selected: true,                   // 선택 시 표시
    distanceThreshold: 150,           // 카메라 거리 150 이내
  },

  // 대규모 그래프 정책 (3,000+ 노드)
  largeGraphPolicy: {
    enabled: true,                    // 노드 3000개 이상 시 활성화
    maxVisibleLabels: 20,             // 동시 표시 최대 20개
    priority: [
      'selected',                     // 1순위: 선택된 노드
      'hovered',                      // 2순위: 호버된 노드
      'importance >= 8',              // 3순위: 중요도 8 이상
      'distance < 100',               // 4순위: 매우 가까운 노드
    ],
  },

  // 초대규모 그래프 정책 (10,000+ 노드)
  hugeGraphPolicy: {
    enabled: true,
    maxVisibleLabels: 10,             // 최대 10개
    showOnlySelected: true,           // 선택된 노드만 라벨 표시
    useSimpleLabels: true,            // 텍스트 대신 아이콘/점 사용
  }
}
```

**렌더링 전략:**
| 노드 수 | 라벨 표시 방식 |
|---------|---------------|
| < 500 | 거리 기반 LOD (150 이내 표시) |
| 500 ~ 3,000 | hover/selected + importance 8+ |
| 3,000 ~ 10,000 | selected + top 20 |
| 10,000+ | selected only + 아이콘 대체 |

---

## 1. 개요

### 1.1 목적
"나(사용자)"를 중심으로 생각, 기억, 문서, 인사이트, 프로젝트, 의사결정이 방사형으로 연결된 **3D 지식 맵**. Obsidian 그래프 뷰를 넘어서는 우주/행성 느낌의 시각화.

### 1.2 핵심 원칙
- **Self 중심**: 모든 노드는 "나"로부터 방사형 확장
- **클릭 확장**: 마인드맵처럼 노드 클릭 시 하위 노드 애니메이션 생성
- **3패널 레이아웃**: 좌측 파일트리 + 중앙 3D맵 + 우측 Inspector/Chat
- **테마 시스템**: 다크 고정 금지, 사용자 정의 테마 지원
- **성능 우선**: 수천~수만 노드 대응 (LOD, Instancing, Frustum Culling)
- **아이콘 제한**: Lucide 라인 아이콘만, 이모지/캐릭터/사람 실루엣 금지

### 1.3 생성 모드
| 모드 | 설명 |
|------|------|
| **Auto Build** | 문서/파일 업로드 → AI 분석 → 노드/엣지/클러스터 자동 생성 |
| **Manual Build** | 중심 노드(Self)에서 시작, 클릭으로 가지 확장, 직접 메모 입력 |

### 1.4 라우트
```
/profile/:agentId/neural-map
```

---

## 2. 화면 레이아웃 (3패널)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo]  My Neural Map   [Mode: Auto▼]  [View: Radial▼]  [Theme] [Export] │
├─────────────┬────────────────────────────────────────┬───────────────────┤
│             │                                        │ [Inspector]       │
│  FILE TREE  │            3D NEURAL MAP               │ [Actions]         │
│  ─────────  │                                        │ [Chat]            │
│  🔍 Search  │         ┌─────────────────┐            │ ─────────────     │
│             │         │                 │            │                   │
│  📁 Docs    │         │    ★ SELF ★    │            │ Title: [      ]   │
│    └─ ...   │         │   ╱  │  ╲       │            │ Type: [Concept▼]  │
│  📁 Meetings│         │  ○   ○   ○     │            │ Summary:          │
│    └─ ...   │         │ ╱│╲ ╱│╲ ╱│╲    │            │ [            ]    │
│  📁 Ideas   │         │ ○○○ ○○○ ○○○    │            │ Tags: [ai][+]     │
│             │         │                 │            │                   │
│  [+ Upload] │         └─────────────────┘            │ [Save] [Delete]   │
│             │                                        │ [Add Child]       │
│             │  ┌────────────────────────────────┐    │                   │
│             │  │ Radial │ Cluster │ Path │ Road │    │ ── Chat ──        │
│             │  └────────────────────────────────┘    │ 이 노드에 대해    │
│             │                                        │ 질문하세요...     │
├─────────────┴────────────────────────────────────────┴───────────────────┤
│  Nodes: 1,234  │  Edges: 2,567  │  Clusters: 12  │  Last saved: 2m ago   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 좌측 패널 - File Tree (280px)
| 기능 | 설명 |
|------|------|
| 파일 목록 | 업로드된 문서/이미지/비디오/메모 |
| 폴더 구조 | 타입별/태그별/날짜별 분류 |
| 검색/필터 | 문서명, 태그, 타입 필터 |
| 파일 선택 | 연결된 노드 하이라이트, 연결 가능 노드 표시 |
| 업로드 | 드래그앤드롭 또는 버튼 |
| 최근 사용 | 최근 열람 파일 퀵 액세스 |

### 2.2 중앙 패널 - 3D Neural Map
| 기능 | 설명 |
|------|------|
| 3D 렌더링 | Three.js + react-force-graph-3d |
| 중심 노드 | Self Core (메인 행성, 특별 렌더링) |
| 방사형 배치 | 위성/궤도 느낌으로 하위 노드 확장 |
| 카메라 | Orbit 컨트롤 (회전/줌/패닝) + Smooth Damp |
| 뷰 탭 | Radial, Clusters, Pathfinder, Roadmap, Insights |

### 2.3 우측 패널 - Inspector + Chat (320px)
3개 탭으로 구성:

#### Tab 1: Inspector
| 필드 | 설명 |
|------|------|
| Title | 노드 제목 (편집 가능) |
| Type | 노드 타입 선택 |
| Summary | 요약 텍스트 |
| Tags | 태그 배열 |
| Importance | 중요도 (1-10 슬라이더) |
| Source | 연결된 문서/페이지 |
| Created | 생성일 |
| Connections | 연결된 노드 목록 |

#### Tab 2: Actions
| 버튼 | 기능 |
|------|------|
| Expand | 하위 노드 확장 |
| Collapse | 하위 노드 접기 |
| Add Child | 새 자식 노드 생성 |
| Connect | 다른 노드와 연결 |
| Merge | 노드 병합 |
| Pin | 위치 고정 |
| Cluster | 클러스터 지정 |
| Delete | 노드 삭제 |

#### Tab 3: Chat
- 선택된 노드/클러스터를 컨텍스트로 AI 에이전트와 대화
- "이 노드에 대해 설명해줘", "관련 노드 추천해줘" 등
- 기존 멀티채팅 시스템과 연동

---

## 3. 뷰 탭 (5개)

### 3.1 Radial Map (기본 뷰)
**목적**: Self 중심 방사형 배치, 마인드맵 스타일

**표시 데이터**:
- 선택 노드 기준 hop distance (1~N)
- relation_strength, relation_type

**기능**:
- 중심 노드 선택 → 1hop/2hop/3hop 링 생성
- 깊이 슬라이더 (1~5 hop)
- 관계 타입 필터

**UI**:
```
[중심 노드 선택] [깊이: ●●●○○] [필터: All▼]
```

### 3.2 Clusters (주제 군집)
**목적**: 노드를 주제별로 자동 군집화, "섬/성단" 시각화

**표시 데이터**:
- cluster_id, cluster_label
- cluster_center_node
- cohesion (응집도)
- 대표 키워드 TOP 5

**기능**:
- 클러스터별 색상/오라 구분
- 클러스터 필터 (체크박스)
- 클러스터 클릭 → 구성 노드 리스트 + 대표 문서

**UI**:
```
[☑ Strategy] [☑ Product] [☐ Research] [☑ Team]
```

### 3.3 Pathfinder (경로 탐색)
**목적**: A노드 → B노드 사고의 경로/근거 흐름 탐색

**표시 데이터**:
- shortest path
- strongest evidence path
- 각 엣지의 관계 타입, 근거(출처 문서), 가중치

**기능**:
- 출발/도착 노드 선택 (검색)
- 경로 알고리즘: BFS / 다익스트라 (가중치)
- 경로 하이라이트

**UI**:
```
From: [검색...] → To: [검색...] [Find Path]
경로: Self → Strategy → Decision → Outcome
```

### 3.4 Roadmap (흐름 로드뷰)
**목적**: 시간/의사결정/프로젝트 진행 흐름 시각화

**표시 데이터**:
- time_index (날짜/버전)
- milestone, decision, outcome
- 엣지: "다음 단계", "원인→결과", "결정→실행"

**기능**:
- 타임 슬라이더로 기간 필터
- Step 이동 (Prev/Next)
- 타임라인 뷰 (하단 바)

**UI**:
```
[2025-01 ●────────────○ 2025-12] [◀ Prev] [Next ▶]
```

### 3.5 Insights (분석 리포트)
**목적**: 그래프에서 뽑은 정량/정성 인사이트 대시보드

**표시 데이터**:
- Top central nodes (중심성)
- Bridging nodes (브릿지)
- Dead-ends (단절 노드)
- Growth metrics (노드 증가, 클러스터 변화)
- 활동 히트맵
- "최근 7일 주요 변화" 요약

**기능**:
- 각 인사이트 클릭 → 해당 노드/클러스터로 점프
- AI 추천 연결 제안

**UI**:
```
┌─ Top Nodes ─┐  ┌─ Recent ─┐  ┌─ Suggestions ─┐
│ 1. Strategy │  │ +12 nodes│  │ Connect A↔B   │
│ 2. Product  │  │ +3 edges │  │ Review orphan │
└─────────────┘  └──────────┘  └───────────────┘
```

---

## 4. 인터랙션

### 4.1 마우스
| 동작 | 기능 |
|------|------|
| 좌클릭 노드 | 선택 + Inspector 표시 |
| 더블클릭 노드 | 확장/축소 토글 |
| Shift + 클릭 | 멀티 선택 |
| 우클릭 노드 | 컨텍스트 메뉴 |
| 드래그 노드→노드 | 엣지 생성 (관계 타입 선택) |
| 드래그 배경 | 카메라 회전 |
| 스크롤 | 줌 인/아웃 |
| 휠 클릭 + 드래그 | 카메라 패닝 |

### 4.2 선택 강조
- 외곽선 (Outline) + 발광 (Glow)
- 스케일 1.0 → 1.15
- 카메라 easing 이동 (과한 줌 금지)
- 연결된 엣지 하이라이트

### 4.3 확장/축소 애니메이션
| 이벤트 | 애니메이션 |
|--------|-----------|
| Expand | 0에서 시작 → 스케일 업 (0.4s ease-out) + 궤도로 퍼짐 |
| Collapse | 스케일 다운 → 0 (0.25s ease-in) + 부모 방향 수렴 |
| 엣지 생성 | 라인 draw 애니메이션 (0.3s) |

### 4.4 키보드 단축키
| 키 | 기능 |
|----|------|
| `Space` | 선택 노드 확장/축소 |
| `Enter` | 편집 모드 |
| `Delete` | 삭제 (확인 다이얼로그) |
| `Ctrl+F` | 검색창 포커스 |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | 저장 |
| `Escape` | 선택 해제 / 모달 닫기 |
| `F` | 선택 노드로 포커스 |
| `R` | 뷰 리셋 (Self 중심) |
| `1-5` | 뷰 탭 전환 |

### 4.5 Undo/Redo
```typescript
interface HistoryAction {
  type: 'add_node' | 'delete_node' | 'update_node' | 'add_edge' | 'delete_edge' | 'move_node'
  payload: any
  inverse: any
  timestamp: number
}
// 최대 50개 히스토리 유지
```

---

## 5. 문서 모달 뷰어

노드가 문서와 연결된 경우, 클릭 시 모달로 문서 표시.

### 5.1 PDF 뷰어
| 기능 | 설명 |
|------|------|
| 페이지 네비게이션 | 이전/다음, 페이지 점프 |
| 줌 | 확대/축소/맞춤 |
| 검색 | 텍스트 검색 + 하이라이트 |
| 딥링크 | 특정 페이지로 바로 이동 |
| 하이라이트 | 노드 연결 구간 표시 |

### 5.2 이미지 뷰어
| 기능 | 설명 |
|------|------|
| 줌/패닝 | react-zoom-pan-pinch |
| 코멘트 | 특정 영역에 메모 |

### 5.3 비디오 뷰어
| 기능 | 설명 |
|------|------|
| 재생 컨트롤 | Play/Pause, 시간 이동 |
| 타임스탬프 메모 | 특정 시간에 노드 연결 |
| 딥링크 | 특정 시간으로 바로 이동 |

### 5.4 마크다운 뷰어
| 기능 | 설명 |
|------|------|
| 렌더링 | react-markdown + remark-gfm |
| 코드 하이라이트 | shiki |
| 앵커 | 특정 헤딩으로 이동 |

### 5.5 모달 UI 규칙
- 중앙 오버레이 + 배경 dim
- 크기: 80% viewport, 최대 1200px
- 닫기: X 버튼, ESC, 배경 클릭
- 3D 맵은 뒤에서 계속 보임 (blur 처리)

---

## 6. 3D 그래픽 스펙

### 6.1 씬 구성
| 요소 | 구현 |
|------|------|
| 배경 | 그라데이션 (#0a0a0f → #1a1a2e) + 별 파티클 (테마로 조절) |
| 조명 | Ambient (0.4) + Point Light (Self 위치) |
| 안개 | Fog (먼 거리 페이드) |

### 6.2 PostProcessing
```typescript
// Bloom
{
  intensity: 1.2,
  luminanceThreshold: 0.2,
  luminanceSmoothing: 0.9,
  radius: 0.8
}

// SSAO
{
  samples: 16,
  radius: 0.1,
  intensity: 20
}

// 테마별로 강도 조절 가능
```

### 6.3 노드 렌더링
| 속성 | 값 |
|------|-----|
| 지오메트리 | SphereGeometry (segments: 32) |
| 크기 | importance * 0.5 + 2 (범위: 2.5 ~ 7) |
| 머티리얼 | MeshStandardMaterial + emissive |
| Self 노드 | 1.5배 크기, 링 오브젝트, 강한 글로우, 골드 색상 |
| 호버 | emissiveIntensity: 0.3 → 0.8, scale: 1.15x |
| 선택 | Outline 쉐이더 + 외곽 링 |

### 6.4 노드 타입별 색상
```typescript
const NODE_COLORS: Record<NodeType, string> = {
  self:     '#FFD700',  // 골드
  concept:  '#00BFFF',  // 시안
  project:  '#10B981',  // 에메랄드
  doc:      '#8B5CF6',  // 퍼플
  idea:     '#F59E0B',  // 앰버
  decision: '#EF4444',  // 레드
  memory:   '#EC4899',  // 핑크
  task:     '#06B6D4',  // 틸
  person:   '#6366F1',  // 인디고
  insight:  '#A855F7',  // 바이올렛
}
```

### 6.5 엣지 렌더링
| 속성 | 값 |
|------|-----|
| 지오메트리 | LineSegments (기본) / TubeGeometry (선택 경로) |
| 두께 | weight * 2 (범위: 0.2 ~ 2) |
| 색상 | 출발 노드 색상 50% 투명도 |
| 선택 연결 | 100% 불투명 + 굵게 |
| 파티클 | 선택 시 엣지 따라 흐름 (선택사항) |

### 6.6 레이아웃 알고리즘
```typescript
// Radial Layout (Self 중심 방사형)
interface RadialLayoutConfig {
  centerNode: string       // Self ID
  ringGap: number          // 링 간격 (기본: 80)
  angleSpread: number      // 노드 분산 각도
  jitter: number           // 위치 랜덤성 (0~0.2)
}

// 레벨별 배치
// Level 0: Self (중심, 0,0,0)
// Level 1: Self 직접 자식 (반경 80, 균등 분산)
// Level 2: Level 1 자식들 (반경 160)
// ...

// d3-force-3d 커스텀 force로 구현
```

### 6.7 LOD 거리 기준
```typescript
const LOD_DISTANCES = {
  labelShow: 150,        // 라벨 표시
  labelHide: 300,        // 라벨 숨김
  nodeSimplify: 500,     // 노드 단순화 (구 → 점)
  clusterProxy: 800      // 클러스터로 합침
}
```

---

## 7. 데이터 모델

### 7.1 Node
```typescript
interface NeuralNode {
  id: string
  type: NodeType
  title: string
  summary?: string
  content?: string              // 마크다운 상세 내용
  tags: string[]
  importance: number            // 1-10

  // 계층
  parentId?: string
  clusterId?: string

  // 문서 연결
  sourceRef?: {
    fileId: string
    kind: 'pdf' | 'image' | 'video' | 'markdown'
    page?: number               // PDF 페이지
    timestamp?: number          // 비디오 초
    anchor?: string             // 마크다운 헤딩
  }

  // 시각화
  color?: string
  expanded: boolean
  pinned: boolean

  // 메타
  createdAt: string
  updatedAt: string

  // 3D 위치 (런타임)
  position?: { x: number; y: number; z: number }

  // 통계
  stats?: {
    views: number
    lastOpened: string
  }
}

type NodeType =
  | 'self'      // 중심 (유일)
  | 'concept'   // 개념
  | 'project'   // 프로젝트
  | 'doc'       // 문서
  | 'idea'      // 아이디어
  | 'decision'  // 의사결정
  | 'memory'    // 기억
  | 'task'      // 할일
  | 'person'    // 사람
  | 'insight'   // AI 인사이트
```

### 7.2 Edge
```typescript
interface NeuralEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  weight: number                // 0.1 ~ 1.0
  label?: string
  bidirectional: boolean

  // 근거
  evidence?: {
    fileId: string
    page?: number
    quote?: string
    note?: string
  }[]

  createdAt: string
}

type EdgeType =
  | 'parent_child'   // 계층
  | 'references'     // 참조
  | 'supports'       // 지지
  | 'contradicts'    // 반박
  | 'causes'         // 인과
  | 'same_topic'     // 같은 주제
  | 'sequence'       // 순서 (로드맵)
```

### 7.3 Cluster
```typescript
interface NeuralCluster {
  id: string
  title: string
  description?: string
  color: string
  keywords: string[]            // TOP 5 키워드
  cohesion: number              // 응집도 0~1
  centerNodeId?: string         // 대표 노드
  createdAt: string
}
```

### 7.4 Graph Container
```typescript
interface NeuralGraph {
  version: string               // "2.0"
  userId: string
  agentId: string               // 프로필 연결
  rootNodeId: string            // Self ID

  nodes: NeuralNode[]
  edges: NeuralEdge[]
  clusters: NeuralCluster[]

  // 뷰 상태
  viewState: {
    activeTab: 'radial' | 'clusters' | 'pathfinder' | 'roadmap' | 'insights'
    expandedNodeIds: string[]
    pinnedNodeIds: string[]
    selectedNodeIds: string[]
    cameraPosition: { x: number; y: number; z: number }
    cameraTarget: { x: number; y: number; z: number }
  }

  // 테마
  themeId: string

  createdAt: string
  updatedAt: string
}
```

---

## 8. API 설계

### 8.1 Graph CRUD
```typescript
// 루트 그래프 조회
GET /api/neural-map
Response: NeuralGraph

// 그래프 저장
PUT /api/neural-map
Body: NeuralGraph
Response: { success: boolean, updatedAt: string }

// 자식 노드 조회 (지연 로딩)
GET /api/neural-map/node/:nodeId/children?depth=1
Response: { nodes: NeuralNode[], edges: NeuralEdge[] }

// 노드 CRUD
POST   /api/neural-map/nodes
PATCH  /api/neural-map/nodes/:nodeId
DELETE /api/neural-map/nodes/:nodeId

// 엣지 CRUD
POST   /api/neural-map/edges
DELETE /api/neural-map/edges/:edgeId

// 검색
GET /api/neural-map/search?q=keyword
Response: { nodes: NeuralNode[] }

// 인사이트
GET /api/neural-map/insights
Response: {
  centralNodes: NeuralNode[]
  bridgeNodes: NeuralNode[]
  deadEnds: NeuralNode[]
  recentChanges: { added: number, removed: number }
  suggestions: { type: string, nodeIds: string[] }[]
}
```

### 8.2 파일 관리
```typescript
// 파일 목록
GET /api/neural-map/files
Response: {
  files: {
    id: string
    name: string
    type: 'pdf' | 'image' | 'video' | 'markdown'
    size: number
    uploadedAt: string
    linkedNodeCount: number
  }[]
}

// 파일 업로드
POST /api/neural-map/files
Body: FormData
Response: { fileId: string, url: string }

// 파일 삭제
DELETE /api/neural-map/files/:fileId
```

### 8.3 Auto-build (문서 분석)
```typescript
// 분석 요청
POST /api/neural-map/analyze
Body: {
  fileIds: string[]
  instructions?: string
}
Response: {
  jobId: string
  status: 'queued'
}

// 분석 상태 조회
GET /api/neural-map/analyze/:jobId
Response: {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number  // 0-100
  result?: {
    nodes: NeuralNode[]
    edges: NeuralEdge[]
    clusters: NeuralCluster[]
  }
  error?: string
}
```

### 8.4 Import/Export
```typescript
// JSON 내보내기
GET /api/neural-map/export
Response: NeuralGraph (다운로드)

// JSON 가져오기
POST /api/neural-map/import
Body: NeuralGraph
Response: { success: boolean, stats: { nodes: number, edges: number } }
```

---

## 9. 데이터베이스 (Supabase)

### 9.1 Tables
```sql
-- 뉴럴맵 메인
CREATE TABLE neural_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'My Neural Map',
  root_node_id UUID,
  view_state JSONB DEFAULT '{}',
  theme_id TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 노드
CREATE TABLE neural_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  parent_id UUID REFERENCES neural_nodes(id) ON DELETE SET NULL,
  cluster_id UUID REFERENCES neural_clusters(id) ON DELETE SET NULL,
  source_ref JSONB,
  color TEXT,
  expanded BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  position JSONB,
  stats JSONB DEFAULT '{"views": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 엣지
CREATE TABLE neural_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  weight DECIMAL DEFAULT 0.5 CHECK (weight >= 0.1 AND weight <= 1.0),
  label TEXT,
  bidirectional BOOLEAN DEFAULT false,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 클러스터
CREATE TABLE neural_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  cohesion DECIMAL DEFAULT 0.5,
  center_node_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업로드 파일
CREATE TABLE neural_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 분석 작업
CREATE TABLE neural_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  file_ids UUID[],
  instructions TEXT,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### 9.2 Indexes
```sql
CREATE INDEX idx_neural_nodes_map ON neural_nodes(map_id);
CREATE INDEX idx_neural_nodes_parent ON neural_nodes(parent_id);
CREATE INDEX idx_neural_nodes_cluster ON neural_nodes(cluster_id);
CREATE INDEX idx_neural_nodes_type ON neural_nodes(type);
CREATE INDEX idx_neural_edges_map ON neural_edges(map_id);
CREATE INDEX idx_neural_edges_source ON neural_edges(source_id);
CREATE INDEX idx_neural_edges_target ON neural_edges(target_id);
CREATE INDEX idx_neural_files_map ON neural_files(map_id);
```

### 9.3 RLS
```sql
ALTER TABLE neural_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_maps" ON neural_maps
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE neural_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_nodes" ON neural_nodes
  FOR ALL USING (map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid()));

-- edges, clusters, files, jobs 동일 패턴
```

---

## 10. 테마 시스템

### 10.1 테마 구조
```typescript
interface NeuralMapTheme {
  id: string
  name: string

  // 배경
  background: {
    gradient: [string, string]  // 그라데이션 시작/끝
    starsEnabled: boolean
    starsColor: string
    starsCount: number
  }

  // 노드
  node: {
    colors: Record<NodeType, string>
    emissiveIntensity: number
    hoverScale: number
    selectedOutlineColor: string
    selectedOutlineWidth: number
  }

  // 엣지
  edge: {
    defaultOpacity: number
    selectedOpacity: number
    particlesEnabled: boolean
  }

  // 포스트프로세싱
  postProcessing: {
    bloomIntensity: number
    bloomThreshold: number
    ssaoIntensity: number
  }

  // UI
  ui: {
    panelBackground: string
    textColor: string
    accentColor: string
    borderColor: string
  }
}
```

### 10.2 기본 프리셋 (3개)
```typescript
const THEME_PRESETS: NeuralMapTheme[] = [
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    background: {
      gradient: ['#0a0a0f', '#1a1a2e'],
      starsEnabled: true,
      starsColor: '#ffffff',
      starsCount: 500
    },
    // ...
  },
  {
    id: 'ocean-light',
    name: 'Ocean Light',
    background: {
      gradient: ['#e0f2fe', '#bae6fd'],
      starsEnabled: false,
      // ...
    },
    // ...
  },
  {
    id: 'forest-dim',
    name: 'Forest Dim',
    background: {
      gradient: ['#0f1f0f', '#1a2f1a'],
      starsEnabled: true,
      starsColor: '#90EE90',
      starsCount: 200
    },
    // ...
  }
]
```

---

## 11. 파일 구조

```
app/
  profile/
    [agentId]/
      neural-map/
        page.tsx                    # 메인 페이지
        layout.tsx

components/
  neural-map/
    NeuralMapCanvas.tsx             # R3F Canvas + EffectComposer (PostProcessing)
    NeuralMapScene.tsx              # 3D 씬 (노드/엣지/배경)

    nodes/
      NodeInstances.tsx             # InstancedMesh 기반 노드 렌더링
      SelfNode.tsx                  # Self 중심 노드 (특별 렌더링, 링/글로우)
      NodeLabel.tsx                 # SpriteText 라벨 (LOD 적용)

    edges/
      EdgeLines.tsx                 # 엣지 라인 렌더링
      EdgeParticles.tsx             # 선택 엣지 파티클 효과

    effects/
      StarField.tsx                 # 배경 별 파티클
      SelectionOutline.tsx          # 선택 노드 외곽선

    panels/
      FileTreePanel.tsx             # 좌측 파일 트리
      FileTreeItem.tsx
      InspectorPanel.tsx            # 우측 Inspector
      ActionsPanel.tsx              # 우측 Actions
      ChatPanel.tsx                 # 우측 Chat (기존 채팅 연동)

    tabs/
      RadialTab.tsx
      ClustersTab.tsx
      PathfinderTab.tsx
      RoadmapTab.tsx
      InsightsTab.tsx

    modals/
      DocumentModal.tsx             # 문서 뷰어 모달
      PdfViewer.tsx
      ImageViewer.tsx
      VideoViewer.tsx
      MarkdownViewer.tsx
      NodeEditorModal.tsx           # 노드 편집 모달

    controls/
      Toolbar.tsx                   # 상단 툴바
      SearchBox.tsx
      ThemePicker.tsx
      ImportExport.tsx
      ViewTabs.tsx

lib/
  neural-map/
    types.ts                        # 타입 정의
    store.ts                        # Zustand 스토어
    constants.ts                    # 색상, LOD 거리, 라벨 정책

    simulation/
      ForceSimulation.ts            # d3-force-3d 래퍼 클래스
      radialForce.ts                # 커스텀 방사형 force
      collisionForce.ts             # 노드 충돌 방지 force
      useSimulation.ts              # React 훅 (useFrame 연동)

    layout/
      radial.ts                     # 방사형 초기 배치
      clustering.ts                 # 클러스터 레이아웃

    graph/
      pathfinder.ts                 # 경로 탐색 알고리즘
      clustering.ts                 # 클러스터링
      insights.ts                   # 인사이트 계산

    utils/
      history.ts                    # Undo/Redo
      export.ts                     # Import/Export

hooks/
  useNeuralMap.ts                   # 메인 훅 (CRUD, 상태)
  useNeuralMapSimulation.ts         # d3-force-3d 시뮬레이션 (useFrame 연동)
  useNeuralMapCamera.ts             # 카메라 컨트롤 (Smooth Damp)
  useNeuralMapPicking.ts            # 레이캐스팅 (hover/click)
  useNeuralMapLabels.ts             # 라벨 LOD 관리
  useNeuralMapHistory.ts            # Undo/Redo

api/
  neural-map/
    route.ts                        # GET, PUT
    nodes/
      route.ts                      # POST
      [nodeId]/
        route.ts                    # PATCH, DELETE
        children/
          route.ts                  # GET (지연 로딩)
    edges/
      route.ts                      # POST
      [edgeId]/
        route.ts                    # DELETE
    files/
      route.ts                      # GET, POST
      [fileId]/
        route.ts                    # DELETE
    search/
      route.ts                      # GET
    insights/
      route.ts                      # GET
    analyze/
      route.ts                      # POST
      [jobId]/
        route.ts                    # GET
    export/
      route.ts                      # GET
    import/
      route.ts                      # POST

public/
  neural-map/
    sample.graph.json               # 샘플 데이터
```

---

## 12. 구현 단계

### Phase 1: 기본 구조 (Day 1-2)
- [ ] 타입 정의 (`lib/neural-map/types.ts`)
- [ ] Zustand 스토어 설정
- [ ] DB 마이그레이션 실행
- [ ] 페이지 레이아웃 (3패널)
- [ ] 라우트 설정 (`/profile/:agentId/neural-map`)

### Phase 2: 3D 렌더링 (Day 3-4)
- [ ] react-force-graph-3d 씬 설정
- [ ] 노드 렌더링 (SpriteText 라벨 포함)
- [ ] Self 노드 특별 렌더링 (골드, 글로우, 링)
- [ ] 엣지 렌더링
- [ ] 배경 (그라데이션 + 별 파티클)
- [ ] PostProcessing (Bloom, SSAO)

### Phase 3: 레이아웃 & 인터랙션 (Day 5-6)
- [ ] 방사형 레이아웃 (커스텀 force)
- [ ] 카메라 컨트롤 (Orbit + Smooth Damp)
- [ ] 노드 선택/하이라이트
- [ ] 확장/축소 애니메이션
- [ ] 멀티 선택 (Shift+Click)
- [ ] 키보드 단축키

### Phase 4: UI 패널 (Day 7-8)
- [ ] 좌측 FileTree 패널
- [ ] 우측 Inspector 탭
- [ ] 우측 Actions 탭
- [ ] 우측 Chat 탭 (기존 채팅 연동)
- [ ] 상단 Toolbar
- [ ] 검색 기능

### Phase 5: 뷰 탭 & 모달 (Day 9-10)
- [ ] Radial Map 탭
- [ ] Clusters 탭
- [ ] Pathfinder 탭
- [ ] Roadmap 탭
- [ ] Insights 탭
- [ ] 문서 모달 뷰어 (PDF, Image, Video, Markdown)

### Phase 6: 데이터 & API (Day 11-12)
- [ ] API 엔드포인트 구현
- [ ] 지연 로딩 (children)
- [ ] Import/Export
- [ ] Auto-build 스텁

### Phase 7: 최적화 & 마무리 (Day 13-14)
- [ ] InstancedMesh 적용 (3000+ 노드)
- [ ] LOD 적용 (라벨, 노드 단순화)
- [ ] Undo/Redo
- [ ] 테마 시스템 (3개 프리셋 + 커스텀)
- [ ] 버그 수정 & 테스트

---

## 13. 완료 기준

### 필수 (Must Have)
- [ ] 3패널 레이아웃 동작
- [ ] Self 중심 3D 맵 렌더링
- [ ] 노드 CRUD 동작
- [ ] 클릭 확장/축소 애니메이션
- [ ] 좌측 트리 ↔ 3D 동기화
- [ ] Inspector에서 노드 편집
- [ ] 5개 뷰 탭 동작
- [ ] 문서 모달 뷰어 (PDF 최소)
- [ ] Import/Export JSON
- [ ] 기본 테마 적용

### 권장 (Should Have)
- [ ] Undo/Redo
- [ ] 키보드 단축키 전체
- [ ] 3개 테마 프리셋
- [ ] Chat 탭 연동
- [ ] 엣지 드래그 생성

### 선택 (Nice to Have)
- [ ] 엣지 파티클 애니메이션
- [ ] 노드 드래그 이동
- [ ] Auto-build AI 분석 연동
- [ ] 실시간 협업

---

## 14. 금지 사항

1. **이모지/캐릭터/사람 아이콘 사용 금지** - Lucide 라인 아이콘만
2. **다크 모드 고정 금지** - 테마 시스템 필수
3. **중앙에 뷰어만 덩그러니 배치 금지** - 3패널 레이아웃 고정
4. **SpriteText 누락 금지** - three-spritetext 필수 import
5. **"그럴듯하게 보이는 척" 금지** - 문서 연결 시 실제로 해당 페이지 열어야 함

---

## 15. 다음 단계

이 문서 컨펌 후:
1. Phase 1 시작 (타입 정의, 스토어, DB 마이그레이션)
2. 샘플 데이터 생성 (`sample.graph.json`)
3. 기본 3D 렌더링 구현

---

**문서 끝. 컨펌 부탁드립니다.**
