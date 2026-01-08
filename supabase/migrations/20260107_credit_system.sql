-- 크레딧 시스템 테이블
-- GlowUS Credit System

-- 1. 사용자 크레딧 잔액
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 1000,              -- 현재 크레딧 (가입 시 1000 지급)
  daily_balance INTEGER DEFAULT 100,         -- 일일 무료 크레딧
  daily_reset_at TIMESTAMP DEFAULT NOW(),    -- 일일 리셋 시간
  tier VARCHAR(20) DEFAULT 'free',           -- free, basic, pro, enterprise
  tier_expires_at TIMESTAMP,                 -- 구독 만료일
  total_earned INTEGER DEFAULT 1000,         -- 총 획득 크레딧
  total_spent INTEGER DEFAULT 0,             -- 총 사용 크레딧
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 크레딧 거래 내역
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,                   -- +충전, -사용
  balance_after INTEGER,                     -- 거래 후 잔액
  type VARCHAR(30) NOT NULL,                 -- signup_bonus, daily_bonus, purchase, subscription, usage, refund
  category VARCHAR(30),                      -- chat, matching, business_plan, document, etc
  description TEXT,
  model_used VARCHAR(50),                    -- gpt-4o, grok-4-1-fast, etc
  tokens_input INTEGER,
  tokens_output INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 구독 내역
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL,                 -- basic, pro, enterprise
  price_usd DECIMAL(10,2) NOT NULL,          -- 20, 50, 200
  credits_granted INTEGER NOT NULL,          -- 30000, 100000, -1(unlimited)
  status VARCHAR(20) DEFAULT 'active',       -- active, cancelled, expired
  payment_provider VARCHAR(20),              -- stripe, paddle, etc
  payment_id VARCHAR(100),                   -- 외부 결제 ID
  starts_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 크레딧 가격 설정 (기능별 소모량)
CREATE TABLE IF NOT EXISTS credit_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) UNIQUE NOT NULL,        -- chat_grok_fast, chat_gpt4o, matching, business_plan, document
  credits INTEGER NOT NULL,                  -- 소모 크레딧
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 기본 가격 설정
INSERT INTO credit_pricing (action, credits, description) VALUES
  ('chat_grok_fast', 1, 'AI 채팅 (Grok 4.1 Fast)'),
  ('chat_gemini_flash', 1, 'AI 채팅 (Gemini Flash)'),
  ('chat_deepseek', 1, 'AI 채팅 (DeepSeek)'),
  ('chat_gpt4o_mini', 3, 'AI 채팅 (GPT-4o Mini)'),
  ('chat_gpt4o', 10, 'AI 채팅 (GPT-4o)'),
  ('chat_claude_sonnet', 10, 'AI 채팅 (Claude Sonnet)'),
  ('chat_claude_opus', 30, 'AI 채팅 (Claude Opus)'),
  ('matching', 50, '정부지원사업 AI 매칭'),
  ('document_analysis', 100, '문서 분석'),
  ('business_plan', 500, '사업계획서 생성')
ON CONFLICT (action) DO NOTHING;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- RLS 정책
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_pricing ENABLE ROW LEVEL SECURITY;

-- 사용자는 자기 크레딧만 조회 가능
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 모든 사용자가 가격 조회 가능
CREATE POLICY "Anyone can view pricing" ON credit_pricing
  FOR SELECT USING (true);

-- 서비스 역할만 수정 가능 (API에서 처리)
CREATE POLICY "Service can manage credits" ON user_credits
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage transactions" ON credit_transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage subscriptions" ON subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- 신규 가입 시 자동으로 크레딧 생성하는 트리거
CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, daily_balance, tier)
  VALUES (NEW.id, 1000, 100, 'free');

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
  VALUES (NEW.id, 1000, 1000, 'signup_bonus', '가입 축하 크레딧');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_credits();

-- 일일 크레딧 리셋 함수
CREATE OR REPLACE FUNCTION reset_daily_credits()
RETURNS void AS $$
BEGIN
  UPDATE user_credits
  SET
    daily_balance = 100,
    daily_reset_at = NOW()
  WHERE daily_reset_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
