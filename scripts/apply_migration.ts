// 마이그레이션 적용 스크립트
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('=== business_plan_templates 테이블 컬럼 추가 ===\n')

  // 각 컬럼을 개별적으로 추가 (SQL에서 IF NOT EXISTS가 안되는 경우 대비)
  const alterCommands = [
    {
      name: 'formatting_rules',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS formatting_rules JSONB DEFAULT '{}'::jsonb`
    },
    {
      name: 'writing_guidelines',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS writing_guidelines JSONB DEFAULT '{}'::jsonb`
    },
    {
      name: 'evaluation_criteria',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB DEFAULT '[]'::jsonb`
    },
    {
      name: 'required_attachments',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS required_attachments JSONB DEFAULT '[]'::jsonb`
    },
    {
      name: 'parsing_status',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS parsing_status TEXT DEFAULT 'pending'`
    },
    {
      name: 'parsing_error',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS parsing_error TEXT`
    },
    {
      name: 'template_name',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS template_name TEXT`
    },
    {
      name: 'template_version',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS template_version TEXT DEFAULT '1.0'`
    },
    {
      name: 'source_document_url',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS source_document_url TEXT`
    },
    {
      name: 'program_id',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS program_id UUID`
    },
    {
      name: 'company_id',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS company_id UUID`
    },
    {
      name: 'sections',
      sql: `ALTER TABLE business_plan_templates ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb`
    }
  ]

  for (const cmd of alterCommands) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: cmd.sql })
      if (error) {
        // rpc가 없을 수 있으므로 무시하고 계속
        console.log(`⚠️  ${cmd.name}: RPC 방식 실패 (다른 방식 시도)`)
      } else {
        console.log(`✅ ${cmd.name} 컬럼 추가됨`)
      }
    } catch (e) {
      console.log(`⚠️  ${cmd.name}: 예외 발생`)
    }
  }

  // 테이블 현재 상태 확인
  console.log('\n=== 현재 테이블 상태 확인 ===')
  const { data, error } = await supabase
    .from('business_plan_templates')
    .select('*')
    .limit(1)

  if (error) {
    console.error('테이블 조회 실패:', error.message)
  } else {
    console.log('테이블 컬럼 목록:')
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]).join(', '))
    } else {
      console.log('(데이터 없음, 빈 테이블)')
      // 빈 테이블이면 INSERT로 테스트
      const { data: insertData, error: insertError } = await supabase
        .from('business_plan_templates')
        .insert({
          template_name: 'test_template',
          formatting_rules: { font_family: '맑은 고딕' }
        })
        .select()

      if (insertError) {
        console.log('테스트 INSERT 실패:', insertError.message)
        console.log('에러 코드:', insertError.code)
      } else {
        console.log('테스트 INSERT 성공!')
        // 삭제
        await supabase.from('business_plan_templates').delete().eq('template_name', 'test_template')
      }
    }
  }
}

applyMigration()
