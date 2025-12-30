/**
 * Neural Map Constants
 * Colors, LOD settings, theme presets, and policies
 */

import type {
  NodeType,
  NeuralMapTheme,
  LabelPolicy,
  LODDistances,
  RadialLayoutConfig,
} from './types'

// ============================================
// Node Type Colors
// ============================================

export const NODE_COLORS: Record<NodeType, string> = {
  self: '#FFD700',  // 골드
  concept: '#00BFFF',  // 시안
  project: '#10B981',  // 에메랄드
  doc: '#3B82F6',  // 블루
  idea: '#F59E0B',  // 앰버
  decision: '#EF4444',  // 레드
  memory: '#14B8A6',  // 틸
  task: '#06B6D4',  // 시안
  person: '#0EA5E9',  // 스카이블루
  insight: '#22D3EE',  // 시안라이트
  folder: '#6B7280',  // 그레이
  file: '#9CA3AF',  // 라이트그레이
  agent: '#8B5CF6',  // 퍼플 (스킬)
  // === Brain Core Types (NEW) ===
  rule: '#F97316',       // 오렌지 (규칙 - Identity Core)
  preference: '#EC4899', // 핑크 (선호)
  playbook: '#84CC16',   // 라임 (플레이북 - Procedural)
  identity: '#A855F7',   // 바이올렛 (정체성 - 가치/금기)
}

// ============================================
// LOD Distances
// ============================================

export const LOD_DISTANCES: LODDistances = {
  labelShow: 150,        // 라벨 표시
  labelHide: 300,        // 라벨 숨김
  nodeSimplify: 500,     // 노드 단순화 (구 → 점)
  clusterProxy: 800,     // 클러스터로 합침
  near: 100,             // 가까운 거리
  medium: 300,           // 중간 거리
  far: 500,              // 먼 거리
}

// ============================================
// Label Policy
// ============================================

export const LABEL_POLICY: LabelPolicy = {
  // 기본 상태
  defaultVisible: false,              // 라벨 기본 OFF
  maxVisible: 100,                    // 최대 표시 개수
  fontSize: 0.5,                      // 라벨 폰트 크기
  maxLength: 20,                      // 라벨 최대 길이

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
  },
}

// ============================================
// Node Thresholds
// ============================================

export const NODE_THRESHOLDS = {
  NORMAL: 100,          // 일반 렌더링 (낮춤 for performance)
  LARGE: 1000,          // InstancedMesh 적용
  HUGE: 5000,           // 극한 최적화
  INSTANCED: 100,       // InstancedMesh 사용 임계값 (500→100)
  LOD_MEDIUM: 200,      // 중간 LOD 임계값 (1000→200)
  LOD_LOW: 2000,        // 낮은 LOD 임계값
}

// ============================================
// Radial Layout Defaults
// ============================================

export const DEFAULT_RADIAL_CONFIG: RadialLayoutConfig = {
  centerNode: '',       // Self ID (런타임 설정)
  ringGap: 80,          // 링 간격
  angleSpread: 360,     // 노드 분산 각도
  jitter: 0.1,          // 위치 랜덤성 (0~0.2)
}

// ============================================
// Force Simulation Settings
// ============================================

export const FORCE_SETTINGS = {
  // Link force
  linkDistance: 30,        // 50 → 30 (더 짧게)
  linkStrength: 0.5,       // 0.3 → 0.5 (더 강하게 당김)

  // Charge force (repulsion)
  chargeStrength: -60,     // -100 → -60 (덜 밀어냄)
  chargeDistanceMax: 300,  // 500 → 300
  theta: 0.8,              // Barnes-Hut approximation theta
  distanceMax: 300,        // Maximum distance for charge force

  // Center force
  centerStrength: 0.08,    // 0.05 → 0.08 (중앙으로 더 당김)

  // Collision
  collisionRadius: 12,     // 15 → 12
  collisionStrength: 0.7,

  // Alpha (simulation warmth)
  alphaDecay: 0.02,
  alphaMin: 0.001,
  velocityDecay: 0.4,
}

// ============================================
// Node Rendering Settings
// ============================================

export const NODE_RENDERING = {
  // Base size
  baseSize: 2,
  importanceMultiplier: 0.5,
  minSize: 2.5,
  maxSize: 7,

  // Self node
  selfScale: 1.5,

  // Hover
  hoverScale: 1.15,
  hoverEmissiveIntensity: 0.8,

  // Normal
  normalEmissiveIntensity: 0.3,

  // Geometry
  sphereSegments: 32,
}

// ============================================
// Edge Rendering Settings
// ============================================

export const EDGE_RENDERING = {
  baseWidth: 0.2,
  maxWidth: 2,
  weightMultiplier: 2,
  defaultOpacity: 0.5,
  selectedOpacity: 1.0,
  particleSpeed: 0.02,
  particleSize: 2,
}

// ============================================
// Camera Settings
// ============================================

export const CAMERA_SETTINGS = {
  fov: 60,
  near: 0.1,
  far: 10000,

  // Initial position
  initialPosition: { x: 0, y: 50, z: 200 },
  initialTarget: { x: 0, y: 0, z: 0 },
  defaultPosition: { x: 0, y: 50, z: 200 },  // Alias for initialPosition

  // Smooth damp
  dampingFactor: 0.05,

  // Zoom limits
  minDistance: 50,
  maxDistance: 2000,

  // Focus animation
  focusDuration: 0.8,
  focusOffset: 100,
}

// ============================================
// Post Processing Settings
// ============================================

export const POST_PROCESSING = {
  enabled: true,  // Enable post-processing

  // Bloom
  bloom: {
    intensity: 1.2,
    luminanceThreshold: 0.2,
    luminanceSmoothing: 0.9,
    radius: 0.8,
  },

  // SSAO
  ssao: {
    enabled: true,  // Enable SSAO
    samples: 16,
    radius: 0.1,
    intensity: 20,
  },
}

