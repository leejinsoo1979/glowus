-- Documents Storage Bucket
-- 사업계획서 등 생성된 문서를 저장하는 스토리지 버킷

-- 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800, -- 50MB (문서 파일은 좀 더 큰 용량 허용)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/x-hwp',
    'application/haansofthwp',
    'text/plain',
    'text/html',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 스토리지 정책: 인증된 사용자만 업로드 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;

-- 스토리지 정책: 누구나 읽기 가능 (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Anyone can view documents'
  ) THEN
    CREATE POLICY "Anyone can view documents"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'documents');
  END IF;
END $$;

-- 스토리지 정책: 인증된 사용자만 삭제 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can delete documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;
END $$;

-- 스토리지 정책: 인증된 사용자만 업데이트 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can update documents'
  ) THEN
    CREATE POLICY "Authenticated users can update documents"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;
END $$;

COMMENT ON TABLE storage.buckets IS 'documents 버킷: 사업계획서, 보고서 등 자동 생성 문서 저장';
