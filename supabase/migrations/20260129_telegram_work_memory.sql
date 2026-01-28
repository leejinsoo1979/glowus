-- Telegram Work Memory - 작업 내용 영구 저장
-- 대화 내용과 작업 내용을 구분하여 저장

-- 1. 마지막 프로젝트 컬럼 추가 (telegram_users)
ALTER TABLE telegram_users
ADD COLUMN IF NOT EXISTS last_project TEXT;

ALTER TABLE telegram_users
ADD COLUMN IF NOT EXISTS last_project_path TEXT;

ALTER TABLE telegram_users
ADD COLUMN IF NOT EXISTS last_project_at TIMESTAMPTZ;

-- 2. 작업 기록 테이블 (코딩 작업, 파일 생성, 수정 등)
CREATE TABLE IF NOT EXISTS telegram_work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),
  chat_id BIGINT NOT NULL,

  -- 작업 유형
  work_type TEXT NOT NULL CHECK (work_type IN (
    'coding_task',      -- 코딩 작업
    'file_create',      -- 파일 생성
    'file_modify',      -- 파일 수정
    'file_delete',      -- 파일 삭제
    'git_commit',       -- Git 커밋
    'git_push',         -- Git 푸시
    'project_create',   -- 프로젝트 생성
    'project_modify',   -- 프로젝트 수정
    'app_control',      -- 앱 제어
    'terminal_command', -- 터미널 명령
    'browser_action',   -- 브라우저 자동화
    'other'             -- 기타
  )),

  -- 작업 내용
  project_name TEXT,                -- 관련 프로젝트
  project_path TEXT,                -- 프로젝트 경로
  instruction TEXT NOT NULL,        -- 원본 지시 (한국어)
  prompt TEXT,                       -- 생성된 프롬프트 (영어)
  result TEXT,                       -- 작업 결과

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,               -- 에러 메시지 (실패 시)

  -- 파일 관련
  files_created JSONB,              -- 생성된 파일 목록
  files_modified JSONB,             -- 수정된 파일 목록
  git_info JSONB,                   -- Git 커밋 정보

  -- 메타데이터
  duration_ms INTEGER,              -- 작업 소요 시간
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 영구 보존 - 절대 삭제 금지
  CONSTRAINT no_delete_work_history CHECK (true)
);

-- 3. 에이전트 학습 기록 테이블 (어떤 지시에 어떻게 응답했는지)
CREATE TABLE IF NOT EXISTS telegram_agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),

  -- 학습 내용
  instruction_pattern TEXT NOT NULL,   -- 지시 패턴 (예: "테트리스 만들어")
  instruction_category TEXT,           -- 카테고리 (게임, 앱, 수정 등)
  successful_prompt TEXT,              -- 성공한 프롬프트

  -- 통계
  use_count INTEGER DEFAULT 1,         -- 사용 횟수
  success_count INTEGER DEFAULT 0,     -- 성공 횟수
  failure_count INTEGER DEFAULT 0,     -- 실패 횟수

  -- 사용자 피드백
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,

  -- 메타데이터
  first_used_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_users_last_project ON telegram_users(last_project);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_user ON telegram_work_history(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_chat ON telegram_work_history(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_type ON telegram_work_history(work_type);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_project ON telegram_work_history(project_name);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_status ON telegram_work_history(status);
CREATE INDEX IF NOT EXISTS idx_telegram_work_history_created ON telegram_work_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_agent_learnings_user ON telegram_agent_learnings(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_agent_learnings_pattern ON telegram_agent_learnings(instruction_pattern);
CREATE INDEX IF NOT EXISTS idx_telegram_agent_learnings_category ON telegram_agent_learnings(instruction_category);

-- RLS Policies
ALTER TABLE telegram_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_agent_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to telegram_work_history" ON telegram_work_history
  FOR ALL USING (true);

CREATE POLICY "Service role full access to telegram_agent_learnings" ON telegram_agent_learnings
  FOR ALL USING (true);

-- Comments
COMMENT ON TABLE telegram_work_history IS '작업 기록 - 영구 보존. 모든 코딩/파일/앱 작업 기록';
COMMENT ON TABLE telegram_agent_learnings IS '에이전트 학습 기록 - 어떤 지시에 어떻게 응답했는지 학습';
COMMENT ON COLUMN telegram_users.last_project IS '마지막 사용 프로젝트명 - 영구 저장';
