// =====================================================
// 사업계획서 자동생성 파이프라인 타입 정의
// =====================================================

export type PipelineStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export type PipelineStatus =
  | 'draft'
  | 'collecting'
  | 'extracting'
  | 'mapping'
  | 'generating'
  | 'validating'
  | 'reviewing'
  | 'approved'
  | 'submitted'
  | 'completed'

export type ValidationStatus = 'pending' | 'valid' | 'warning' | 'invalid'

export type QuestionType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'file'

export type FactType = 'text' | 'number' | 'date' | 'list' | 'json'

export type FactCategory =
  | 'company_info'      // 기업 기본 정보
  | 'technology'        // 기술 현황
  | 'team'              // 팀 구성
  | 'finance'           // 재무 정보
  | 'market'            // 시장 분석
  | 'product'           // 제품/서비스
  | 'achievement'       // 성과/실적
  | 'plan'              // 사업 계획
  | 'intellectual_property' // 지식재산권
  | 'certification'     // 인증/허가
  | 'partnership'       // 협력/파트너십

// =====================================================
// 템플릿 관련 타입
// =====================================================

export interface TemplateSection {
  section_id: string
  title: string
  required: boolean
  max_chars?: number
  min_chars?: number
  guidelines?: string
  order: number
  subsections?: TemplateSubsection[]
  evaluation_weight?: number
}

export interface TemplateSubsection {
  id: string
  title: string
  parent_section_id: string
  order: number
  guidelines?: string
}

export interface EvaluationCriterion {
  criterion: string
  weight: number
  description?: string
  max_score?: number
}

export interface RequiredAttachment {
  name: string
  format: string[]
  required: boolean
  description?: string
}

export interface FormattingRules {
  font_family?: string
  font_size?: number
  line_spacing?: number
  margin?: {
    top: number
    bottom: number
    left: number
    right: number
  }
  page_limit?: number
  file_format?: string[]
}

export interface BusinessPlanTemplate {
  id: string
  program_id?: string
  company_id?: string
  template_name: string
  template_version: string
  source_document_url?: string
  sections: TemplateSection[]
  evaluation_criteria: EvaluationCriterion[]
  required_attachments: RequiredAttachment[]
  writing_guidelines: Record<string, string>
  formatting_rules: FormattingRules
  parsing_status: 'pending' | 'processing' | 'completed' | 'failed'
  parsing_error?: string
  created_at: string
  updated_at: string
}

// =====================================================
// 사업계획서 관련 타입
// =====================================================

export interface BusinessPlan {
  id: string
  company_id: string
  program_id?: string
  template_id?: string
  title: string
  project_name?: string
  pipeline_stage: PipelineStage
  pipeline_status: PipelineStatus
  completion_percentage: number
  section_completion: Record<string, number>
  ai_model_used?: string
  total_tokens_used: number
  generation_cost: number
  simulated_score?: number
  score_breakdown?: ScoreBreakdown
  version: number
  is_latest: boolean
  parent_version_id?: string
  assigned_to?: string
  reviewers?: string[]
  submitted_at?: string
  submission_reference?: string
  result_status?: 'pending' | 'selected' | 'rejected' | 'waitlist'
  result_feedback?: string
  result_score?: number
  created_at: string
  updated_at: string
  // Relations
  sections?: BusinessPlanSection[]
  template?: BusinessPlanTemplate
  program?: {
    id: string
    title: string
    organization: string
  }
}

export interface ScoreBreakdown {
  total_score: number
  max_score: number
  sections: {
    section_id: string
    section_title: string
    score: number
    max_score: number
    feedback?: string
  }[]
}

// =====================================================
// 섹션 관련 타입
// =====================================================

export interface Placeholder {
  placeholder_id: string
  text: string
  question?: string
  default_value?: string
}

export interface BusinessPlanSection {
  id: string
  plan_id: string
  section_key: string
  section_title: string
  section_order: number
  content?: string
  content_html?: string
  ai_generated: boolean
  generation_prompt?: string
  source_facts?: string[]
  char_count: number
  max_char_limit?: number
  validation_status: ValidationStatus
  validation_messages: ValidationMessage[]
  manually_edited: boolean
  last_edited_by?: string
  has_placeholders: boolean
  placeholders: Placeholder[]
  created_at: string
  updated_at: string
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info'
  message: string
  field?: string
}

// =====================================================
// 팩트카드 관련 타입
// =====================================================

export interface CompanyFactCard {
  id: string
  company_id: string
  category: FactCategory
  subcategory?: string
  fact_key: string
  fact_value: string
  fact_type: FactType
  source?: string
  source_document_id?: string
  confidence_score: number
  embedding?: number[]
  embedding_model?: string
  is_verified: boolean
  verified_at?: string
  verified_by?: string
  version: number
  valid_from: string
  valid_until?: string
  created_at: string
  updated_at: string
}

export interface SectionFactMapping {
  id: string
  section_id: string
  fact_id: string
  relevance_score: number
  mapping_type: 'auto' | 'manual' | 'suggested'
  used_in_generation: boolean
  position_in_content?: number
  created_at: string
}

// =====================================================
// 질문 관련 타입
// =====================================================

export interface PlanQuestion {
  id: string
  plan_id: string
  section_id?: string
  question_text: string
  question_type: QuestionType
  options?: QuestionOption[]
  context?: string
  placeholder_id?: string
  answer?: string
  answered_at?: string
  answered_by?: string
  priority: 1 | 2 | 3 | 4 | 5
  is_required: boolean
  status: 'pending' | 'answered' | 'skipped' | 'auto_filled'
  created_at: string
  updated_at: string
}

export interface QuestionOption {
  value: string
  label: string
}

