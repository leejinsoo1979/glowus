-- Project Workflow Automation System
-- Enables AI-generated workflows and task assignment to humans/agents

-- ============================================
-- Project Tasks Table (Polymorphic Assignment)
-- ============================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Task Info
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED')),
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

  -- Polymorphic Assignment (human OR agent)
  assignee_type TEXT CHECK (assignee_type IN ('human', 'agent')),
  assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assignee_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,

  -- Workflow Info
  position INTEGER DEFAULT 0,
  depends_on UUID[] DEFAULT '{}',

  -- Schedule
  start_date DATE,
  due_date DATE,
  estimated_hours DECIMAL,
  actual_hours DECIMAL,
  completed_at TIMESTAMPTZ,

  -- Agent Execution Results
  agent_result JSONB,
  agent_executed_at TIMESTAMPTZ,
  agent_error TEXT,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  category TEXT,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: assignee must match type
  CONSTRAINT valid_assignee CHECK (
    (assignee_type IS NULL) OR
    (assignee_type = 'human' AND assignee_user_id IS NOT NULL AND assignee_agent_id IS NULL) OR
    (assignee_type = 'agent' AND assignee_agent_id IS NOT NULL AND assignee_user_id IS NULL)
  )
);

-- Indexes for project_tasks
CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_assignee_user ON project_tasks(assignee_user_id) WHERE assignee_user_id IS NOT NULL;
CREATE INDEX idx_project_tasks_assignee_agent ON project_tasks(assignee_agent_id) WHERE assignee_agent_id IS NOT NULL;
CREATE INDEX idx_project_tasks_due_date ON project_tasks(due_date) WHERE due_date IS NOT NULL;

-- ============================================
-- Workflow Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Project Type this template is for
  project_type TEXT NOT NULL,

  -- Template Tasks (JSON array of task definitions)
  tasks JSONB NOT NULL DEFAULT '[]',

  -- System vs User-created
  is_system BOOLEAN DEFAULT FALSE,

  -- Owner (null for system templates)
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for workflow_templates
CREATE INDEX idx_workflow_templates_project_type ON workflow_templates(project_type);
CREATE INDEX idx_workflow_templates_team_id ON workflow_templates(team_id) WHERE team_id IS NOT NULL;

-- ============================================
-- Add workflow_config to projects table
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_config JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES workflow_templates(id);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

-- Project Tasks Policies
CREATE POLICY "project_tasks_select" ON project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
      AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM teams t
          WHERE t.id = p.team_id AND t.founder_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "project_tasks_insert" ON project_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
      AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM teams t
          WHERE t.id = p.team_id AND t.founder_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "project_tasks_update" ON project_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
      AND (
        p.owner_id = auth.uid() OR
        project_tasks.assignee_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM teams t
          WHERE t.id = p.team_id AND t.founder_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "project_tasks_delete" ON project_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
      AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM teams t
          WHERE t.id = p.team_id AND t.founder_id = auth.uid()
        )
      )
    )
  );

