-- Projects System Migration
-- 프로젝트 관리 시스템: 프로젝트 생성, 팀원 투입, 에이전트 투입

-- 1. Projects 테이블
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    start_date DATE,
    end_date DATE,
    deadline DATE,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    budget DECIMAL(15, 2),
    tags TEXT[] DEFAULT '{}',
    color TEXT DEFAULT '#8B5CF6',
    owner_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Project Members 테이블 (프로젝트에 투입된 팀원)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'observer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 3. Project Agents 테이블 (프로젝트에 투입된 AI 에이전트)
CREATE TABLE IF NOT EXISTS public.project_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'assistant',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(project_id, agent_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_agents_project_id ON public.project_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_agents_agent_id ON public.project_agents(agent_id);

-- RLS 활성화
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_agents ENABLE ROW LEVEL SECURITY;

-- Projects RLS 정책
CREATE POLICY "Users can view projects in their teams" ON public.projects
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        )
        OR owner_id = auth.uid()
    );

CREATE POLICY "Team members can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Project owners and leads can update" ON public.projects
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR id IN (
            SELECT project_id FROM public.project_members
            WHERE user_id = auth.uid() AND role = 'lead'
        )
    );

CREATE POLICY "Project owners can delete" ON public.projects
    FOR DELETE USING (owner_id = auth.uid());

-- Project Members RLS 정책
CREATE POLICY "Users can view project members" ON public.project_members
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects WHERE team_id IN (
                SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project leads can manage members" ON public.project_members
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members
            WHERE user_id = auth.uid() AND role = 'lead'
        )
    );

-- Project Agents RLS 정책
CREATE POLICY "Users can view project agents" ON public.project_agents
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects WHERE team_id IN (
                SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project leads can manage agents" ON public.project_agents
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members
            WHERE user_id = auth.uid() AND role = 'lead'
        )
    );

-- Updated_at 트리거
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_projects_updated_at();

-- 서비스 롤 정책 (개발용)
CREATE POLICY "Service role full access to projects" ON public.projects
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to project_members" ON public.project_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to project_agents" ON public.project_agents
    FOR ALL USING (true) WITH CHECK (true);
