// Database types for Glowus
// Auto-generate with: npx supabase gen types typescript --local > types/database.ts

// Re-export database types
export * from './database'

// Legacy compatibility - map old roles to new
export type UserRole = 'FOUNDER' | 'TEAM_MEMBER' | 'INVESTOR' | 'ADMIN'
export type WorkStyle = 'agile' | 'waterfall'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ImpactLevel = 'low' | 'medium' | 'high'
export type VCRequestStatus = 'pending' | 'approved' | 'rejected'
export type PipelineStage = 'interested' | 'contacted' | 'meeting' | 'due_diligence' | 'negotiation' | 'invested' | 'passed'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string
  company?: string
  bio?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface Startup {
  id: string
  name: string
  description?: string
  industry: string
  stage: 'IDEA' | 'MVP' | 'EARLY' | 'GROWTH' | 'SCALE'
  founded_at?: string
  website?: string
  logo_url?: string
  monthly_revenue?: number
  monthly_burn?: number
  runway_months?: number
  total_funding?: number
  employee_count?: number
  country?: string
  city?: string
  founder_id: string
  created_at: string
  updated_at: string
  // Relations
  founder?: User
  team_members?: TeamMember[]
}

export interface Team {
  id: string
  name: string
  founder_id: string
  work_style: WorkStyle
  team_size?: string
  business_type?: string
  industry?: string
  description?: string
  logo_url?: string
  website?: string
  funding_stage?: string
  is_open_call: boolean
  is_public: boolean
  mrr?: number
  arr?: number
  total_funding?: number
  created_at: string
  updated_at: string
  // Relations
  founder?: User
  team_members?: TeamMember[]
  projects?: Project[]
}

export interface TeamMember {
  id: string
  user_id: string
  team_id: string
  role: 'founder' | 'admin' | 'member'
  position?: string
  joined_at: string
  // Relations
  user?: User
  team?: Team
}

export interface Project {
  id: string
  team_id: string
  name: string
  description?: string
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  deadline?: string
  risk_score: number
  progress: number
  sprint_number: number
  sprint_start_date?: string
  sprint_end_date?: string
  created_at: string
  updated_at: string
  // Relations
  team?: Team
  tasks?: Task[]
}

export interface Task {
  id: string
  project_id?: string
  startup_id?: string
  parent_task_id?: string
  assignee_id?: string
  author_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  labels?: string[]
  tags?: string[]
  category?: string
  start_date?: string
  end_date?: string
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  completed_at?: string
  sprint_number?: number
  order_index?: number
  ai_summary?: string
  impact_score?: number
  created_at: string
  updated_at?: string
  // Relations
  project?: Project
  assignee?: User
  author?: User
  commits?: Commit[]
}

export interface Commit {
  id: string
  user_id: string
  task_id?: string
  team_id: string
  description: string
  impact_level?: ImpactLevel
  next_action?: string
  files: { name: string; url: string; type: string; size: number }[]
  ai_summary?: string
  ai_insights?: Record<string, any>
  created_at: string
  // Relations
  user?: User
  task?: Task
}

export interface VCRequest {
  id: string
  team_id: string
  vc_user_id: string
  status: VCRequestStatus
  message?: string
  response_message?: string
  permission_level: 'basic' | 'detailed' | 'full'
  expires_at?: string
  created_at: string
  updated_at: string
  // Relations
  team?: Team
  vc_user?: User
}

export interface VCPipeline {
  id: string
  vc_user_id: string
  team_id: string
  stage: PipelineStage
  notes?: string
  tags: string[]
  priority: number
  last_contacted_at?: string
  created_at: string
  updated_at: string
  // Relations
  team?: Team
}

export interface Summary {
  id: string
  team_id: string
  project_id?: string
  type: 'daily' | 'weekly' | 'monthly' | 'sprint' | 'commit' | 'risk'
  content: string
  highlights?: Record<string, any>
  risks?: Record<string, any>
  recommendations?: Record<string, any>
  metrics?: Record<string, any>
  period_start?: string
  period_end?: string
  created_at: string
}

export interface DashboardMetrics {
  id: string
  team_id: string
  date: string
  sprint_number?: number
  sprint_progress?: number
  commit_count: number
  tasks_completed: number
  tasks_total: number
  productivity_score?: number
  risk_index?: number
  lead_time_avg?: number
  cycle_time_avg?: number
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'task_assigned' | 'task_completed' | 'commit' | 'vc_request' | 'vc_approved' | 'mention' | 'system'
  title: string
  message?: string
  link?: string
  is_read: boolean
  metadata?: Record<string, any>
  created_at: string
}

// User Profile types (마이페이지)
export interface UserProfileService {
  icon: string
  title: string
  description: string
}

export interface UserProfileAchievement {
  label: string
  value: string
}

export interface UserProfileEducation {
  title: string
  period: string
  description: string
}

export interface UserProfileExperience {
  title: string
  company: string
  period: string
  description: string
}

export interface UserProfileSkill {
  name: string
  level: number
}

export interface UserProfilePortfolio {
  id?: string
  title: string
  category: string
  image?: string
  description: string
  status: string
}

export interface UserProfile {
  id: string
  user_id: string
  // 기본 정보
  title?: string
  birthday?: string
  location?: string
  // 소셜 링크
  github_url?: string
  twitter_url?: string
  linkedin_url?: string
  website_url?: string
  // About 섹션
  bio?: string[]
  services?: UserProfileService[]
  achievements?: UserProfileAchievement[]
  // Resume 섹션
  education?: UserProfileEducation[]
  experience?: UserProfileExperience[]
  skills?: UserProfileSkill[]
  // Portfolio 섹션
  portfolio?: UserProfilePortfolio[]
  // Contact 섹션
  calendly_url?: string
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  // 타임스탬프
  created_at: string
  updated_at: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}
