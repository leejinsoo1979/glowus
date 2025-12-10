-- StartupShow Database Schema
-- Version: 1.0.0
-- Description: Complete database schema for startup management and investor matching platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('founder', 'member', 'vc')),
  avatar_url TEXT,
  company TEXT, -- For VC users
  bio TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view other users in same team"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = users.id
    )
  );

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  founder_id UUID REFERENCES public.users(id),
  work_style TEXT NOT NULL CHECK (work_style IN ('agile', 'waterfall')),
  team_size TEXT CHECK (team_size IN ('1-3', '4-7', '8-15', '15+')),
  business_type TEXT,
  industry TEXT,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  funding_stage TEXT CHECK (funding_stage IN ('pre-seed', 'seed', 'series-a', 'series-b', 'series-c+')),
  is_open_call BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  mrr DECIMAL,
  arr DECIMAL,
  total_funding DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teams_founder ON public.teams(founder_id);
CREATE INDEX idx_teams_is_open_call ON public.teams(is_open_call) WHERE is_open_call = TRUE;
CREATE INDEX idx_teams_is_public ON public.teams(is_public) WHERE is_public = TRUE;

-- RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = auth.uid()
    )
    OR is_public = TRUE
    OR (
      -- VCs can view teams they have approved access to
      EXISTS (
        SELECT 1 FROM vc_requests
        WHERE team_id = teams.id 
        AND vc_user_id = auth.uid() 
        AND status = 'approved'
      )
    )
  );

CREATE POLICY "Founders can update their teams"
  ON public.teams FOR UPDATE
  USING (founder_id = auth.uid());

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('founder', 'admin', 'member')),
  position TEXT, -- Job title
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- Indexes
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team's members"
  ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team founders/admins can manage members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('founder', 'admin')
    )
  );

-- ============================================
-- TEMPLATES TABLE
-- ============================================
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'web', 'mobile', 'saas', 'hardware', etc.
  work_style TEXT NOT NULL CHECK (work_style IN ('agile', 'waterfall')),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEMPLATE TASKS TABLE
-- ============================================
CREATE TABLE public.template_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT, -- 'planning', 'design', 'development', 'testing', 'deployment'
  duration_days INTEGER,
  order_index INTEGER,
  dependencies JSONB -- Array of task IDs this depends on
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  deadline DATE,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sprint_number INTEGER DEFAULT 1,
  sprint_start_date DATE,
  sprint_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_team ON public.projects(team_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = projects.team_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can manage projects"
  ON public.projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = projects.team_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id), -- For subtasks
  assignee_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  labels JSONB DEFAULT '[]', -- Array of label strings
  start_date DATE,
  end_date DATE,
  estimated_hours DECIMAL,
  actual_hours DECIMAL,
  sprint_number INTEGER,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_sprint ON public.tasks(sprint_number);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = tasks.project_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can manage tasks"
  ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = tasks.project_id AND tm.user_id = auth.uid()
    )
  );

-- ============================================
-- COMMITS TABLE
-- ============================================
CREATE TABLE public.commits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high')),
  next_action TEXT,
  files JSONB DEFAULT '[]', -- [{name, url, type, size}]
  ai_summary TEXT, -- AI-generated summary
  ai_insights JSONB, -- AI analysis results
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_commits_user ON public.commits(user_id);
CREATE INDEX idx_commits_task ON public.commits(task_id);
CREATE INDEX idx_commits_team ON public.commits(team_id);
CREATE INDEX idx_commits_created ON public.commits(created_at DESC);

-- RLS
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view commits"
  ON public.commits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = commits.team_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create commits for their teams"
  ON public.commits FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = commits.team_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- VC REQUESTS TABLE
-- ============================================
CREATE TABLE public.vc_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  vc_user_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT, -- Request message from VC
  response_message TEXT, -- Response from founder
  permission_level TEXT DEFAULT 'basic' CHECK (permission_level IN ('basic', 'detailed', 'full')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, vc_user_id)
);

-- Indexes
CREATE INDEX idx_vc_requests_team ON public.vc_requests(team_id);
CREATE INDEX idx_vc_requests_vc ON public.vc_requests(vc_user_id);
CREATE INDEX idx_vc_requests_status ON public.vc_requests(status);

