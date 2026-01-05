/**
 * 기업마당(Bizinfo) 행사정보 API 연동 모듈
 * https://www.bizinfo.go.kr/uss/rss/bizinfoEventApi.do
 */

// 행사 유형
export const EVENT_TYPES = {
  '교육': '교육',
  '세미나': '세미나',
  '전시회': '전시회',
  '박람회': '박람회',
  '기타': '기타'
} as const

// API 응답 타입
export interface BizinfoEvent {
  eventInfoId: string           // 행사 ID
  nttNm: string                 // 행사명
  eventInfoTyNm: string         // 행사 유형 (교육, 세미나 등)
  originEngnNm: string          // 주최기관
  areaNm: string                // 지역
  eventBeginEndDe: string       // 행사 기간 (YYYYMMDD ~ YYYYMMDD)
  rceptPd: string               // 접수 기간
  nttCn?: string                // 행사 내용
  bizinfoUrl?: string           // 상세 URL
  orginlUrlAdres?: string       // 원본 URL
  hashtags?: string             // 해시태그
  printFlpthNm?: string         // 이미지 URL
  pldirSportRealmLclasCodeNm?: string  // 분야
  pldirSportRealmMlsfcCodeNm?: string  // 세부분야
  registDe?: string             // 등록일
  totCnt?: number               // 전체 개수
}

export interface BizinfoEventApiResponse {
  jsonArray?: BizinfoEvent[]
  resultCode?: string
  resultMsg?: string
}

// API 호출 옵션
export interface BizinfoEventFetchOptions {
  searchCount?: number        // 조회 건수 (max 500)
  pageIndex?: number          // 페이지 번호
  hashtags?: string[]         // 해시태그 필터
}

/**
 * 기업마당 행사정보 API에서 행사 목록 조회
 */
export async function fetchBizinfoEvents(options: BizinfoEventFetchOptions = {}): Promise<BizinfoEvent[]> {
  const API_KEY = process.env.BIZINFO_API_KEY

  if (!API_KEY) {
    console.warn('[BizinfoEvents] API 키가 설정되지 않았습니다.')
    return getDemoEvents()
  }

  const params = new URLSearchParams({
    crtfcKey: API_KEY,
    dataType: 'json',
    pageUnit: String(options.searchCount || 100),
    pageIndex: String(options.pageIndex || 1)
  })

  if (options.hashtags?.length) {
    params.append('hashtags', options.hashtags.join(','))
  }

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoEventApi.do?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`BizinfoEvents API error: ${response.status}`)
    }

    const data: BizinfoEventApiResponse = await response.json()

    if (data.resultCode && data.resultCode !== '00') {
      console.error('[BizinfoEvents] API 오류:', data.resultMsg)
      return []
    }

    return data.jsonArray || []
  } catch (error) {
    console.error('[BizinfoEvents] API 호출 실패:', error)
    return getDemoEvents()
  }
}

/**
 * 날짜 문자열 파싱 (YYYYMMDD ~ YYYYMMDD -> start, end)
 */
export function parseEventPeriod(periodStr?: string): { start: Date | null; end: Date | null } {
  if (!periodStr) return { start: null, end: null }

  const parts = periodStr.split('~').map(s => s.trim())

  const parseDate = (str: string): Date | null => {
    if (!str || str.length < 8) return null
    const clean = str.replace(/[^0-9]/g, '')
    if (clean.length !== 8) return null

    const year = parseInt(clean.substring(0, 4))
    const month = parseInt(clean.substring(4, 6)) - 1
    const day = parseInt(clean.substring(6, 8))

    return new Date(year, month, day)
  }

  return {
    start: parseDate(parts[0]),
    end: parts[1] ? parseDate(parts[1]) : parseDate(parts[0])
  }
}

/**
 * DB 저장용 포맷으로 변환 (government_programs 테이블 스키마와 호환)
 */
export function transformBizinfoEvent(event: BizinfoEvent) {
  const period = parseEventPeriod(event.eventBeginEndDe)

  return {
    program_id: event.eventInfoId,
    title: event.nttNm,
    category: event.pldirSportRealmLclasCodeNm || event.eventInfoTyNm || '행사',
    support_type: '행사', // 행사정보는 항상 '행사' 유형
    hashtags: event.hashtags?.split(',').map(t => t.trim()).filter(Boolean) || [],
    organization: event.originEngnNm,
    executing_agency: null,
    reception_agency: null,
    // 행사 기간을 신청 기간으로 매핑 (대시보드에 표시용)
    apply_start_date: period.start?.toISOString().split('T')[0] || null,
    apply_end_date: period.end?.toISOString().split('T')[0] || null,
    detail_url: event.bizinfoUrl
      ? `https://www.bizinfo.go.kr${event.bizinfoUrl}`
      : event.orginlUrlAdres || null,
    source: 'bizinfo_event', // 행사정보는 별도 소스로 구분
    fetched_at: new Date().toISOString()
  }
}

/**
 * 데모 데이터 (API 키 없을 때)
 */
function getDemoEvents(): BizinfoEvent[] {
  return [
    {
      eventInfoId: 'DEMO_EVENT_001',
      nttNm: '[데모] 2026년 스타트업 성장 전략 세미나',
      eventInfoTyNm: '세미나',
      originEngnNm: '중소벤처기업부',
      areaNm: '서울',
      eventBeginEndDe: '20260115 ~ 20260115',
      rceptPd: '~2026-01-10',
      nttCn: '스타트업 성장을 위한 전략 세미나입니다.',
      hashtags: '창업,스타트업,성장전략',
      pldirSportRealmLclasCodeNm: '창업'
    },
    {
      eventInfoId: 'DEMO_EVENT_002',
      nttNm: '[데모] 2026년 중소기업 수출 실무 교육',
      eventInfoTyNm: '교육',
      originEngnNm: '대한상공회의소',
      areaNm: '서울',
      eventBeginEndDe: '20260120 ~ 20260121',
      rceptPd: '~2026-01-15',
      nttCn: '중소기업 수출 실무자를 위한 교육 과정입니다.',
      hashtags: '수출,교육,실무',
      pldirSportRealmLclasCodeNm: '수출'
    }
  ]
}
