// Database types based on Supabase schema
// Auto-generated types for StartupShow

export type UserRole = 'FOUNDER' | 'TEAM_MEMBER' | 'INVESTOR' | 'ADMIN'
export type AccessStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'REVOKED'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type StartupStage = 'IDEA' | 'MVP' | 'EARLY' | 'GROWTH' | 'SCALE'

// ============================================
// Table Types
// ============================================

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Startup {
  id: string
  name: string
  description: string | null
  industry: string
  stage: StartupStage
  founded_at: string | null
  website: string | null
  logo_url: string | null

  // Business metrics
  monthly_revenue: number
  monthly_burn: number
  runway_months: number | null
  total_funding: number
  employee_count: number

  // Location
  country: string
  city: string | null

  // Owner
  founder_id: string

  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  startup_id: string
  user_id: string
  role: string
  joined_at: string
}

export interface Task {
  id: string
  startup_id: string
  author_id: string

  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority

  // Time tracking
  estimated_hours: number | null
  actual_hours: number | null
  due_date: string | null
  completed_at: string | null

  // Categorization
  category: string | null
  tags: string[] | null

  // AI analysis
  ai_summary: string | null
  impact_score: number | null

  created_at: string
  updated_at: string
}

export interface Update {
  id: string
  startup_id: string
  author_id: string

  title: string
  content: string

  // Metrics snapshot
  metrics: Record<string, unknown>

  // AI generated content
  ai_generated: boolean
  ai_summary: string | null

  // Visibility
  is_public: boolean

  created_at: string
  updated_at: string
}

export interface InvestorAccess {
  id: string
  startup_id: string
  investor_id: string

  status: AccessStatus

  // Access control
  requested_at: string
  approved_at: string | null
  expires_at: string | null

  // Access scope
  can_view_financials: boolean
  can_view_team: boolean
  can_view_tasks: boolean
  can_download_reports: boolean

  // Notes
  request_message: string | null
  response_message: string | null
}

export interface KpiMetric {
  id: string
  startup_id: string

  metric_type: string
  metric_value: number
  metric_unit: string | null

  period_start: string
  period_end: string

  created_at: string
}

// ============================================
// Join Types (with relations)
// ============================================

export interface UserWithStartups extends User {
  startups: Startup[]
  team_memberships: (TeamMember & { startup: Startup })[]
}

export interface StartupWithTeam extends Startup {
  founder: User
  team_members: (TeamMember & { user: User })[]
}

export interface StartupWithMetrics extends Startup {
  founder: User
  tasks_completed: number
  tasks_total: number
  team_size: number
  recent_updates: Update[]
}

export interface TaskWithAuthor extends Task {
  author: User
}

export interface UpdateWithAuthor extends Update {
  author: User
}

export interface InvestorAccessWithDetails extends InvestorAccess {
  startup: Startup
  investor: User
}

// ============================================
// Input Types (for mutations)
// ============================================

export interface CreateUserInput {
  email: string
  name: string
  role?: UserRole
  avatar_url?: string
  phone?: string
}

export interface UpdateUserInput {
  name?: string
  avatar_url?: string
  phone?: string
}

export interface CreateStartupInput {
  name: string
  description?: string
  industry: string
  stage?: StartupStage
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
}

export interface UpdateStartupInput extends Partial<CreateStartupInput> {}

export interface CreateTaskInput {
  startup_id: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  estimated_hours?: number
  due_date?: string
  category?: string
  tags?: string[]
}

export interface UpdateTaskInput extends Partial<Omit<CreateTaskInput, 'startup_id'>> {
  actual_hours?: number
  completed_at?: string
  ai_summary?: string
  impact_score?: number
}

export interface CreateUpdateInput {
  startup_id: string
  title: string
  content: string
  metrics?: Record<string, unknown>
  is_public?: boolean
}

export interface CreateInvestorAccessInput {
  startup_id: string
  request_message?: string
}

export interface CreateKpiMetricInput {
  startup_id: string
  metric_type: string
  metric_value: number
  metric_unit?: string
  period_start: string
  period_end: string
}

export interface RespondInvestorAccessInput {
  status: 'APPROVED' | 'DENIED'
  response_message?: string
  expires_at?: string
  can_view_financials?: boolean
  can_view_team?: boolean
  can_view_tasks?: boolean
  can_download_reports?: boolean
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardMetrics {
  sprintProgress: number
  tasksCompleted: number
  tasksTotal: number
  commitCount: number
  riskIndex: number
  productivityScore: number
}

export interface RecentCommit {
  id: string
  description: string
  user_name: string
  created_at: string
  impact_level?: 'high' | 'medium' | 'low'
}

export interface UrgentTask {
  id: string
  title: string
  status: string
  priority: string
  assignee_name?: string
}

// ============================================
// Supabase Database Type
// ============================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: CreateUserInput & { id: string }
        Update: UpdateUserInput
      }
      startups: {
        Row: Startup
        Insert: CreateStartupInput & { founder_id: string }
        Update: UpdateStartupInput
      }
      team_members: {
        Row: TeamMember
        Insert: Omit<TeamMember, 'id' | 'joined_at'>
        Update: { role?: string }
      }
      tasks: {
        Row: Task
        Insert: CreateTaskInput & { author_id: string }
        Update: UpdateTaskInput
      }
      updates: {
        Row: Update
        Insert: CreateUpdateInput & { author_id: string }
        Update: Partial<CreateUpdateInput>
      }
      investor_access: {
        Row: InvestorAccess
        Insert: CreateInvestorAccessInput & { investor_id: string }
        Update: RespondInvestorAccessInput
      }
      kpi_metrics: {
        Row: KpiMetric
        Insert: Omit<KpiMetric, 'id' | 'created_at'>
        Update: never
      }
    }
    Views: {
      startup_summary: {
        Row: {
          id: string
          name: string
          industry: string
          stage: StartupStage
          monthly_revenue: number
          employee_count: number
          founder_name: string
          founder_email: string
          team_size: number
          completed_tasks: number
          total_tasks: number
          created_at: string
        }
      }
    }
    Enums: {
      user_role: UserRole
      access_status: AccessStatus
      task_status: TaskStatus
      task_priority: TaskPriority
      startup_stage: StartupStage
    }
  }
}