-- Workflow Templates Policies
CREATE POLICY "workflow_templates_select" ON workflow_templates
  FOR SELECT USING (
    is_system = TRUE OR
    team_id IS NULL OR
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = workflow_templates.team_id
      AND (
        t.founder_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "workflow_templates_insert" ON workflow_templates
  FOR INSERT WITH CHECK (
    is_system = FALSE AND
    (
      team_id IS NULL OR
      EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = workflow_templates.team_id AND t.founder_id = auth.uid()
      )
    )
  );

CREATE POLICY "workflow_templates_update" ON workflow_templates
  FOR UPDATE USING (
    is_system = FALSE AND
    created_by = auth.uid()
  );

CREATE POLICY "workflow_templates_delete" ON workflow_templates
  FOR DELETE USING (
    is_system = FALSE AND
    created_by = auth.uid()
  );

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert Default Workflow Templates
-- ============================================
INSERT INTO workflow_templates (name, description, project_type, is_system, tasks) VALUES
(
  '웹 애플리케이션 개발',
  '일반적인 웹 애플리케이션 개발 워크플로우',
  'web_app',
  TRUE,
  '[
    {"title": "요구사항 분석", "description": "프로젝트 요구사항 수집 및 분석", "position": 1, "estimated_hours": 8, "priority": "HIGH"},
    {"title": "기술 스택 선정", "description": "프로젝트에 적합한 기술 스택 결정", "position": 2, "estimated_hours": 4, "priority": "HIGH", "depends_on": [1]},
    {"title": "DB 스키마 설계", "description": "데이터베이스 구조 설계", "position": 3, "estimated_hours": 6, "priority": "HIGH", "depends_on": [1]},
    {"title": "UI/UX 디자인", "description": "사용자 인터페이스 디자인", "position": 4, "estimated_hours": 16, "priority": "MEDIUM", "depends_on": [1]},
    {"title": "백엔드 API 개발", "description": "서버 API 구현", "position": 5, "estimated_hours": 24, "priority": "HIGH", "depends_on": [3]},
    {"title": "프론트엔드 개발", "description": "클라이언트 UI 구현", "position": 6, "estimated_hours": 24, "priority": "HIGH", "depends_on": [4, 5]},
    {"title": "테스트", "description": "기능 테스트 및 버그 수정", "position": 7, "estimated_hours": 8, "priority": "HIGH", "depends_on": [5, 6]},
    {"title": "배포", "description": "프로덕션 환경 배포", "position": 8, "estimated_hours": 4, "priority": "HIGH", "depends_on": [7]}
  ]'::JSONB
),
(
  '모바일 앱 개발',
  'iOS/Android 모바일 앱 개발 워크플로우',
  'mobile_app',
  TRUE,
  '[
    {"title": "요구사항 정의", "description": "앱 기능 및 요구사항 정의", "position": 1, "estimated_hours": 8, "priority": "HIGH"},
    {"title": "와이어프레임", "description": "앱 화면 구조 설계", "position": 2, "estimated_hours": 8, "priority": "HIGH", "depends_on": [1]},
    {"title": "UI 디자인", "description": "앱 UI 디자인", "position": 3, "estimated_hours": 16, "priority": "HIGH", "depends_on": [2]},
    {"title": "API 설계", "description": "백엔드 API 설계", "position": 4, "estimated_hours": 6, "priority": "HIGH", "depends_on": [1]},
    {"title": "앱 개발", "description": "앱 기능 구현", "position": 5, "estimated_hours": 40, "priority": "HIGH", "depends_on": [3, 4]},
    {"title": "API 개발", "description": "백엔드 API 구현", "position": 6, "estimated_hours": 24, "priority": "HIGH", "depends_on": [4]},
    {"title": "테스트", "description": "앱 테스트 및 QA", "position": 7, "estimated_hours": 12, "priority": "HIGH", "depends_on": [5, 6]},
    {"title": "스토어 배포", "description": "앱스토어/플레이스토어 배포", "position": 8, "estimated_hours": 4, "priority": "HIGH", "depends_on": [7]}
  ]'::JSONB
),
(
  '마케팅 캠페인',
  '마케팅 캠페인 기획 및 실행 워크플로우',
  'marketing',
  TRUE,
  '[
    {"title": "목표 설정", "description": "캠페인 목표 및 KPI 설정", "position": 1, "estimated_hours": 4, "priority": "HIGH"},
    {"title": "타겟 분석", "description": "타겟 고객 분석", "position": 2, "estimated_hours": 6, "priority": "HIGH", "depends_on": [1]},
    {"title": "콘텐츠 기획", "description": "마케팅 콘텐츠 기획", "position": 3, "estimated_hours": 8, "priority": "HIGH", "depends_on": [2]},
    {"title": "콘텐츠 제작", "description": "이미지, 영상, 카피 제작", "position": 4, "estimated_hours": 16, "priority": "HIGH", "depends_on": [3]},
    {"title": "채널 설정", "description": "광고 채널 설정 및 세팅", "position": 5, "estimated_hours": 4, "priority": "MEDIUM", "depends_on": [3]},
    {"title": "캠페인 실행", "description": "캠페인 런칭", "position": 6, "estimated_hours": 2, "priority": "HIGH", "depends_on": [4, 5]},
    {"title": "성과 분석", "description": "캠페인 성과 분석 및 리포트", "position": 7, "estimated_hours": 6, "priority": "HIGH", "depends_on": [6]}
  ]'::JSONB
),
(
  '콘텐츠 제작',
  '블로그, 영상 등 콘텐츠 제작 워크플로우',
  'content',
  TRUE,
  '[
    {"title": "주제 선정", "description": "콘텐츠 주제 및 키워드 선정", "position": 1, "estimated_hours": 2, "priority": "HIGH"},
    {"title": "리서치", "description": "주제 관련 리서치", "position": 2, "estimated_hours": 4, "priority": "HIGH", "depends_on": [1]},
    {"title": "아웃라인 작성", "description": "콘텐츠 구조 설계", "position": 3, "estimated_hours": 2, "priority": "MEDIUM", "depends_on": [2]},
    {"title": "초안 작성", "description": "콘텐츠 초안 작성", "position": 4, "estimated_hours": 4, "priority": "HIGH", "depends_on": [3]},
    {"title": "편집 및 교정", "description": "콘텐츠 편집 및 교정", "position": 5, "estimated_hours": 2, "priority": "HIGH", "depends_on": [4]},
    {"title": "디자인/미디어", "description": "이미지, 영상 등 미디어 제작", "position": 6, "estimated_hours": 4, "priority": "MEDIUM", "depends_on": [4]},
    {"title": "발행", "description": "콘텐츠 발행", "position": 7, "estimated_hours": 1, "priority": "HIGH", "depends_on": [5, 6]}
  ]'::JSONB
),
(
  '일반 프로젝트',
  '기본적인 프로젝트 관리 워크플로우',
  'general',
  TRUE,
  '[
    {"title": "프로젝트 킥오프", "description": "프로젝트 시작 미팅", "position": 1, "estimated_hours": 2, "priority": "HIGH"},
    {"title": "계획 수립", "description": "세부 계획 및 일정 수립", "position": 2, "estimated_hours": 4, "priority": "HIGH", "depends_on": [1]},
    {"title": "실행", "description": "계획에 따른 작업 실행", "position": 3, "estimated_hours": 20, "priority": "HIGH", "depends_on": [2]},
    {"title": "검토", "description": "결과물 검토 및 피드백", "position": 4, "estimated_hours": 4, "priority": "HIGH", "depends_on": [3]},
    {"title": "완료", "description": "프로젝트 마무리 및 회고", "position": 5, "estimated_hours": 2, "priority": "MEDIUM", "depends_on": [4]}
  ]'::JSONB
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Enable Realtime for project_tasks
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks;
