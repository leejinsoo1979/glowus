-- Teams table for team management feature
-- Separate from startups for team collaboration

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    industry TEXT,
    work_style TEXT DEFAULT 'agile' CHECK (work_style IN ('agile', 'waterfall', 'hybrid')),
    website TEXT,
    logo_url TEXT,
    founder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_open_call BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modify team_members to support both startups and teams
-- Add team_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'team_members'
                   AND column_name = 'team_id') THEN
        ALTER TABLE public.team_members ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Make startup_id nullable since team_members can now belong to either
ALTER TABLE public.team_members ALTER COLUMN startup_id DROP NOT NULL;

-- Add constraint that either startup_id or team_id must be set
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_has_parent;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_has_parent
    CHECK (startup_id IS NOT NULL OR team_id IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_founder ON public.teams(founder_id);
CREATE INDEX IF NOT EXISTS idx_teams_industry ON public.teams(industry);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Policies for teams
DROP POLICY IF EXISTS "Founders can manage their teams" ON public.teams;
CREATE POLICY "Founders can manage their teams"
    ON public.teams FOR ALL
    USING (auth.uid() = founder_id);

DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
CREATE POLICY "Team members can view their team"
    ON public.teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = teams.id AND user_id = auth.uid()
        )
    );

-- Policy for team_members with teams
DROP POLICY IF EXISTS "Team founders can manage team members" ON public.team_members;
CREATE POLICY "Team founders can manage team members"
    ON public.team_members FOR ALL
    USING (
        team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = team_members.team_id
            AND founder_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Team members can view other members" ON public.team_members;
CREATE POLICY "Team members can view other members"
    ON public.team_members FOR SELECT
    USING (
        team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
