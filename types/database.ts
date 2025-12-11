// Database types based on Supabase schema
// Auto-generated types for StartupShow

export type UserRole = 'FOUNDER' | 'TEAM_MEMBER' | 'INVESTOR' | 'ADMIN'
export type AccessStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'REVOKED'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type StartupStage = 'IDEA' | 'MVP' | 'EARLY' | 'GROWTH' | 'SCALE'

// Agent System Types
export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'ERROR'
export type AgentMessageType = 'USER_TO_AGENT' | 'AGENT_TO_USER' | 'AGENT_TO_AGENT' | 'SYSTEM'
export type AgentTaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

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

export interface Commit {
  id: string
  user_id: string
  team_id: string
  task_id: string | null

  description: string
  impact_level: 'low' | 'medium' | 'high'
  next_action: string | null
  files: string[] | null

  created_at: string
}

// ============================================
// Agent System Types
// ============================================

export interface DeployedAgent {
  id: string
  name: string
  description: string | null

  // Owner
  owner_id: string
  startup_id: string | null

  // Workflow definition (ReactFlow JSON)
  workflow_nodes: Record<string, unknown>[]
  workflow_edges: Record<string, unknown>[]

  // Agent capabilities
  capabilities: string[]

  // Status
  status: AgentStatus
  last_active_at: string | null

  // Avatar for chat
  avatar_url: string | null

  // Execution context
  system_prompt: string | null
  model: string
  temperature: number

  created_at: string
  updated_at: string
}

export interface AgentTeam {
  id: string
  name: string
  description: string | null

  // Owner
  owner_id: string
  startup_id: string | null

  created_at: string
  updated_at: string
}

export interface AgentTeamMember {
  id: string
  team_id: string
  agent_id: string

  // Role in team (e.g., 'developer', 'reviewer', 'project_manager')
  role: string

  joined_at: string
}

export interface AgentMessage {
  id: string

  // Conversation tracking
  conversation_id: string

  // Sender (either user or agent)
  sender_type: 'USER' | 'AGENT'
  sender_user_id: string | null
  sender_agent_id: string | null

  // Receiver (either user or agent)
  receiver_type: 'USER' | 'AGENT'
  receiver_user_id: string | null
  receiver_agent_id: string | null

  // Message content
  message_type: AgentMessageType
  content: string

  // Optional metadata (tool calls, function results, etc.)
  metadata: Record<string, unknown> | null

  // Optional task reference
  task_id: string | null

  created_at: string
}

export interface AgentConversation {
  id: string

  // Participants
  user_id: string
  agent_ids: string[]

  // Context
  title: string | null
  startup_id: string | null

  // Status
  is_active: boolean

  created_at: string
  updated_at: string
}

export interface AgentTask {
  id: string

  // Task info
  title: string
  description: string | null
  instructions: string

  // Assignment
  assigner_type: 'USER' | 'AGENT'
  assigner_user_id: string | null
  assigner_agent_id: string | null
  assignee_agent_id: string

  // Status
  status: AgentTaskStatus

  // Results
  result: string | null
  error: string | null

  // Context
  conversation_id: string | null
  startup_id: string | null

  // Time tracking
  started_at: string | null
  completed_at: string | null