-- RLS
ALTER TABLE public.vc_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VCs can view their own requests"
  ON public.vc_requests FOR SELECT
  USING (vc_user_id = auth.uid());

CREATE POLICY "Team founders can view requests for their teams"
  ON public.vc_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = vc_requests.team_id AND founder_id = auth.uid()
    )
  );

CREATE POLICY "VCs can create requests"
  ON public.vc_requests FOR INSERT
  WITH CHECK (vc_user_id = auth.uid());

CREATE POLICY "Team founders can update requests"
  ON public.vc_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = vc_requests.team_id AND founder_id = auth.uid()
    )
  );

-- ============================================
-- VC PIPELINE TABLE
-- ============================================
CREATE TABLE public.vc_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vc_user_id UUID NOT NULL REFERENCES public.users(id),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  stage TEXT DEFAULT 'interested' CHECK (stage IN ('interested', 'contacted', 'meeting', 'due_diligence', 'negotiation', 'invested', 'passed')),
  notes TEXT,
  tags JSONB DEFAULT '[]',
  priority INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vc_user_id, team_id)
);

-- RLS
ALTER TABLE public.vc_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VCs can manage their pipeline"
  ON public.vc_pipeline FOR ALL
  USING (vc_user_id = auth.uid());

-- ============================================
-- SUMMARIES TABLE (AI Generated)
-- ============================================
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'sprint', 'commit', 'risk')),
  content TEXT NOT NULL,
  highlights JSONB, -- Key points, achievements
  risks JSONB, -- Identified risks
  recommendations JSONB, -- AI recommendations
  metrics JSONB, -- Relevant metrics at time of summary
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_summaries_team ON public.summaries(team_id);
CREATE INDEX idx_summaries_project ON public.summaries(project_id);
CREATE INDEX idx_summaries_type ON public.summaries(type);
CREATE INDEX idx_summaries_created ON public.summaries(created_at DESC);

-- RLS
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view summaries"
  ON public.summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = summaries.team_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- EMBEDDINGS TABLE (for RAG)
-- ============================================
CREATE TABLE public.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('commit', 'task', 'summary', 'document')),
  content_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index for similarity search
CREATE INDEX idx_embeddings_vector ON public.embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_embeddings_team ON public.embeddings(team_id);
CREATE INDEX idx_embeddings_type ON public.embeddings(content_type);

-- ============================================
-- DASHBOARD METRICS TABLE
-- ============================================
CREATE TABLE public.dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sprint_number INTEGER,
  sprint_progress INTEGER,
  commit_count INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  productivity_score INTEGER, -- 0-100
  risk_index INTEGER, -- 0-100
  lead_time_avg DECIMAL, -- Average hours from start to done
  cycle_time_avg DECIMAL, -- Average hours in progress
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, date)
);

-- Index
CREATE INDEX idx_dashboard_metrics_team_date ON public.dashboard_metrics(team_id, date DESC);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'commit', 'vc_request', 'vc_approved', 'mention', 'system')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT, -- URL to navigate to
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vc_requests_updated_at BEFORE UPDATE ON public.vc_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vc_pipeline_updated_at BEFORE UPDATE ON public.vc_pipeline
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to auto-add founder as team member
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (user_id, team_id, role)
  VALUES (NEW.founder_id, NEW.id, 'founder');
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default templates
INSERT INTO public.templates (id, name, description, category, work_style, is_default) VALUES
  (uuid_generate_v4(), '웹서비스 MVP', 'MVP 개발을 위한 기본 템플릿', 'web', 'agile', true),
  (uuid_generate_v4(), '모바일 앱 개발', '모바일 앱 개발 프로젝트 템플릿', 'mobile', 'agile', false),
  (uuid_generate_v4(), 'SaaS 런칭', 'SaaS 제품 런칭을 위한 템플릿', 'saas', 'agile', false),
  (uuid_generate_v4(), '전통적 개발', '워터폴 방식의 개발 템플릿', 'general', 'waterfall', false);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
