-- shared_viewer_state에 selection 필드 추가
-- 사용자가 공유 자료에서 특정 영역을 선택할 때 사용

-- selection 컬럼 추가 (JSONB)
ALTER TABLE shared_viewer_state
ADD COLUMN IF NOT EXISTS selection JSONB DEFAULT NULL;

-- selection 형식:
-- {
--   "x": 100,      -- 선택 영역 시작 X
--   "y": 200,      -- 선택 영역 시작 Y
--   "width": 300,  -- 선택 영역 너비
--   "height": 150, -- 선택 영역 높이
--   "page": 1,     -- PDF인 경우 페이지 번호
--   "timestamp": 30.5  -- 비디오인 경우 타임스탬프
-- }

-- annotations 컬럼 추가 (JSONB 배열)
ALTER TABLE shared_viewer_state
ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]'::JSONB;

-- annotations 형식:
-- [
--   {
--     "id": "uuid",
--     "type": "highlight" | "note" | "pointer",
--     "page": 1,
--     "region": { "x": 100, "y": 200, "width": 50, "height": 20 },
--     "content": "주석 내용",
--     "created_by": "user-uuid",
--     "created_at": "2024-01-01T00:00:00Z"
--   }
-- ]

-- highlight_regions 컬럼 추가 (JSONB 배열) - 여러 하이라이트 영역
ALTER TABLE shared_viewer_state
ADD COLUMN IF NOT EXISTS highlight_regions JSONB DEFAULT '[]'::JSONB;

-- 코멘트 추가
COMMENT ON COLUMN shared_viewer_state.selection IS '현재 선택된 영역 (x, y, width, height, page/timestamp)';
COMMENT ON COLUMN shared_viewer_state.annotations IS '주석 목록 (하이라이트, 노트, 포인터)';
COMMENT ON COLUMN shared_viewer_state.highlight_regions IS '하이라이트된 영역들';
