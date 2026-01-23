import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient, apiResponse, apiError, getCurrentCompanyId } from '@/lib/erp/api-utils'
import type { Company, CreateCompanyInput, UpdateCompanyInput } from '@/lib/erp/types'

// GET: 회사 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const companyId = await getCurrentCompanyId(request)

    if (!companyId) {
      // 회사가 없으면 빈 응답
      return apiResponse(null)
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (error) {
      console.error('[ERP Company] GET error:', error)
      return apiError('회사 정보를 불러올 수 없습니다.', 500)
    }

    return apiResponse(data)
  } catch (error) {
    console.error('[ERP Company] GET error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// POST: 회사 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body: CreateCompanyInput = await request.json()

    // 필수 필드 검증
    if (!body.name) {
      return apiError('회사명은 필수입니다.')
    }

    // user_id 설정 (DEV 모드에서는 임시 UUID)
    const userId = body.user_id || (process.env.NODE_ENV === 'development' ? '00000000-0000-0000-0000-000000000000' : null)

    if (!userId) {
      return apiError('인증이 필요합니다.', 401)
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        ...body,
        user_id: userId,
        settings: body.settings || {},
      })
      .select()
      .single()

    if (error) {
      console.error('[ERP Company] POST error:', error)
      return apiError('회사 생성에 실패했습니다.', 500)
    }

    return apiResponse(data, 201)
  } catch (error) {
    console.error('[ERP Company] POST error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// PUT: 회사 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const companyId = await getCurrentCompanyId(request)

    if (!companyId) {
      return apiError('회사를 찾을 수 없습니다.', 404)
    }

    const body: UpdateCompanyInput = await request.json()

    // 데이터베이스에 존재하는 컬럼만 필터링
    const allowedFields = [
      'name', 'business_number', 'corporate_number', 'ceo_name',
      'phone', 'fax', 'email', 'website',
      'postal_code', 'address', 'address_detail',
      'business_type', 'business_category', 'establishment_date',
      'fiscal_year_start', 'logo_url', 'business_registration_url', 'settings'
    ]

    const filteredBody: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        filteredBody[key] = (body as any)[key]
      }
    }

    const { data, error } = await supabase
      .from('companies')
      .update({
        ...filteredBody,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select()
      .single()

    if (error) {
      console.error('[ERP Company] PUT error:', error)
      return apiError('회사 정보 수정에 실패했습니다.', 500)
    }

    return apiResponse(data)
  } catch (error) {
    console.error('[ERP Company] PUT error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
