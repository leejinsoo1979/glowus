-- 사업계획서 파이프라인 컬럼 추가
ALTER TABLE business_plans
ADD COLUMN IF NOT EXISTS pipeline_stage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS generation_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS generated_document_url TEXT,
ADD COLUMN IF NOT EXISTS generated_document_format TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES business_plan_templates(id),
ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID,
ADD COLUMN IF NOT EXISTS reviewers UUID[];

-- pipeline_execution_logs 테이블 생성
CREATE TABLE IF NOT EXISTS pipeline_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_plan_id ON pipeline_execution_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_stage ON pipeline_execution_logs(stage);
CREATE INDEX IF NOT EXISTS idx_business_plans_pipeline_status ON business_plans(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_business_plans_is_latest ON business_plans(is_latest);