  created_at: string
  updated_at: string
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
        Insert: {
          id: string
          email: string
          name: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      startups: {
        Row: Startup
        Insert: {
          id?: string
          name: string
          description?: string | null
          industry: string
          stage?: StartupStage
          founded_at?: string | null
          website?: string | null
          logo_url?: string | null
          monthly_revenue?: number
          monthly_burn?: number
          runway_months?: number | null
          total_funding?: number
          employee_count?: number
          country?: string
          city?: string | null
          founder_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          industry?: string
          stage?: StartupStage
          founded_at?: string | null
          website?: string | null
          logo_url?: string | null
          monthly_revenue?: number
          monthly_burn?: number
          runway_months?: number | null
          total_funding?: number
          employee_count?: number
          country?: string
          city?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startups_founder_id_fkey"
            columns: ["founder_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      team_members: {
        Row: TeamMember
        Insert: {
          id?: string
          startup_id: string
          user_id: string
          role: string
          joined_at?: string
        }
        Update: {
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_startup_id_fkey"
            columns: ["startup_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: Task
        Insert: {
          id?: string
          startup_id: string
          author_id: string
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          estimated_hours?: number | null
          actual_hours?: number | null
          due_date?: string | null
          completed_at?: string | null
          category?: string | null
          tags?: string[] | null
          ai_summary?: string | null
          impact_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          estimated_hours?: number | null
          actual_hours?: number | null
          due_date?: string | null
          completed_at?: string | null
          category?: string | null
          tags?: string[] | null
          ai_summary?: string | null
          impact_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_startup_id_fkey"
            columns: ["startup_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      updates: {
        Row: Update
        Insert: {
          id?: string
          startup_id: string
          author_id: string
          title: string
          content: string
          metrics?: Record<string, unknown>
          ai_generated?: boolean
          ai_summary?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          content?: string
          metrics?: Record<string, unknown>
          ai_generated?: boolean
          ai_summary?: string | null
          is_public?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "updates_startup_id_fkey"
            columns: ["startup_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      investor_access: {
        Row: InvestorAccess
        Insert: {
          id?: string
          startup_id: string
          investor_id: string
          status?: AccessStatus
          requested_at?: string
          approved_at?: string | null
          expires_at?: string | null
          can_view_financials?: boolean
          can_view_team?: boolean
          can_view_tasks?: boolean
          can_download_reports?: boolean
          request_message?: string | null
          response_message?: string | null
        }
        Update: {
          status?: AccessStatus
          approved_at?: string | null
          expires_at?: string | null
          can_view_financials?: boolean
          can_view_team?: boolean
          can_view_tasks?: boolean
          can_download_reports?: boolean
          response_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_access_startup_id_fkey"
            columns: ["startup_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_access_investor_id_fkey"
            columns: ["investor_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      kpi_metrics: {
        Row: KpiMetric
        Insert: {
          id?: string
          startup_id: string
          metric_type: string
          metric_value: number
          metric_unit?: string | null
          period_start: string
          period_end: string
          created_at?: string
        }
        Update: {
          metric_type?: string
          metric_value?: number
          metric_unit?: string | null
          period_start?: string
          period_end?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_metrics_startup_id_fkey"
            columns: ["startup_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          }
        ]
      }
      commits: {
        Row: Commit
        Insert: {
          id?: string
          user_id: string
          team_id: string
          task_id?: string | null
          description: string
          impact_level?: 'low' | 'medium' | 'high'
          next_action?: string | null
          files?: string[] | null
          created_at?: string
        }
        Update: {
          task_id?: string | null
          description?: string
          impact_level?: 'low' | 'medium' | 'high'
          next_action?: string | null
          files?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "commits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commits_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commits_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          founder_id: string
          work_style: string
          team_size: string | null
          business_type: string | null
          industry: string | null
          description: string | null
          logo_url: string | null
          website: string | null
          funding_stage: string | null
          is_open_call: boolean
          is_public: boolean
          mrr: number | null
          arr: number | null
          total_funding: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          founder_id: string
          work_style?: string
          team_size?: string | null
          business_type?: string | null
          industry?: string | null
          description?: string | null
          logo_url?: string | null
          website?: string | null
          funding_stage?: string | null
          is_open_call?: boolean
          is_public?: boolean
          mrr?: number | null
          arr?: number | null
          total_funding?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          work_style?: string
          team_size?: string | null
          business_type?: string | null
          industry?: string | null
          description?: string | null
          logo_url?: string | null
          website?: string | null
          funding_stage?: string | null
          is_open_call?: boolean
          is_public?: boolean
          mrr?: number | null
          arr?: number | null
          total_funding?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_founder_id_fkey"
            columns: ["founder_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      access_status: AccessStatus
      task_status: TaskStatus
      task_priority: TaskPriority
      startup_stage: StartupStage
    }
    CompositeTypes: Record<string, never>
  }
}
