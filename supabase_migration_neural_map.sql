-- Neural Map & Archeology Tables
-- This migration enables the "Project Archeology" feature by creating the necessary tables.

-- 1. Neural Maps (The "Brain" container)
CREATE TABLE IF NOT EXISTS neural_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Map',
  description TEXT,
  theme_id TEXT DEFAULT 'default',
  view_state JSONB DEFAULT '{}', -- Camera position, zoom, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Neural Files (Uploaded raw materials)
CREATE TABLE IF NOT EXISTS neural_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT, -- Relative path in the project structure (e.g. "components/Button.tsx")
  type TEXT NOT NULL, -- 'pdf', 'image', 'video', 'markdown', 'code'
  url TEXT NOT NULL, -- Storage URL
  size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Neural Nodes (The "neurons" of the graph)
CREATE TABLE IF NOT EXISTS neural_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'self', 'concept', 'memory', 'doc', 'task', 'project'
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT, -- Full content for search/RAG
  tags TEXT[] DEFAULT '{}',
  importance INTEGER DEFAULT 5, -- 1-10
  
  -- Structural relationships
  parent_id UUID REFERENCES neural_nodes(id) ON DELETE SET NULL, -- Hirearchy
  cluster_id UUID, -- For clustering (future use)
  
  -- Integration
  source_ref JSONB, -- Reference to source file { fileId: "...", line: 10 }
  
  -- Visualization State
  color TEXT,
  position JSONB, -- { x, y, z }
  expanded BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Neural Edges (The "synapses" / connections)
CREATE TABLE IF NOT EXISTS neural_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES neural_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'parent_child', 'related', 'references', 'depends_on'
  
  weight FLOAT DEFAULT 0.5,
  label TEXT,
  bidirectional BOOLEAN DEFAULT false,
  evidence JSONB, -- Why this link exists (Analysis result)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate edges of same type
  UNIQUE(map_id, source_id, target_id, type)
);

-- 5. Storage Bucket (If not exists)
insert into storage.buckets (id, name, public)
values ('neural-files', 'neural-files', true)
on conflict (id) do nothing;

-- 6. RLS Policies (Simple start: Owner access only)
ALTER TABLE neural_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own maps" ON neural_maps
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage files in their maps" ON neural_files
  USING (map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage nodes in their maps" ON neural_nodes
  USING (map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage edges in their maps" ON neural_edges
  USING (map_id IN (SELECT id FROM neural_maps WHERE user_id = auth.uid()));

-- Storage Policies
create policy "Users can upload neural files"
on storage.objects for insert
with check ( bucket_id = 'neural-files' AND auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can view own neural files"
on storage.objects for select
using ( bucket_id = 'neural-files' AND auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can delete own neural files"
on storage.objects for delete
using ( bucket_id = 'neural-files' AND auth.uid()::text = (storage.foldername(name))[1] );
