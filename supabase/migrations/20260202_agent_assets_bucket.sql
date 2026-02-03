-- Agent Assets Storage Bucket
-- 에이전트 아바타, GIF, 감정 이미지를 위한 스토리지 버킷

-- 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-assets',
  'agent-assets',
  true,  -- 공개 버킷 (이미지 직접 접근 가능)
  10485760,  -- 10MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- RLS 정책: 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload agent assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-assets');

-- RLS 정책: 모든 사용자가 읽기 가능 (공개 버킷)
CREATE POLICY "Public read access for agent assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'agent-assets');

-- RLS 정책: 업로더만 삭제/수정 가능
CREATE POLICY "Users can update own agent assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own agent assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