// =====================================================
// 버전 및 리뷰 관련 타입
// =====================================================

export interface PlanVersion {
  id: string
  plan_id: string
  version_number: number
  version_label?: string
  sections_snapshot: BusinessPlanSection[]
  metadata_snapshot?: Record<string, unknown>
  changes_summary?: string
  changed_by?: string
  change_type: 'auto_save' | 'manual_save' | 'review' | 'submission'
  created_at: string
}

export interface PlanReview {
  id: string
  plan_id: string
  section_id?: string
  reviewer_id: string
  reviewer_role?: string
  review_type: 'comment' | 'suggestion' | 'approval' | 'rejection'
  content?: string
  suggested_change?: string
  change_applied: boolean
  status: 'open' | 'resolved' | 'dismissed'
  resolved_at?: string
  created_at: string
}

// =====================================================
// 성공 패턴 관련 타입
// =====================================================

export interface SuccessPattern {
  id: string
  program_id?: string
  pattern_type: 'structure' | 'content' | 'keywords' | 'formatting'
  category?: string
  pattern_name: string
  pattern_description?: string
  pattern_data: Record<string, unknown>
  success_rate?: number
  sample_count: number
  application_guide?: string
  example_text?: string
  source_plans?: string[]
  created_at: string
  updated_at: string
}

// =====================================================
// 파이프라인 실행 관련 타입
// =====================================================

export interface PipelineExecutionLog {
  id: string
  plan_id: string
  stage: number
  stage_name: string
  status: 'started' | 'processing' | 'completed' | 'failed' | 'skipped'
  started_at: string
  completed_at?: string
  duration_ms?: number
  tokens_used: number
  cost: number
  input_data?: Record<string, unknown>
  output_data?: Record<string, unknown>
  error_message?: string
  created_at: string
}

export interface PipelineStageConfig {
  stage: PipelineStage
  name: string
  description: string
  required: boolean
  dependencies: PipelineStage[]
  estimatedDuration: number // seconds
  estimatedTokens: number
}

// 파이프라인 단계 설정
export const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    stage: 0,
    name: '성공 패턴 분석',
    description: '선정된 사업계획서 패턴 학습',
    required: false,
    dependencies: [],
    estimatedDuration: 30,
    estimatedTokens: 2000
  },
  {
    stage: 1,
    name: '공고문 양식 파싱',
    description: '공고문에서 작성 양식 및 요령 추출',
    required: true,
    dependencies: [],
    estimatedDuration: 60,
    estimatedTokens: 5000
  },
  {
    stage: 2,
    name: '회사 데이터 수집',
    description: '회사 내부 문서 및 데이터 수집/정제',
    required: true,
    dependencies: [1],
    estimatedDuration: 120,
    estimatedTokens: 3000
  },
  {
    stage: 3,
    name: '팩트카드 추출',
    description: 'Company Pack 팩트카드 생성',
    required: true,
    dependencies: [2],
    estimatedDuration: 90,
    estimatedTokens: 4000
  },
  {
    stage: 4,
    name: '섹션-팩트 매핑',
    description: '공고 항목과 팩트 간 매핑',
    required: true,
    dependencies: [1, 3],
    estimatedDuration: 45,
    estimatedTokens: 2000
  },
  {
    stage: 5,
    name: '섹션별 초안 생성',
    description: 'AI 기반 섹션별 콘텐츠 생성',
    required: true,
    dependencies: [4],
    estimatedDuration: 300,
    estimatedTokens: 15000
  },
  {
    stage: 6,
    name: '자동 검증',
    description: '작성요령/분량/양식 기준 검증',
    required: true,
    dependencies: [5],
    estimatedDuration: 30,
    estimatedTokens: 1000
  },
  {
    stage: 7,
    name: '미확정 정보 질문',
    description: '누락된 정보에 대한 질문 생성',
    required: false,
    dependencies: [6],
    estimatedDuration: 45,
    estimatedTokens: 2000
  },
  {
    stage: 8,
    name: '최종 문서 생성',
    description: 'PDF/HWP 형식으로 최종 출력',
    required: true,
    dependencies: [6],
    estimatedDuration: 60,
    estimatedTokens: 1000
  },
  {
    stage: 9,
    name: '평가 점수 시뮬레이션',
    description: '예상 평가 점수 산출',
    required: false,
    dependencies: [8],
    estimatedDuration: 30,
    estimatedTokens: 3000
  },
  {
    stage: 10,
    name: '협업 리뷰',
    description: '팀 리뷰 및 승인 프로세스',
    required: false,
    dependencies: [8],
    estimatedDuration: 0, // 사람이 처리
    estimatedTokens: 0
  },
  {
    stage: 11,
    name: '결과 피드백',
    description: '선정/탈락 결과 학습',
    required: false,
    dependencies: [],
    estimatedDuration: 30,
    estimatedTokens: 1000
  }
]

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface CreatePlanRequest {
  program_id: string
  title: string
  project_name?: string
}

export interface UpdateSectionRequest {
  content: string
  manually_edited?: boolean
}

export interface AnswerQuestionRequest {
  question_id: string
  answer: string
}

export interface RunPipelineRequest {
  plan_id: string
  stages?: PipelineStage[]
  options?: {
    skip_success_patterns?: boolean
    force_regenerate?: boolean
    dry_run?: boolean
  }
}

export interface PipelineProgress {
  plan_id: string
  current_stage: PipelineStage
  stage_name: string
  status: PipelineStatus
  completion_percentage: number
  stages_completed: PipelineStage[]
  stages_pending: PipelineStage[]
  estimated_remaining_seconds: number
  total_tokens_used: number
  total_cost: number
}
