-- Neural Map Tables
-- 3D Knowledge Graph Visualization for Users
-- Created: 2025-12-19

-- ============================================
-- 뉴럴맵 메인 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'My Neural Map',
  root_node_id UUID,
  view_state JSONB DEFAULT '{}',
  theme_id TEXT DEFAULT 'cosmic-dark',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 클러스터 테이블 (노드보다 먼저 생성 - FK 참조)
-- ============================================

CREATE TABLE IF NOT EXISTS neural_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  keywords TEXT[] DEFAULT '{}',
  cohesion DECIMAL DEFAULT 0.5 CHECK (cohesion >= 0 AND cohesion <= 1),
  center_node_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 노드 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('self', 'concept', 'project', 'doc', 'idea', 'decision', 'memory', 'task', 'person', 'insight')),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  parent_id UUID REFERENCES neural_nodes(id) ON DELETE SET NULL,
  cluster_id UUID REFERENCES neural_clusters(id) ON DELETE SET NULL,
  source_ref JSONB,
  color TEXT,
  expanded BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  position JSONB,
  stats JSONB DEFAULT '{"views": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- root_node_id FK 추가 (neural_nodes 테이블 생성 후)
ALTER TABLE neural_maps
  ADD CONSTRAINT fk_root_node
  FOREIGN KEY (root_node_id)
  REFERENCES neural_nodes(id)
  ON DELETE SET NULL;

-- center_node_id FK 추가
ALTER TABLE neural_clusters
  ADD CONSTRAINT fk_center_node
  FOREIGN KEY (center_node_id)
  REFERENCES neural_nodes(id)
  ON DELETE SET NULL;

-- ============================================
-- 엣지 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('parent_child', 'references', 'supports', 'contradicts', 'causes', 'same_topic', 'sequence')),
  weight DECIMAL DEFAULT 0.5 CHECK (weight >= 0.1 AND weight <= 1.0),
  label TEXT,
  bidirectional BOOLEAN DEFAULT false,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 파일 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'image', 'video', 'markdown')),
  url TEXT NOT NULL,
  size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 분석 작업 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  file_ids UUID[],
  instructions TEXT,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_neural_maps_user ON neural_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_neural_maps_agent ON neural_maps(agent_id);

CREATE INDEX IF NOT EXISTS idx_neural_nodes_map ON neural_nodes(map_id);
CREATE INDEX IF NOT EXISTS idx_neural_nodes_parent ON neural_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_neural_nodes_cluster ON neural_nodes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_neural_nodes_type ON neural_nodes(type);

CREATE INDEX IF NOT EXISTS idx_neural_edges_map ON neural_edges(map_id);
CREATE INDEX IF NOT EXISTS idx_neural_edges_source ON neural_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_neural_edges_target ON neural_edges(target_id);

CREATE INDEX IF NOT EXISTS idx_neural_clusters_map ON neural_clusters(map_id);

CREATE INDEX IF NOT EXISTS idx_neural_files_map ON neural_files(map_id);

CREATE INDEX IF NOT EXISTS idx_neural_analysis_jobs_map ON neural_analysis_jobs(map_id);
CREATE INDEX IF NOT EXISTS idx_neural_analysis_jobs_status ON neural_analysis_jobs(status);

-- ============================================
-- 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_neural_map_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS neural_maps_updated ON neural_maps;
CREATE TRIGGER neural_maps_updated
  BEFORE UPDATE ON neural_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_neural_map_timestamp();

CREATE OR REPLACE FUNCTION update_neural_node_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS neural_nodes_updated ON neural_nodes;
CREATE TRIGGER neural_nodes_updated
  BEFORE UPDATE ON neural_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_neural_node_timestamp();

-- ============================================
-- RLS 정책
-- ============================================

ALTER TABLE neural_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_maps" ON neural_maps
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE neural_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_nodes" ON neural_nodes
  FOR ALL USING (
    map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid())
  );

ALTER TABLE neural_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_edges" ON neural_edges
  FOR ALL USING (
    map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid())
  );

ALTER TABLE neural_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_clusters" ON neural_clusters
  FOR ALL USING (
    map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid())
  );

ALTER TABLE neural_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_files" ON neural_files
  FOR ALL USING (
    map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid())
  );

ALTER TABLE neural_analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_jobs" ON neural_analysis_jobs
  FOR ALL USING (
    map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid())
  );

-- ============================================
-- Realtime 활성화
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE neural_maps;
ALTER PUBLICATION supabase_realtime ADD TABLE neural_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE neural_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE neural_clusters;
