-- 에이전트가 사용자를 부르는 호칭 컬럼 추가
-- user_title: boss, ceo, director, manager, team_leader, senior, name, 또는 직접 입력값

ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS user_title TEXT DEFAULT 'boss';

COMMENT ON COLUMN deployed_agents.user_title IS '에이전트가 사용자를 부르는 호칭 (boss=사장님, ceo=대표님, director=이사님, manager=부장님, team_leader=팀장님, senior=선배님, name=이름+님, 또는 직접 입력값)';
