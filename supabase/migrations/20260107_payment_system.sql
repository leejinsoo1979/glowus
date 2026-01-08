-- =====================================================
-- GlowUS 결제 시스템 (토스페이먼츠 + Stripe)
-- =====================================================

-- 결제 내역 테이블
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 결제 정보
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('toss', 'stripe')),
  payment_key VARCHAR(255),  -- 토스: paymentKey, Stripe: payment_intent_id
  order_id VARCHAR(255) NOT NULL UNIQUE,  -- 주문번호 (우리가 생성)

  -- 금액
  amount INTEGER NOT NULL,  -- 원화 기준
  currency VARCHAR(3) DEFAULT 'KRW',

  -- 상품 정보
  product_type VARCHAR(50) NOT NULL,  -- 'subscription', 'credits', 'one_time'
  product_id VARCHAR(100),  -- 구독 티어 또는 크레딧 패키지 ID
  product_name VARCHAR(255),

  -- 상태
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'ready', 'in_progress', 'done', 'canceled',
    'partial_canceled', 'aborted', 'expired', 'failed'
  )),

  -- 결제 수단
  method VARCHAR(50),  -- 'card', 'transfer', 'virtual_account', 'mobile', 'easy_pay'
  card_company VARCHAR(50),
  card_number VARCHAR(20),  -- 마스킹된 카드번호

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 타임스탬프
  requested_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 구독 테이블 (기존 subscriptions 보강)
CREATE TABLE IF NOT EXISTS payment_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 결제 제공자
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('toss', 'stripe')),

  -- 토스 빌링키 / Stripe 구독 ID
  billing_key VARCHAR(255),  -- 토스: billingKey
  stripe_subscription_id VARCHAR(255),  -- Stripe: sub_xxx
  stripe_customer_id VARCHAR(255),  -- Stripe: cus_xxx

  -- 구독 정보
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'pro', 'enterprise')),
  price_krw INTEGER NOT NULL,  -- 원화 가격
  price_usd DECIMAL(10,2),  -- 달러 가격 (Stripe용)

  -- 상태
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'past_due', 'canceled', 'unpaid', 'paused'
  )),

  -- 결제 주기
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,

  -- 다음 결제
  next_billing_date TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

-- 크레딧 패키지 (일회성 구매용)
CREATE TABLE IF NOT EXISTS credit_packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL,
  price_krw INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  bonus_credits INTEGER DEFAULT 0,  -- 보너스 크레딧
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 크레딧 패키지 삽입
INSERT INTO credit_packages (id, name, credits, price_krw, price_usd, bonus_credits) VALUES
  ('credits_1000', '1,000 크레딧', 1000, 5000, 4.00, 0),
  ('credits_5000', '5,000 크레딧', 5000, 20000, 16.00, 500),
  ('credits_10000', '10,000 크레딧', 10000, 35000, 28.00, 1500),
  ('credits_50000', '50,000 크레딧', 50000, 150000, 120.00, 10000)
ON CONFLICT (id) DO NOTHING;

-- 구독 플랜 테이블
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  credits INTEGER NOT NULL,  -- 월간 크레딧
  price_krw INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]',
  stripe_price_id VARCHAR(100),  -- Stripe Price ID
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 구독 플랜 삽입
INSERT INTO subscription_plans (id, name, tier, credits, price_krw, price_usd, features) VALUES
  ('plan_basic', 'Basic', 'basic', 30000, 26000, 20.00,
    '["월 30,000 크레딧", "AI 매칭 무제한", "사업계획서 생성 50회", "이메일 지원"]'::jsonb),
  ('plan_pro', 'Pro', 'pro', 100000, 65000, 50.00,
    '["월 100,000 크레딧", "AI 매칭 무제한", "사업계획서 생성 무제한", "우선 지원", "API 액세스"]'::jsonb),
  ('plan_enterprise', 'Enterprise', 'enterprise', -1, 260000, 200.00,
    '["무제한 크레딧", "전용 에이전트", "커스텀 통합", "전담 매니저", "SLA 보장"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_user_id ON payment_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_status ON payment_subscriptions(status);

-- RLS 정책
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 결제 내역만 조회
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
  ON payment_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- 크레딧 패키지/구독 플랜은 모두 조회 가능
CREATE POLICY "Anyone can view credit packages"
  ON credit_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Service role은 모든 작업 가능
CREATE POLICY "Service role full access on payments"
  ON payments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access on payment_subscriptions"
  ON payment_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
