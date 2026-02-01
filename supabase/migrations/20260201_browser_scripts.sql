-- ============================================
-- Browser Scripts 테이블
-- 학습된 브라우저 자동화 스크립트 저장
-- ============================================

CREATE TABLE IF NOT EXISTS browser_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 사이트 정보
  site_domain TEXT NOT NULL,           -- coupang.com
  site_name TEXT,                       -- 쿠팡

  -- 작업 정보
  action_name TEXT NOT NULL,           -- 장바구니_담기
  action_description TEXT,             -- 상품을 장바구니에 담는 작업
  trigger_keywords TEXT[],             -- ['장바구니', '담아', '카트']

  -- 스크립트
  script_type TEXT DEFAULT 'playwright' CHECK (script_type IN ('playwright', 'puppeteer', 'applescript')),
  script_code TEXT NOT NULL,           -- 실제 스크립트 코드

  -- 변수 (동적으로 바꿀 수 있는 값)
  variables JSONB DEFAULT '[]',        -- [{"name": "productName", "description": "검색할 상품명"}]

  -- 통계
  success_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_fail_at TIMESTAMPTZ,
  last_fail_reason TEXT,

  -- 메타
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,     -- 다른 사용자도 사용 가능
  version INT DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 스크립트 실행 로그
-- ============================================

CREATE TABLE IF NOT EXISTS browser_script_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID REFERENCES browser_scripts(id) ON DELETE SET NULL,

  -- 실행 정보
  site_domain TEXT NOT NULL,
  action_name TEXT NOT NULL,
  variables_used JSONB DEFAULT '{}',   -- 실제 사용된 변수 값

  -- 결과
  status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'TIMEOUT')),
  execution_time_ms INT,
  error_message TEXT,
  screenshot_url TEXT,                 -- 실패 시 스크린샷

  -- AI 학습용
  was_ai_fallback BOOLEAN DEFAULT false,  -- AI가 대신 처리했는지
  ai_tokens_used INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_browser_scripts_user ON browser_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_scripts_domain ON browser_scripts(site_domain);
CREATE INDEX IF NOT EXISTS idx_browser_scripts_action ON browser_scripts(action_name);
CREATE INDEX IF NOT EXISTS idx_browser_scripts_keywords ON browser_scripts USING GIN(trigger_keywords);

CREATE INDEX IF NOT EXISTS idx_browser_script_logs_user ON browser_script_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_script_logs_script ON browser_script_logs(script_id);
CREATE INDEX IF NOT EXISTS idx_browser_script_logs_created ON browser_script_logs(created_at DESC);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE browser_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_script_logs ENABLE ROW LEVEL SECURITY;

-- 본인 스크립트 + 공개 스크립트 조회 가능
CREATE POLICY "browser_scripts_select" ON browser_scripts
  FOR SELECT USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "browser_scripts_insert" ON browser_scripts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "browser_scripts_update" ON browser_scripts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "browser_scripts_delete" ON browser_scripts
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "browser_script_logs_own" ON browser_script_logs
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 초기 스크립트 (자주 쓰는 사이트)
-- ============================================

-- 쿠팡 장바구니 담기
INSERT INTO browser_scripts (
  user_id, site_domain, site_name, action_name, action_description,
  trigger_keywords, script_type, script_code, variables, is_public
) VALUES (
  NULL, -- 시스템 스크립트
  'coupang.com',
  '쿠팡',
  'add_to_cart',
  '상품을 검색하고 최저가 상품을 장바구니에 담습니다',
  ARRAY['장바구니', '담아', '카트', '쇼핑', '구매'],
  'playwright',
  $SCRIPT$
async function execute(page, variables) {
  const { productName, sortByPrice = true } = variables;

  // 1. 쿠팡 접속
  await page.goto('https://www.coupang.com');

  // 2. 검색
  await page.fill('input[name="q"]', productName);
  await page.press('input[name="q"]', 'Enter');
  await page.waitForLoadState('networkidle');

  // 3. 가격순 정렬 (옵션)
  if (sortByPrice) {
    await page.click('button:has-text("낮은가격순")').catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 4. 첫 번째 상품 클릭
  await page.click('.search-product:first-child a');
  await page.waitForLoadState('networkidle');

  // 5. 장바구니 담기
  await page.click('button:has-text("장바구니")');
  await page.waitForTimeout(1000);

  return { success: true, message: `${productName} 장바구니 담기 완료` };
}
$SCRIPT$,
  '[{"name": "productName", "type": "string", "required": true, "description": "검색할 상품명"}, {"name": "sortByPrice", "type": "boolean", "default": true, "description": "최저가 정렬 여부"}]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- 네이버 검색
INSERT INTO browser_scripts (
  user_id, site_domain, site_name, action_name, action_description,
  trigger_keywords, script_type, script_code, variables, is_public
) VALUES (
  NULL,
  'naver.com',
  '네이버',
  'search',
  '네이버에서 검색합니다',
  ARRAY['네이버', '검색', '찾아'],
  'playwright',
  $SCRIPT$
async function execute(page, variables) {
  const { query } = variables;

  await page.goto('https://www.naver.com');
  await page.fill('input[name="query"]', query);
  await page.press('input[name="query"]', 'Enter');
  await page.waitForLoadState('networkidle');

  return { success: true, message: `"${query}" 검색 완료` };
}
$SCRIPT$,
  '[{"name": "query", "type": "string", "required": true, "description": "검색어"}]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- 구글 검색
INSERT INTO browser_scripts (
  user_id, site_domain, site_name, action_name, action_description,
  trigger_keywords, script_type, script_code, variables, is_public
) VALUES (
  NULL,
  'google.com',
  '구글',
  'search',
  '구글에서 검색합니다',
  ARRAY['구글', 'google', '검색'],
  'playwright',
  $SCRIPT$
async function execute(page, variables) {
  const { query } = variables;

  await page.goto('https://www.google.com');
  await page.fill('textarea[name="q"]', query);
  await page.press('textarea[name="q"]', 'Enter');
  await page.waitForLoadState('networkidle');

  return { success: true, message: `"${query}" 검색 완료` };
}
$SCRIPT$,
  '[{"name": "query", "type": "string", "required": true, "description": "검색어"}]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- 유튜브 검색 및 재생
INSERT INTO browser_scripts (
  user_id, site_domain, site_name, action_name, action_description,
  trigger_keywords, script_type, script_code, variables, is_public
) VALUES (
  NULL,
  'youtube.com',
  '유튜브',
  'search_and_play',
  '유튜브에서 검색하고 첫 번째 영상을 재생합니다',
  ARRAY['유튜브', 'youtube', '영상', '동영상', '틀어', '재생'],
  'playwright',
  $SCRIPT$
async function execute(page, variables) {
  const { query } = variables;

  await page.goto('https://www.youtube.com');
  await page.fill('input[name="search_query"]', query);
  await page.press('input[name="search_query"]', 'Enter');
  await page.waitForLoadState('networkidle');

  // 첫 번째 영상 클릭
  await page.click('ytd-video-renderer:first-child a#video-title');
  await page.waitForLoadState('networkidle');

  return { success: true, message: `"${query}" 영상 재생 중` };
}
$SCRIPT$,
  '[{"name": "query", "type": "string", "required": true, "description": "검색어"}]'::jsonb,
  true
) ON CONFLICT DO NOTHING;
