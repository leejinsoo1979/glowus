-- =====================================================
-- Fix startups and related tables RLS infinite recursion
-- 문제: startups 정책에서 team_members를 직접 조회하면서 재귀 발생
-- 해결: SECURITY DEFINER 함수 활용
-- =====================================================

-- 1. 기존 startups 정책 삭제
DROP POLICY IF EXISTS "Founders can manage their startups" ON public.startups;
DROP POLICY IF EXISTS "Team members can view their startup" ON public.startups;
DROP POLICY IF EXISTS "Approved investors can view startup" ON public.startups;
DROP POLICY IF EXISTS "startups_select_policy" ON public.startups;
DROP POLICY IF EXISTS "startups_insert_policy" ON public.startups;
DROP POLICY IF EXISTS "startups_update_policy" ON public.startups;
DROP POLICY IF EXISTS "startups_delete_policy" ON public.startups;

-- 2. SECURITY DEFINER 함수 추가 (없는 경우)
-- is_startup_member, is_startup_founder 는 이미 093 마이그레이션에서 생성됨
-- is_investor_approved 함수 추가
CREATE OR REPLACE FUNCTION public.is_investor_approved(p_startup_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.investor_access
        WHERE startup_id = p_startup_id
        AND investor_id = p_user_id
        AND status = 'APPROVED'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_investor_approved TO authenticated;

-- 3. startups 새 정책 (SECURITY DEFINER 함수 사용)
-- SELECT: founder OR team member OR approved investor
CREATE POLICY "startups_select_policy" ON public.startups
    FOR SELECT
    TO authenticated
    USING (
        founder_id = auth.uid()
        OR public.is_startup_member(id, auth.uid())
        OR public.is_investor_approved(id, auth.uid())
    );

-- INSERT: 본인만 생성 가능
CREATE POLICY "startups_insert_policy" ON public.startups
    FOR INSERT
    TO authenticated
    WITH CHECK (founder_id = auth.uid());

-- UPDATE: founder만 수정 가능
CREATE POLICY "startups_update_policy" ON public.startups
    FOR UPDATE
    TO authenticated
    USING (founder_id = auth.uid());

-- DELETE: founder만 삭제 가능
CREATE POLICY "startups_delete_policy" ON public.startups
    FOR DELETE
    TO authenticated
    USING (founder_id = auth.uid());

-- 4. tasks 정책 수정 (team_members 직접 조회 제거)
DROP POLICY IF EXISTS "Startup members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Startup members can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_all_policy" ON public.tasks;

CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            WHERE s.id = tasks.startup_id
            AND (s.founder_id = auth.uid() OR public.is_startup_member(s.id, auth.uid()))
        )
    );

CREATE POLICY "tasks_all_policy" ON public.tasks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            WHERE s.id = tasks.startup_id
            AND (s.founder_id = auth.uid() OR public.is_startup_member(s.id, auth.uid()))
        )
    );

-- 5. updates 정책 수정
DROP POLICY IF EXISTS "Startup members can manage updates" ON public.updates;
DROP POLICY IF EXISTS "Approved investors can view updates" ON public.updates;
DROP POLICY IF EXISTS "updates_all_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_investor_select_policy" ON public.updates;

CREATE POLICY "updates_all_policy" ON public.updates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.startups s
            WHERE s.id = updates.startup_id
            AND (s.founder_id = auth.uid() OR public.is_startup_member(s.id, auth.uid()))
        )
    );

CREATE POLICY "updates_investor_select_policy" ON public.updates
    FOR SELECT
    TO authenticated
    USING (public.is_investor_approved(startup_id, auth.uid()));

-- 6. investor_access 정책 수정
DROP POLICY IF EXISTS "Founders can manage investor access" ON public.investor_access;
DROP POLICY IF EXISTS "Investors can view their own access requests" ON public.investor_access;
DROP POLICY IF EXISTS "Investors can create access requests" ON public.investor_access;
DROP POLICY IF EXISTS "investor_access_founders_policy" ON public.investor_access;
DROP POLICY IF EXISTS "investor_access_view_policy" ON public.investor_access;
DROP POLICY IF EXISTS "investor_access_insert_policy" ON public.investor_access;

CREATE POLICY "investor_access_founders_policy" ON public.investor_access
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.startups
            WHERE id = investor_access.startup_id
            AND founder_id = auth.uid()
        )
    );

CREATE POLICY "investor_access_view_policy" ON public.investor_access
    FOR SELECT
    TO authenticated
    USING (investor_id = auth.uid());

CREATE POLICY "investor_access_insert_policy" ON public.investor_access
    FOR INSERT
    TO authenticated
    WITH CHECK (investor_id = auth.uid());

-- 7. deployed_agents 정책 보강 (team 관련)
-- 기존 정책에 team_id 조건 추가
DROP POLICY IF EXISTS "Users can view their own agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Team members can view team agents" ON public.deployed_agents;

CREATE POLICY "deployed_agents_select_policy" ON public.deployed_agents
    FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
        OR (team_id IS NOT NULL AND public.is_team_founder(team_id, auth.uid()))
        OR (startup_id IS NOT NULL AND public.is_startup_member(startup_id, auth.uid()))
        OR (startup_id IS NOT NULL AND public.is_startup_founder(startup_id, auth.uid()))
    );