// ============================================
// Theme Presets
// ============================================

export const THEME_PRESETS: NeuralMapTheme[] = [
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    background: {
      gradient: ['#050510', '#0a0a1a'],
      starsEnabled: true,
      starsColor: '#ffffff',
      starsCount: 5000,
    },
    node: {
      colors: NODE_COLORS,
      emissiveIntensity: 0.4,
      hoverScale: 1.15,
      selectedOutlineColor: '#ffffff',
      selectedOutlineWidth: 2,
    },
    edge: {
      defaultOpacity: 0.5,
      selectedOpacity: 1.0,
      particlesEnabled: true,
      baseColor: '#3B82F6',
      baseOpacity: 0.5,
      highlightOpacity: 1.0,
    },
    postProcessing: {
      bloomIntensity: 1.2,
      bloomThreshold: 0.2,
      ssaoIntensity: 20,
    },
    ui: {
      panelBackground: 'rgba(10, 10, 15, 0.95)',
      textColor: '#e5e5e5',
      accentColor: '#3b82f6',
      borderColor: '#27272a',
    },
  },
  {
    id: 'ocean-light',
    name: 'Ocean Light',
    background: {
      gradient: ['#e0f2fe', '#bae6fd'],
      starsEnabled: false,
      starsColor: '#94a3b8',
      starsCount: 100,
    },
    node: {
      colors: {
        ...NODE_COLORS,
        self: '#0369a1',
      },
      emissiveIntensity: 0.2,
      hoverScale: 1.12,
      selectedOutlineColor: '#0369a1',
      selectedOutlineWidth: 2,
    },
    edge: {
      defaultOpacity: 0.4,
      selectedOpacity: 0.9,
      particlesEnabled: false,
      baseColor: '#0284c7',
      baseOpacity: 0.4,
      highlightOpacity: 0.9,
    },
    postProcessing: {
      bloomIntensity: 0.5,
      bloomThreshold: 0.5,
      ssaoIntensity: 10,
    },
    ui: {
      panelBackground: 'rgba(255, 255, 255, 0.95)',
      textColor: '#1e293b',
      accentColor: '#0284c7',
      borderColor: '#e2e8f0',
    },
  },
  {
    id: 'forest-dim',
    name: 'Forest Dim',
    background: {
      gradient: ['#0f1f0f', '#1a2f1a'],
      starsEnabled: true,
      starsColor: '#90EE90',
      starsCount: 200,
    },
    node: {
      colors: {
        ...NODE_COLORS,
        self: '#22c55e',
        concept: '#4ade80',
        project: '#86efac',
      },
      emissiveIntensity: 0.35,
      hoverScale: 1.15,
      selectedOutlineColor: '#22c55e',
      selectedOutlineWidth: 2,
    },
    edge: {
      defaultOpacity: 0.45,
      selectedOpacity: 1.0,
      particlesEnabled: true,
      baseColor: '#22c55e',
      baseOpacity: 0.45,
      highlightOpacity: 1.0,
    },
    postProcessing: {
      bloomIntensity: 1.0,
      bloomThreshold: 0.25,
      ssaoIntensity: 15,
    },
    ui: {
      panelBackground: 'rgba(15, 31, 15, 0.95)',
      textColor: '#d1fae5',
      accentColor: '#22c55e',
      borderColor: '#166534',
    },
  },
]

// ============================================
// Default Theme
// ============================================

export const DEFAULT_THEME_ID = 'cosmic-dark'

// ============================================
// Panel Sizes
// ============================================

export const PANEL_SIZES = {
  left: {
    default: 280,
    min: 200,
    max: 400,
    collapsed: 0,
  },
  right: {
    default: 420,
    min: 280,
    max: 600,
    collapsed: 0,
  },
}

// ============================================
// Animation Durations (ms)
// ============================================

export const ANIMATION_DURATIONS = {
  expand: 400,
  collapse: 250,
  edgeDraw: 300,
  nodeHover: 150,
  panelToggle: 300,
  cameraFocus: 800,
  cameraMove: 800,    // Camera movement animation
  nodeAppear: 400,
  tabSwitch: 200,
}

// ============================================
// Keyboard Shortcuts
// ============================================

export const KEYBOARD_SHORTCUTS = {
  expandCollapse: 'Space',
  edit: 'Enter',
  delete: 'Delete',
  search: 'Ctrl+F',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  save: 'Ctrl+S',
  escape: 'Escape',
  focus: 'f',
  reset: 'r',
  viewTab1: '1',
  viewTab2: '2',
  viewTab3: '3',
  viewTab4: '4',
  viewTab5: '5',
}

// ============================================
// History Settings
// ============================================

export const HISTORY_SETTINGS = {
  maxActions: 50,
}

// ============================================
// API Endpoints
// ============================================

export const API_ENDPOINTS = {
  base: '/api/neural-map',
  nodes: '/api/neural-map/nodes',
  edges: '/api/neural-map/edges',
  files: '/api/neural-map/files',
  search: '/api/neural-map/search',
  insights: '/api/neural-map/insights',
  analyze: '/api/neural-map/analyze',
  export: '/api/neural-map/export',
  import: '/api/neural-map/import',
}

// ============================================
// File Upload Settings
// ============================================

export const FILE_UPLOAD = {
  maxSize: 50 * 1024 * 1024, // 50MB
  acceptedTypes: {
    pdf: '.pdf',
    image: '.jpg,.jpeg,.png,.gif,.webp,.svg',
    video: '.mp4,.webm,.mov',
    markdown: '.md,.markdown,.txt',
  },
}
