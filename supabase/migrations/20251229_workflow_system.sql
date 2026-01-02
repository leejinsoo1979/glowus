-- Workflow System Tables
-- 다단계 루프 워크플로우 실행 시스템

-- 워크플로우 정의 테이블
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',

  -- 워크플로우 구조 (JSON)
  input_schema JSONB,           -- 입력 스키마
  steps JSONB NOT NULL,         -- 단계 정의 배열
  start_step_id VARCHAR(100) NOT NULL,  -- 시작 단계 ID

  -- 메타데이터
  tags TEXT[],
  category VARCHAR(50),         -- hr, finance, project, report, notification, custom
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- 소유자 정보
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 워크플로우 실행 인스턴스 테이블
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  workflow_version VARCHAR(50) NOT NULL,

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'running',  -- draft, running, paused, completed, failed, cancelled
  current_step_id VARCHAR(100),

  -- 입출력
  inputs JSONB DEFAULT '{}',
  outputs JSONB,

  -- 단계별 결과
  step_results JSONB DEFAULT '{}',

  -- 에러 정보
  error TEXT,

  -- 컨텍스트
  agent_id UUID REFERENCES deployed_agents(id),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),

  -- 타임스탬프
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'
);

-- 워크플로우 실행 로그 테이블 (상세 로깅)
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,

  -- 이벤트 정보
  event_type VARCHAR(50) NOT NULL,  -- started, step_started, step_completed, step_failed, completed, failed
  step_id VARCHAR(100),

  -- 상세 데이터
  data JSONB,
  error TEXT,

  -- 타이밍
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 워크플로우 템플릿 테이블 (미리 정의된 패턴)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,  -- hr, finance, project, report, notification, custom

  -- 템플릿 정의
  workflow_definition JSONB NOT NULL,

  -- 커스터마이징 변수
  variables JSONB,

  -- 사용 통계
  usage_count INT DEFAULT 0,

  -- 메타데이터
  is_public BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id),  -- NULL이면 공용 템플릿

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 워크플로우 스케줄 테이블 (자동 실행)
CREATE TABLE IF NOT EXISTS workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,

  -- 스케줄 정보
  name VARCHAR(255),
  schedule_type VARCHAR(20) NOT NULL,  -- once, daily, weekly, monthly, cron
  cron_expression VARCHAR(100),         -- cron 표현식 (type: cron)
  scheduled_at TIMESTAMPTZ,             -- 일회성 실행 시간 (type: once)

  -- 실행 입력
  inputs JSONB DEFAULT '{}',

  -- 컨텍스트
  agent_id UUID REFERENCES deployed_agents(id),
  company_id UUID REFERENCES companies(id),

  -- 상태
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_company ON workflow_definitions(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions(category);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_agent ON workflow_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_company ON workflow_executions(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_execution ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_timestamp ON workflow_execution_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow ON workflow_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run ON workflow_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_active ON workflow_schedules(is_active);

-- 기본 워크플로우 템플릿 삽입
INSERT INTO workflow_templates (name, description, category, workflow_definition, variables, is_public) VALUES

-- 월말 재무 정산 워크플로우
('월말 재무 정산', '매월 말 자동으로 거래내역을 집계하고 보고서를 생성합니다', 'finance', '{
  "name": "월말 재무 정산",
  "version": "1.0.0",
  "steps": [
    {
      "id": "get_transactions",
      "name": "이번 달 거래내역 조회",
      "action": { "type": "tool", "tool": "get_transactions" },
      "inputs": { "period": "this_month" },
      "nextStepId": "aggregate_by_category"
    },
    {
      "id": "aggregate_by_category",
      "name": "카테고리별 집계",
      "action": { "type": "tool", "tool": "aggregate_transactions" },
      "inputMappings": [{ "from": "get_transactions.result.transactions", "to": "transactions" }],
      "nextStepId": "check_budget"
    },
    {
      "id": "check_budget",
      "name": "예산 초과 확인",
      "action": { "type": "tool", "tool": "check_budget_overrun" },
      "inputMappings": [{ "from": "aggregate_by_category.result", "to": "aggregated" }],
      "branches": [
        {
          "condition": { "field": "check_budget.result.hasOverrun", "operator": "equals", "value": true },
          "nextStepId": "generate_alert_report"
        }
      ],
      "nextStepId": "generate_report"
    },
    {
      "id": "generate_alert_report",
      "name": "예산 초과 알림 보고서",
      "action": { "type": "tool", "tool": "generate_report" },
      "inputs": { "type": "budget_alert" },
      "nextStepId": "notify_manager"
    },
    {
      "id": "generate_report",
      "name": "월간 보고서 생성",
      "action": { "type": "tool", "tool": "generate_report" },
      "inputs": { "type": "monthly_summary" },
      "nextStepId": null
    },
    {
      "id": "notify_manager",
      "name": "관리자 알림",
      "action": { "type": "notify" },
      "inputs": { "channel": "slack", "recipient": "finance_manager" },
      "nextStepId": "generate_report"
    }
  ],
  "startStepId": "get_transactions"
}', '[{"name": "threshold", "description": "예산 초과 기준 비율 (%)", "type": "number", "default": 100}]', true),

-- 신규 직원 온보딩 워크플로우
('신규 직원 온보딩', '신규 직원 입사 시 자동으로 계정 생성, 장비 요청, 교육 일정을 설정합니다', 'hr', '{
  "name": "신규 직원 온보딩",
  "version": "1.0.0",
  "steps": [
    {
      "id": "create_account",
      "name": "계정 생성",
      "action": { "type": "tool", "tool": "create_employee_account" },
      "inputs": {},
      "nextStepId": "request_equipment"
    },
    {
      "id": "request_equipment",
      "name": "장비 요청",
      "action": { "type": "tool", "tool": "request_equipment" },
      "inputs": { "items": ["laptop", "monitor", "keyboard", "mouse"] },
      "nextStepId": "schedule_training"
    },
    {
      "id": "schedule_training",
      "name": "교육 일정 등록",
      "action": { "type": "tool", "tool": "create_calendar_event" },
      "inputs": { "title": "신입사원 교육", "duration": 3 },
      "nextStepId": "assign_mentor"
    },
    {
      "id": "assign_mentor",
      "name": "멘토 배정",
      "action": { "type": "tool", "tool": "assign_mentor" },
      "nextStepId": "send_welcome"
    },
    {
      "id": "send_welcome",
      "name": "환영 메시지 발송",
      "action": { "type": "notify" },
      "inputs": { "template": "welcome_email" },
      "nextStepId": null
    }
  ],
  "startStepId": "create_account"
}', '[{"name": "department", "description": "배치 부서", "type": "string"}]', true),

-- 일일 업무 보고 워크플로우
('일일 업무 보고', '매일 팀원들의 업무 현황을 수집하여 요약 보고서를 생성합니다', 'report', '{
  "name": "일일 업무 보고",
  "version": "1.0.0",
  "steps": [
    {
      "id": "get_team_tasks",
      "name": "팀 태스크 조회",
      "action": { "type": "tool", "tool": "get_tasks" },
      "inputs": { "status": "all" },
      "nextStepId": "analyze_progress"
    },
    {
      "id": "analyze_progress",
      "name": "진행률 분석",
      "action": { "type": "tool", "tool": "analyze_task_progress" },
      "inputMappings": [{ "from": "get_team_tasks.result.tasks", "to": "tasks" }],
      "nextStepId": "identify_blockers"
    },
    {
      "id": "identify_blockers",
      "name": "블로커 식별",
      "action": { "type": "tool", "tool": "identify_blockers" },
      "inputMappings": [{ "from": "get_team_tasks.result.tasks", "to": "tasks" }],
      "nextStepId": "generate_daily_report"
    },
    {
      "id": "generate_daily_report",
      "name": "일일 보고서 생성",
      "action": { "type": "tool", "tool": "generate_report" },
      "inputs": { "type": "daily_summary" },
      "nextStepId": null
    }
  ],
  "startStepId": "get_team_tasks"
}', '[]', true)

ON CONFLICT DO NOTHING;

-- RLS 정책
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;

-- 워크플로우 정의 정책
CREATE POLICY "Users can view own company workflows" ON workflow_definitions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own company workflows" ON workflow_definitions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 워크플로우 실행 정책
CREATE POLICY "Users can view own company executions" ON workflow_executions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own company executions" ON workflow_executions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 로그 정책
CREATE POLICY "Users can view execution logs" ON workflow_execution_logs
  FOR SELECT USING (
    execution_id IN (
      SELECT id FROM workflow_executions WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 템플릿 정책 (공용 템플릿은 모두 볼 수 있음)
CREATE POLICY "Anyone can view public templates" ON workflow_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own company templates" ON workflow_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 스케줄 정책
CREATE POLICY "Users can manage own company schedules" ON workflow_schedules
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_definitions_updated
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER workflow_templates_updated
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER workflow_schedules_updated
  BEFORE UPDATE ON workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();
