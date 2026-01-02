/**
 * 기업마당(Bizinfo) API 연동 모듈
 * https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
 */

// 분야별 코드
export const BIZINFO_CATEGORIES = {
  '001': '금융',
  '002': '기술',
  '003': '인력',
  '004': '수출',
  '005': '내수',
  '006': '창업',
  '007': '경영',
  '008': '기타',
  '009': '코로나19'
} as const

export type BizinfoCategory = keyof typeof BIZINFO_CATEGORIES

// API 응답 타입
export interface BizinfoProgram {
  pblancId: string          // 공고 ID
  pblancNm: string          // 공고명
  jrsdInsttNm: string       // 소관기관
  excInsttNm?: string       // 수행기관
  rcptInsttNm?: string      // 접수기관
  reqstBeginDe?: string     // 신청시작일 (YYYYMMDD)
  reqstEndDe?: string       // 신청종료일 (YYYYMMDD)
  pblancUrl?: string        // 상세 URL
  hashtags?: string         // 해시태그 (쉼표 구분)
  searchLclasNm?: string    // 분야명
  registDe?: string         // 등록일
}

export interface BizinfoApiResponse {
  jsonArray?: BizinfoProgram[]
  totalCount?: number
  resultCode?: string
  resultMsg?: string
}

// API 호출 옵션
export interface BizinfoFetchOptions {
  category?: BizinfoCategory  // 분야
  searchCount?: number        // 조회 건수 (max 500)
  pageIndex?: number          // 페이지 번호
  hashtags?: string[]         // 해시태그 필터
}

/**
 * 기업마당 API에서 지원사업 목록 조회
 */
export async function fetchBizinfoPrograms(options: BizinfoFetchOptions = {}): Promise<BizinfoProgram[]> {
  const API_KEY = process.env.BIZINFO_API_KEY

  if (!API_KEY) {
    console.warn('[Bizinfo] API 키가 설정되지 않았습니다. BIZINFO_API_KEY 환경변수를 확인하세요.')
    // 데모 데이터 반환
    return getDemoPrograms()
  }

  const params = new URLSearchParams({
    crtfcKey: API_KEY,
    dataType: 'json',
    searchCnt: String(options.searchCount || 100),
    pageIndex: String(options.pageIndex || 1)
  })

  if (options.category) {
    params.append('searchLclasId', options.category)
  }

  if (options.hashtags?.length) {
    params.append('hashtags', options.hashtags.join(','))
  }

  try {
    const response = await fetch(
      `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 3600 } // 1시간 캐시
      }
    )

    if (!response.ok) {
      throw new Error(`Bizinfo API error: ${response.status}`)
    }

    const data: BizinfoApiResponse = await response.json()

    if (data.resultCode && data.resultCode !== '00') {
      console.error('[Bizinfo] API 오류:', data.resultMsg)
      return []
    }

    return data.jsonArray || []
  } catch (error) {
    console.error('[Bizinfo] API 호출 실패:', error)
    return getDemoPrograms()
  }
}

/**
 * 날짜 문자열 파싱 (YYYYMMDD -> Date)
 */
export function parseBizinfoDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr.length !== 8) return null

  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))

  return new Date(year, month, day)
}

/**
 * DB 저장용 포맷으로 변환
 */
export function transformBizinfoProgram(program: BizinfoProgram) {
  return {
    program_id: program.pblancId,
    title: program.pblancNm,
    category: program.searchLclasNm || '기타',
    hashtags: program.hashtags?.split(',').map(t => t.trim()).filter(Boolean) || [],
    organization: program.jrsdInsttNm,
    executing_agency: program.excInsttNm || null,
    reception_agency: program.rcptInsttNm || null,
    apply_start_date: parseBizinfoDate(program.reqstBeginDe)?.toISOString().split('T')[0] || null,
    apply_end_date: parseBizinfoDate(program.reqstEndDe)?.toISOString().split('T')[0] || null,
    detail_url: program.pblancUrl || `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${program.pblancId}`,
    source: 'bizinfo',
    fetched_at: new Date().toISOString()
  }
}

/**
 * 데모 데이터 (API 키 없을 때)
 */
function getDemoPrograms(): BizinfoProgram[] {
  return [
    {
      pblancId: 'DEMO_001',
      pblancNm: '[데모] 2025년 창업성장기술개발사업 시행계획 공고',
      jrsdInsttNm: '중소벤처기업부',
      excInsttNm: '중소기업기술정보진흥원',
      rcptInsttNm: '중소기업기술정보진흥원',
      reqstBeginDe: '20250101',
      reqstEndDe: '20250228',
      searchLclasNm: '기술',
      hashtags: '창업,기술개발,R&D'
    },
    {
      pblancId: 'DEMO_002',
      pblancNm: '[데모] 2025년 청년창업사관학교 입교생 모집',
      jrsdInsttNm: '중소벤처기업부',
      excInsttNm: '창업진흥원',
      reqstBeginDe: '20250115',
      reqstEndDe: '20250315',
      searchLclasNm: '창업',
      hashtags: '청년,창업,교육'
    },
    {
      pblancId: 'DEMO_003',
      pblancNm: '[데모] 2025년 수출바우처 지원사업 참여기업 모집',
      jrsdInsttNm: '중소벤처기업부',
      excInsttNm: '중소벤처기업진흥공단',
      reqstBeginDe: '20250201',
      reqstEndDe: '20250331',
      searchLclasNm: '수출',
      hashtags: '수출,해외진출,바우처'
    },
    {
      pblancId: 'DEMO_004',
      pblancNm: '[데모] 2025년 중소기업 정책자금 융자계획 공고',
      jrsdInsttNm: '중소벤처기업부',
      excInsttNm: '중소벤처기업진흥공단',
      reqstBeginDe: '20250101',
      reqstEndDe: '20251231',
      searchLclasNm: '금융',
      hashtags: '정책자금,융자,대출'
    },
    {
      pblancId: 'DEMO_005',
      pblancNm: '[데모] 2025년 스마트공장 구축 및 고도화 지원사업',
      jrsdInsttNm: '중소벤처기업부',
      excInsttNm: '중소기업기술정보진흥원',
      reqstBeginDe: '20250115',
      reqstEndDe: '20250228',
      searchLclasNm: '기술',
      hashtags: '스마트공장,제조혁신,자동화'
    }
  ]
}
