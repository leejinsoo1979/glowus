// Database types for StartupShow
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
  project_id: string
  parent_task_id?: string
  assignee_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  labels: string[]
  start_date?: string
  end_date?: string
  estimated_hours?: number
  actual_hours?: number
  sprint_number?: number
  order_index?: number
  created_at: string
  updated_at: string
  // Relations
  project?: Project
  assignee?: User
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
