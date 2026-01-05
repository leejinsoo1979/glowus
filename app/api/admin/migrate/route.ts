// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

export const dynamic = 'force-dynamic'

const KNOWLEDGE_BASE_MIGRATION = `
-- 1. company_knowledge_entries 테이블
CREATE TABLE IF NOT EXISTS company_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    source_type VARCHAR(50),
    source_url TEXT,
    source_file_path TEXT,
    is_verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. company_team_members 테이블
CREATE TABLE IF NOT EXISTS company_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    role VARCHAR(100),
    department VARCHAR(100),
    career_history JSONB DEFAULT '[]'::jsonb,
    education JSONB DEFAULT '[]'::jsonb,
    expertise TEXT[],
    skills TEXT[],
    certifications JSONB DEFAULT '[]'::jsonb,
    achievements TEXT,
    publications TEXT[],
    patents TEXT[],
    email VARCHAR(200),
    linkedin_url TEXT,
    bio TEXT,
    photo_url TEXT,
    is_key_member BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. company_products 테이블
CREATE TABLE IF NOT EXISTS company_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    product_type VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    key_features JSONB DEFAULT '[]'::jsonb,
    target_customers TEXT,
    use_cases TEXT[],
    core_technology TEXT,
    tech_stack TEXT[],
    patents TEXT[],
    pricing_model VARCHAR(100),
    price_range VARCHAR(100),
    launch_date DATE,
    development_stage VARCHAR(50),
    user_count INTEGER,
    revenue_contribution DECIMAL(5,2),
    customer_testimonials JSONB DEFAULT '[]'::jsonb,
    product_images JSONB DEFAULT '[]'::jsonb,
    demo_url TEXT,
    documentation_url TEXT,
    is_flagship BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. company_achievements 테이블
CREATE TABLE IF NOT EXISTS company_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    issuer VARCHAR(200),
    date DATE,
    expiry_date DATE,
    related_product_id UUID,
    related_project VARCHAR(200),
    certificate_url TEXT,
    news_url TEXT,
    evidence_files JSONB DEFAULT '[]'::jsonb,
    category VARCHAR(100),
    tags TEXT[],
    importance_level INTEGER DEFAULT 1,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. company_financials 테이블
CREATE TABLE IF NOT EXISTS company_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER,
    revenue DECIMAL(15,2),
    operating_profit DECIMAL(15,2),
    net_profit DECIMAL(15,2),
    cost_breakdown JSONB DEFAULT '{}'::jsonb,
    total_assets DECIMAL(15,2),
    total_liabilities DECIMAL(15,2),
    equity DECIMAL(15,2),
    investments_received JSONB DEFAULT '[]'::jsonb,
    yoy_revenue_growth DECIMAL(5,2),
    yoy_profit_growth DECIMAL(5,2),
    employee_count INTEGER,
    customer_count INTEGER,
    is_audited BOOLEAN DEFAULT false,
    auditor VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. program_requirements 테이블
CREATE TABLE IF NOT EXISTS program_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    eligibility_criteria JSONB DEFAULT '{}'::jsonb,
    evaluation_criteria JSONB DEFAULT '[]'::jsonb,
    required_documents JSONB DEFAULT '[]'::jsonb,
    plan_format_requirements JSONB DEFAULT '{}'::jsonb,
    writing_tips JSONB DEFAULT '[]'::jsonb,
    success_case_keywords TEXT[],
    cautions TEXT[],
    parsed_at TIMESTAMPTZ DEFAULT NOW(),
    parsed_by VARCHAR(100),
    confidence_score DECIMAL(5,2),
    source_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id)
);

-- 7. company_market_data 테이블
CREATE TABLE IF NOT EXISTS company_market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    industry_code VARCHAR(20),
    industry_name VARCHAR(200),
    tam DECIMAL(15,2),
    sam DECIMAL(15,2),
    som DECIMAL(15,2),
    market_size_year INTEGER,
    market_growth_rate DECIMAL(5,2),
    competitors JSONB DEFAULT '[]'::jsonb,
    swot_analysis JSONB DEFAULT '{}'::jsonb,
    market_trends TEXT[],
    opportunities TEXT[],
    threats TEXT[],
    data_sources JSONB DEFAULT '[]'::jsonb,
    data_as_of DATE,
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

/**
 * POST: 마이그레이션 실행
 */
export async function POST(request: NextRequest) {
  if (!isDevMode()) {
    return NextResponse.json({ error: 'Only available in dev mode' }, { status: 403 })
  }

  try {
    const adminSupabase = createAdminClient()

    // 개별 테이블 생성 쿼리로 분할
    const tables = [
      {
        name: 'company_knowledge_entries',
        sql: `CREATE TABLE IF NOT EXISTS company_knowledge_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          category VARCHAR(50) NOT NULL,
          subcategory VARCHAR(100),
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          tags TEXT[] DEFAULT '{}',
          metadata JSONB DEFAULT '{}'::jsonb,
          source_type VARCHAR(50),
          source_url TEXT,
          source_file_path TEXT,
          is_verified BOOLEAN DEFAULT false,
          verification_date TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'company_team_members',
        sql: `CREATE TABLE IF NOT EXISTS company_team_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          name VARCHAR(100) NOT NULL,
          position VARCHAR(100),
          role VARCHAR(100),
          department VARCHAR(100),
          career_history JSONB DEFAULT '[]'::jsonb,
          education JSONB DEFAULT '[]'::jsonb,
          expertise TEXT[],
          skills TEXT[],
          certifications JSONB DEFAULT '[]'::jsonb,
          achievements TEXT,
          publications TEXT[],
          patents TEXT[],
          email VARCHAR(200),
          linkedin_url TEXT,
          bio TEXT,
          photo_url TEXT,
          is_key_member BOOLEAN DEFAULT false,
          display_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'company_products',
        sql: `CREATE TABLE IF NOT EXISTS company_products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          name VARCHAR(200) NOT NULL,
          product_type VARCHAR(50),
          category VARCHAR(100),
          description TEXT,
          key_features JSONB DEFAULT '[]'::jsonb,
          target_customers TEXT,
          use_cases TEXT[],
          core_technology TEXT,
          tech_stack TEXT[],
          patents TEXT[],
          pricing_model VARCHAR(100),
          price_range VARCHAR(100),
          launch_date DATE,
          development_stage VARCHAR(50),
          user_count INTEGER,
          revenue_contribution DECIMAL(5,2),
          customer_testimonials JSONB DEFAULT '[]'::jsonb,
          product_images JSONB DEFAULT '[]'::jsonb,
          demo_url TEXT,
          documentation_url TEXT,
          is_flagship BOOLEAN DEFAULT false,
          display_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'company_achievements',
        sql: `CREATE TABLE IF NOT EXISTS company_achievements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          achievement_type VARCHAR(50) NOT NULL,
          title VARCHAR(300) NOT NULL,
          description TEXT,
          issuer VARCHAR(200),
          date DATE,
          expiry_date DATE,
          related_product_id UUID,
          related_project VARCHAR(200),
          certificate_url TEXT,
          news_url TEXT,
          evidence_files JSONB DEFAULT '[]'::jsonb,
          category VARCHAR(100),
          tags TEXT[],
          importance_level INTEGER DEFAULT 1,
          is_featured BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'company_financials',
        sql: `CREATE TABLE IF NOT EXISTS company_financials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          fiscal_year INTEGER NOT NULL,
          fiscal_quarter INTEGER,
          revenue DECIMAL(15,2),
          operating_profit DECIMAL(15,2),
          net_profit DECIMAL(15,2),
          cost_breakdown JSONB DEFAULT '{}'::jsonb,
          total_assets DECIMAL(15,2),
          total_liabilities DECIMAL(15,2),
          equity DECIMAL(15,2),
          investments_received JSONB DEFAULT '[]'::jsonb,
          yoy_revenue_growth DECIMAL(5,2),
          yoy_profit_growth DECIMAL(5,2),
          employee_count INTEGER,
          customer_count INTEGER,
          is_audited BOOLEAN DEFAULT false,
          auditor VARCHAR(200),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'program_requirements',
        sql: `CREATE TABLE IF NOT EXISTS program_requirements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          program_id UUID NOT NULL,
          eligibility_criteria JSONB DEFAULT '{}'::jsonb,
          evaluation_criteria JSONB DEFAULT '[]'::jsonb,
          required_documents JSONB DEFAULT '[]'::jsonb,
          plan_format_requirements JSONB DEFAULT '{}'::jsonb,
          writing_tips JSONB DEFAULT '[]'::jsonb,
          success_case_keywords TEXT[],
          cautions TEXT[],
          parsed_at TIMESTAMPTZ DEFAULT NOW(),
          parsed_by VARCHAR(100),
          confidence_score DECIMAL(5,2),
          source_urls TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'company_market_data',
        sql: `CREATE TABLE IF NOT EXISTS company_market_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id UUID,
          industry_code VARCHAR(20),
          industry_name VARCHAR(200),
          tam DECIMAL(15,2),
          sam DECIMAL(15,2),
          som DECIMAL(15,2),
          market_size_year INTEGER,
          market_growth_rate DECIMAL(5,2),
          competitors JSONB DEFAULT '[]'::jsonb,
          swot_analysis JSONB DEFAULT '{}'::jsonb,
          market_trends TEXT[],
          opportunities TEXT[],
          threats TEXT[],
          data_sources JSONB DEFAULT '[]'::jsonb,
          data_as_of DATE,
          expires_at DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      }
    ]

    const results: any[] = []

    for (const table of tables) {
      try {
        // Supabase JS client로는 직접 DDL 실행 불가능하므로
        // 테이블 존재 여부만 확인
        const { data, error } = await adminSupabase
          .from(table.name)
          .select('id')
          .limit(1)

        if (error && error.code === '42P01') {
          // 테이블 없음 - SQL 파일로 생성해야 함
          results.push({ table: table.name, status: 'not_exists', message: 'Run SQL migration manually' })
        } else if (error) {
          results.push({ table: table.name, status: 'error', error: error.message })
        } else {
          results.push({ table: table.name, status: 'exists' })
        }
      } catch (e: any) {
        results.push({ table: table.name, status: 'error', error: e.message })
      }
    }

    return NextResponse.json({
      success: true,
      message: '테이블 상태 확인 완료. SQL 마이그레이션은 Supabase 대시보드에서 실행하세요.',
      results,
      migration_sql: KNOWLEDGE_BASE_MIGRATION
    })

  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET: 테이블 상태 확인
 */
export async function GET(request: NextRequest) {
  if (!isDevMode()) {
    return NextResponse.json({ error: 'Only available in dev mode' }, { status: 403 })
  }

  try {
    const adminSupabase = createAdminClient()

    const tables = [
      'company_knowledge_entries',
      'company_team_members',
      'company_products',
      'company_achievements',
      'company_financials',
      'program_requirements',
      'company_market_data'
    ]

    const results: any[] = []

    for (const tableName of tables) {
      try {
        const { count, error } = await adminSupabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (error) {
          results.push({ table: tableName, exists: false, error: error.message })
        } else {
          results.push({ table: tableName, exists: true, count })
        }
      } catch (e: any) {
        results.push({ table: tableName, exists: false, error: e.message })
      }
    }

    return NextResponse.json({ success: true, tables: results })

  } catch (error: any) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
