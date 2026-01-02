import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient, apiResponse, apiError, getCurrentCompanyId, parsePaginationParams, parseSearchParams } from '@/lib/erp/api-utils'
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput } from '@/lib/erp/types'

// GET: 직원 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const companyId = await getCurrentCompanyId(request)

    if (!companyId) {
      return apiError('회사를 찾을 수 없습니다.', 404)
    }

    const { searchParams } = new URL(request.url)
    const { page, limit, sort_by, sort_order } = parsePaginationParams(searchParams)
    const { search, filters } = parseSearchParams(searchParams, ['department_id', 'position_id', 'status', 'hire_type'])

    let query = supabase
      .from('employees')
      .select(`
        *,
        department:departments!employees_department_id_fkey(id, name),
        position:positions!employees_position_id_fkey(id, name),
        location:business_locations!employees_location_id_fkey(id, name)
      `, { count: 'exact' })
      .eq('company_id', companyId)

    // 검색
    if (search) {
      query = query.or(`name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // 필터
    if (filters.department_id) {
      query = query.eq('department_id', filters.department_id)
    }
    if (filters.position_id) {
      query = query.eq('position_id', filters.position_id)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.hire_type) {
      query = query.eq('hire_type', filters.hire_type)
    }

    // 정렬 및 페이지네이션
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[ERP Employees] GET error:', error)
      return apiError('직원 목록을 불러올 수 없습니다.', 500)
    }

    return apiResponse({
      data,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('[ERP Employees] GET error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// POST: 직원 등록
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const companyId = await getCurrentCompanyId(request)

    if (!companyId) {
      return apiError('회사를 찾을 수 없습니다.', 404)
    }

    const body = await request.json()

    // 필수 필드 검증
    if (!body.name) {
      return apiError('이름은 필수입니다.')
    }

    // 프론트엔드 필드 → DB 필드 매핑
    const {
      password,
      password_confirm,
      birthday,
      location,
      mobile_phone,
      ...rest
    } = body

    // 사번 자동 생성 (없으면)
    let employeeNumber = rest.employee_number
    if (!employeeNumber) {
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const year = new Date().getFullYear().toString().slice(-2)
      employeeNumber = `${year}${String((count || 0) + 1).padStart(4, '0')}`
    }

    // DB에 저장할 데이터 준비
    const insertData: Record<string, any> = {
      ...rest,
      company_id: companyId,
      employee_number: employeeNumber,
      status: rest.status || 'active',
      hire_type: rest.hire_type || 'regular',
    }

    // 필드 매핑
    if (birthday) insertData.birth_date = birthday
    if (location) insertData.location_name = location
    if (mobile_phone) insertData.phone = mobile_phone

    // null/undefined UUID 필드 제거 (FK 에러 방지)
    if (!insertData.department_id) delete insertData.department_id
    if (!insertData.position_id) delete insertData.position_id
    if (!insertData.rank_id) delete insertData.rank_id
    if (!insertData.location_id) delete insertData.location_id

    const { data, error } = await supabase
      .from('employees')
      .insert(insertData)
      .select('*')
      .single()

    if (error) {
      console.error('[ERP Employees] POST error:', error)
      return apiError(`직원 등록 실패: ${error.message}`, 500)
    }

    return apiResponse(data, 201)
  } catch (error: any) {
    console.error('[ERP Employees] POST error:', error)
    return apiError(`서버 오류: ${error.message}`, 500)
  }
}
