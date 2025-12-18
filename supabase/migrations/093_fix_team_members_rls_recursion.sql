-- =====================================================
-- Fix team_members RLS infinite recursion issue
-- 문제: team_members 정책에서 team_members를 다시 조회하면서 무한 재귀 발생
-- 해결: SECURITY DEFINER 함수를 사용하여 RLS 우회
-- =====================================================

-- 1. 기존 문제가 되는 정책들 삭제
DROP POLICY IF EXISTS "team_members_select_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON public.team_members;
DROP POLICY IF EXISTS "Team founders can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view other members" ON public.team_members;

-- teams 정책도 재설정 (team_members 참조하는 것 제거)
DROP POLICY IF EXISTS "teams_select_policy" ON public.teams;
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;

-- 2. SECURITY DEFINER 함수 생성 (RLS 우회하여 멤버십 확인)
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_startup_member(p_startup_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE startup_id = p_startup_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_team_founder(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.teams
        WHERE id = p_team_id AND founder_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_startup_founder(p_startup_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.startups
        WHERE id = p_startup_id AND founder_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. teams 새로운 정책 (SECURITY DEFINER 함수 사용)
CREATE POLICY "teams_select_policy" ON public.teams
    FOR SELECT
    TO authenticated
    USING (
        founder_id = auth.uid()
        OR public.is_team_member(id, auth.uid())
    );

-- 4. team_members 새로운 정책 (자기참조 없음)
-- SELECT: 본인 레코드 또는 같은 팀/스타트업의 멤버
CREATE POLICY "team_members_select_policy" ON public.team_members
    FOR SELECT
    TO authenticated
    USING (
        -- 본인 레코드
        user_id = auth.uid()
        OR
        -- 같은 팀의 멤버 (SECURITY DEFINER 함수 사용으로 재귀 방지)
        (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
        OR
        -- 같은 startup의 멤버
        (startup_id IS NOT NULL AND public.is_startup_member(startup_id, auth.uid()))
    );

-- INSERT: 팀 founder만 멤버 추가 가능
CREATE POLICY "team_members_insert_policy" ON public.team_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (team_id IS NOT NULL AND public.is_team_founder(team_id, auth.uid()))
        OR
        (startup_id IS NOT NULL AND public.is_startup_founder(startup_id, auth.uid()))
    );

-- UPDATE: 팀 founder만 멤버 정보 수정 가능
CREATE POLICY "team_members_update_policy" ON public.team_members
    FOR UPDATE
    TO authenticated
    USING (
        (team_id IS NOT NULL AND public.is_team_founder(team_id, auth.uid()))
        OR
        (startup_id IS NOT NULL AND public.is_startup_founder(startup_id, auth.uid()))
    );

-- DELETE: 팀 founder만 멤버 삭제 가능
CREATE POLICY "team_members_delete_policy" ON public.team_members
    FOR DELETE
    TO authenticated
    USING (
        (team_id IS NOT NULL AND public.is_team_founder(team_id, auth.uid()))
        OR
        (startup_id IS NOT NULL AND public.is_startup_founder(startup_id, auth.uid()))
    );

-- 5. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.is_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_startup_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_founder TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_startup_founder TO authenticated;
