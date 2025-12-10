-- StartupShow Initial Schema
-- Based on Developguide.md specifications

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM ('FOUNDER', 'TEAM_MEMBER', 'INVESTOR', 'ADMIN');

-- Investor access status
CREATE TYPE access_status AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED');

-- Task status
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- Task priority
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Startup stage
CREATE TYPE startup_stage AS ENUM ('IDEA', 'MVP', 'EARLY', 'GROWTH', 'SCALE');

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'FOUNDER',
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Startups table
CREATE TABLE public.startups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    industry TEXT NOT NULL,
    stage startup_stage NOT NULL DEFAULT 'IDEA',
    founded_at DATE,
    website TEXT,
    logo_url TEXT,

    -- Business metrics
    monthly_revenue BIGINT DEFAULT 0,
    monthly_burn BIGINT DEFAULT 0,
    runway_months INTEGER,
    total_funding BIGINT DEFAULT 0,
    employee_count INTEGER DEFAULT 1,

    -- Location
    country TEXT DEFAULT 'KR',
    city TEXT,

    -- Owner
    founder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members table
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- e.g., 'CTO', 'CPO', 'Developer'
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(startup_id, user_id)
);

-- Tasks table (work logs / commits)
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'TODO',
    priority task_priority NOT NULL DEFAULT 'MEDIUM',

    -- Time tracking
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    due_date DATE,
    completed_at TIMESTAMPTZ,

    -- Categorization
    category TEXT, -- e.g., 'development', 'design', 'marketing'
    tags TEXT[],

    -- AI analysis
    ai_summary TEXT,
    impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updates table (investor updates / reports)
CREATE TABLE public.updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    content TEXT NOT NULL,

    -- Metrics snapshot
    metrics JSONB DEFAULT '{}',

    -- AI generated content
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_summary TEXT,

    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investor access table
CREATE TABLE public.investor_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    status access_status NOT NULL DEFAULT 'PENDING',

    -- Access control
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Access scope
    can_view_financials BOOLEAN DEFAULT FALSE,
    can_view_team BOOLEAN DEFAULT TRUE,
    can_view_tasks BOOLEAN DEFAULT FALSE,
    can_download_reports BOOLEAN DEFAULT FALSE,

    -- Notes
    request_message TEXT,
    response_message TEXT,

    UNIQUE(startup_id, investor_id)
);

-- KPI metrics table (for historical tracking)
CREATE TABLE public.kpi_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,

    -- Metrics
    metric_type TEXT NOT NULL, -- e.g., 'revenue', 'users', 'churn'
    metric_value DECIMAL(15,2) NOT NULL,
    metric_unit TEXT, -- e.g., 'KRW', 'count', 'percent'

    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(startup_id, metric_type, period_start)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_startups_founder ON public.startups(founder_id);
CREATE INDEX idx_startups_industry ON public.startups(industry);
CREATE INDEX idx_startups_stage ON public.startups(stage);

CREATE INDEX idx_team_members_startup ON public.team_members(startup_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

CREATE INDEX idx_tasks_startup ON public.tasks(startup_id);
CREATE INDEX idx_tasks_author ON public.tasks(author_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created ON public.tasks(created_at DESC);

CREATE INDEX idx_updates_startup ON public.updates(startup_id);
CREATE INDEX idx_updates_created ON public.updates(created_at DESC);

CREATE INDEX idx_investor_access_startup ON public.investor_access(startup_id);
CREATE INDEX idx_investor_access_investor ON public.investor_access(investor_id);
CREATE INDEX idx_investor_access_status ON public.investor_access(status);

CREATE INDEX idx_kpi_metrics_startup ON public.kpi_metrics(startup_id);
CREATE INDEX idx_kpi_metrics_type ON public.kpi_metrics(metric_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_metrics ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Startups policies
CREATE POLICY "Founders can manage their startups"
    ON public.startups FOR ALL
    USING (auth.uid() = founder_id);

CREATE POLICY "Team members can view their startup"
    ON public.startups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE startup_id = startups.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Approved investors can view startup"
    ON public.startups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.investor_access
            WHERE startup_id = startups.id
            AND investor_id = auth.uid()
            AND status = 'APPROVED'
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- Tasks policies
CREATE POLICY "Startup members can view tasks"
    ON public.tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            LEFT JOIN public.team_members tm ON tm.startup_id = s.id
            WHERE s.id = tasks.startup_id
            AND (s.founder_id = auth.uid() OR tm.user_id = auth.uid())
        )
    );

CREATE POLICY "Startup members can manage tasks"
    ON public.tasks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            LEFT JOIN public.team_members tm ON tm.startup_id = s.id
            WHERE s.id = tasks.startup_id
            AND (s.founder_id = auth.uid() OR tm.user_id = auth.uid())
        )
    );

-- Updates policies
CREATE POLICY "Startup members can manage updates"
    ON public.updates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            LEFT JOIN public.team_members tm ON tm.startup_id = s.id
            WHERE s.id = updates.startup_id
            AND (s.founder_id = auth.uid() OR tm.user_id = auth.uid())
        )
    );

CREATE POLICY "Approved investors can view updates"
    ON public.updates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.investor_access
            WHERE startup_id = updates.startup_id
            AND investor_id = auth.uid()
            AND status = 'APPROVED'
        )
    );

-- Investor access policies
CREATE POLICY "Founders can manage investor access"
    ON public.investor_access FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.startups
            WHERE id = investor_access.startup_id
            AND founder_id = auth.uid()
        )
    );

CREATE POLICY "Investors can view their own access requests"
    ON public.investor_access FOR SELECT
    USING (investor_id = auth.uid());

CREATE POLICY "Investors can create access requests"
    ON public.investor_access FOR INSERT
    WITH CHECK (investor_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startups_updated_at
    BEFORE UPDATE ON public.startups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_updates_updated_at
    BEFORE UPDATE ON public.updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'FOUNDER')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- VIEWS
-- ============================================

-- Startup summary view
CREATE VIEW public.startup_summary AS
SELECT
    s.id,
    s.name,
    s.industry,
    s.stage,
    s.monthly_revenue,
    s.employee_count,
    u.name as founder_name,
    u.email as founder_email,
    (SELECT COUNT(*) FROM public.team_members WHERE startup_id = s.id) as team_size,
    (SELECT COUNT(*) FROM public.tasks WHERE startup_id = s.id AND status = 'DONE') as completed_tasks,
    (SELECT COUNT(*) FROM public.tasks WHERE startup_id = s.id) as total_tasks,
    s.created_at
FROM public.startups s
JOIN public.users u ON s.founder_id = u.id;
