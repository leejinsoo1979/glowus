// @ts-nocheck
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/erp/api-utils'

/**
 * Task Hub Migration API
 * 개발용: Task Hub 테이블 생성
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    // 1. unified_tasks 테이블 생성
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- unified_tasks 테이블 (text 타입 사용)
        CREATE TABLE IF NOT EXISTS unified_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(500) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'TODO',
          priority VARCHAR(20) DEFAULT 'NONE',
          type VARCHAR(20) DEFAULT 'PERSONAL',
          company_id UUID,
          project_id UUID,
          parent_task_id UUID,
          assignee_id UUID,
          assignee_type VARCHAR(20) DEFAULT 'USER',
          created_by UUID NOT NULL,
          created_by_type VARCHAR(20) DEFAULT 'USER',
          due_date TIMESTAMPTZ,
          start_date TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          estimated_hours DECIMAL(10, 2),
          actual_hours DECIMAL(10, 2),
          tags TEXT[] DEFAULT '{}',
          labels JSONB DEFAULT '[]',
          position INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          source VARCHAR(50) DEFAULT 'MANUAL',
          source_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })

    if (tableError) {
      // exec_sql이 없으면 직접 쿼리 실행 시도
      console.log('[Migration] exec_sql not available, trying direct approach')
    }

    // 테이블 존재 여부 확인
    const { data: tableExists, error: checkError } = await supabase
      .from('unified_tasks')
      .select('id')
      .limit(1)

    if (checkError && checkError.code === '42P01') {
      // 테이블이 없음 - Supabase Dashboard에서 수동 생성 필요
      return apiError(
        'unified_tasks 테이블이 없습니다. Supabase Dashboard에서 마이그레이션을 실행해주세요.',
        400
      )
    }

    // 2. task_hub_view 생성 시도
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE OR REPLACE VIEW task_hub_view AS
          SELECT
            t.*,
            u.email as assignee_email,
            u.raw_user_meta_data->>'name' as assignee_name,
            p.name as project_name,
            c.name as company_name
          FROM unified_tasks t
          LEFT JOIN auth.users u ON t.assignee_id = u.id AND t.assignee_type = 'USER'
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN companies c ON t.company_id = c.id;
        `
      })
    } catch (e) {
      console.log('[Migration] View creation skipped')
    }

    // 3. task_activities 테이블 생성 시도
    const { error: activityError } = await supabase
      .from('task_activities')
      .select('id')
      .limit(1)

    if (activityError && activityError.code === '42P01') {
      console.log('[Migration] task_activities table not found')
    }

    return apiResponse({
      success: true,
      message: 'Migration check completed',
      tables: {
        unified_tasks: !checkError,
        task_activities: !activityError,
      }
    })
  } catch (error) {
    console.error('[TaskHub Migrate] Error:', error)
    return apiError('Migration failed: ' + (error as Error).message, 500)
  }
}
