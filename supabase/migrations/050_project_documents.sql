-- Project Documents System
-- Stores agent outputs, deliverables, and project artifacts

-- ============================================
-- Project Documents Table
-- ============================================
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Source (where this document came from)
  task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  agent_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,

  -- Document Info
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT, -- Short summary for list views

  -- Type & Category
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'analysis',      -- 분석 결과
    'summary',       -- 요약
    'report',        -- 리포트
    'research',      -- 리서치
    'transcript',    -- 트랜스크립트
    'meeting_notes', -- 회의록
    'deliverable',   -- 결과물
    'other'          -- 기타
  )),

  -- Source Reference (e.g., YouTube URL)
  source_url TEXT,
  source_type TEXT, -- youtube, web, document, etc.

  -- Creator (agent or user)
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('agent', 'user')),
  created_by_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}', -- Additional data (tools_used, sources, etc.)

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: creator must match type
  CONSTRAINT valid_creator CHECK (
    (created_by_type = 'agent' AND created_by_agent_id IS NOT NULL) OR
    (created_by_type = 'user' AND created_by_user_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX idx_project_documents_doc_type ON project_documents(doc_type);
CREATE INDEX idx_project_documents_created_by_agent ON project_documents(created_by_agent_id) WHERE created_by_agent_id IS NOT NULL;
CREATE INDEX idx_project_documents_status ON project_documents(status);
CREATE INDEX idx_project_documents_created_at ON project_documents(created_at DESC);

-- Full text search on content
CREATE INDEX idx_project_documents_content_search ON project_documents USING gin(to_tsvector('korean', coalesce(title, '') || ' ' || coalesce(content, '')));

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Select: project members can view
CREATE POLICY "project_documents_select" ON project_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_documents.project_id
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

-- Insert: project members can create
CREATE POLICY "project_documents_insert" ON project_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_documents.project_id
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

-- Update: creator or project owner
CREATE POLICY "project_documents_update" ON project_documents
  FOR UPDATE USING (
    created_by_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_documents.project_id AND p.owner_id = auth.uid()
    )
  );

-- Delete: project owner only
CREATE POLICY "project_documents_delete" ON project_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_documents.project_id AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- Trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_project_documents_updated_at ON project_documents;
CREATE TRIGGER update_project_documents_updated_at
  BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE project_documents;
