/**
 * 소상공인진흥공단 (SEMAS) API 연동 모듈
 *
 * 소상공인마당: https://www.semas.or.kr
 * 공공데이터포털 API: https://www.data.go.kr/data/15084084/openapi.do
 */

// SEMAS 지원사업 분류
export const SEMAS_CATEGORIES = {
  '01': '정책자금',
  '02': '컨설팅',
  '03': '교육',
  '04': '판로지원',
  '05': '기술지원',
  '06': '창업지원',
  '07': '재기지원',
  '08': '소공인특화',
  '09': '전통시장',
  '10': '기타'
} as const

export type SemasCategory = keyof typeof SEMAS_CATEGORIES

// SEMAS API 응답 타입
export interface SemasProgram {
  pbancSn: string              // 공고일련번호
  pbancNm: string              // 공고명
  sprtTrgtNm: string           // 지원대상명
  rceptBgngDt: string          // 접수시작일자 (YYYY-MM-DD)
  rceptEndDt: string           // 접수종료일자 (YYYY-MM-DD)
  jrsdInsttNm: string          // 소관기관명
  excInsttNm?: string          // 수행기관명
  pbancUrl: string             // 공고URL
  sprtCn?: string              // 지원내용
  aplyMthdCn?: string          // 신청방법내용
  jrsdInsttTelno?: string      // 소관기관전화번호
  pbancSttusCd?: string        // 공고상태코드 (01:예정, 02:진행, 03:마감)
  sprtBizClsfNm?: string       // 지원사업분류명
  hashTag?: string             // 해시태그
}

export interface SemasApiResponse {
  header: {
    resultCode: string
    resultMsg: string
  }
  body: {
    items: SemasProgram[]
    totalCount: number
    pageNo: number
    numOfRows: number
  }
}

// API 호출 옵션
export interface SemasFetchOptions {
  category?: SemasCategory     // 분야
  pageNo?: number              // 페이지 번호
  numOfRows?: number           // 조회 건수 (max 100)
  onlyActive?: boolean         // 진행 중만
  keyword?: string             // 검색어
}

/**
 * SEMAS API에서 지원사업 목록 조회
 */
export async function fetchSemasPrograms(options: SemasFetchOptions = {}): Promise<SemasProgram[]> {
  const API_KEY = process.env.SEMAS_API_KEY

  if (!API_KEY) {
    console.warn('[SEMAS] API 키가 설정되지 않았습니다. SEMAS_API_KEY 환경변수를 확인하세요.')
    return getDemoPrograms()
  }

  const {
    category,
    pageNo = 1,
    numOfRows = 100,
    onlyActive = true,
    keyword
  } = options

  // 공공데이터포털 SEMAS API 엔드포인트
  const baseUrl = 'https://apis.data.go.kr/B553077/api/open/sdsc2/supportInfo'

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    pageNo: pageNo.toString(),
    numOfRows: numOfRows.toString(),
    resultType: 'json'
  })

  // 조건부 필터
  if (category) {
    params.append('sprtBizClsfCd', category)
  }
  if (onlyActive) {
    params.append('pbancSttusCd', '02') // 진행 중
  }
  if (keyword) {
    params.append('searchWrd', keyword)
  }

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 } // 1시간 캐시
    })

    if (!response.ok) {
      throw new Error(`SEMAS API error: ${response.status}`)
    }

    const data = await response.json()

    // 응답 구조 확인
    if (data.header?.resultCode !== '00' && data.header?.resultCode !== '0') {
      console.error('[SEMAS] API 오류:', data.header?.resultMsg)
      return getDemoPrograms()
    }

    // 다양한 응답 구조 처리
    if (data.body?.items?.item) {
      const items = data.body.items.item
      return Array.isArray(items) ? items : [items]
    }

    if (data.body?.items && Array.isArray(data.body.items)) {
      return data.body.items
    }

    if (data.response?.body?.items) {
      const items = data.response.body.items
      return Array.isArray(items) ? items : [items]
    }

    console.log('[SEMAS] 데이터 없음 또는 예상치 못한 응답 구조')
    return getDemoPrograms()

  } catch (error) {
    console.error('[SEMAS] API 호출 실패:', error)
    return getDemoPrograms()
  }
}

/**
 * 소상공인마당 웹페이지에서 공고 목록 스크래핑
 * API가 작동하지 않을 경우 대안
 */
export async function scrapeSemasPrograms(): Promise<SemasProgram[]> {
  try {
    // 소상공인마당 공고 목록 페이지
    const url = 'https://www.semas.or.kr/web/SUP/supportProgramList.do'

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    })

    if (!response.ok) {
      throw new Error(`SEMAS 스크래핑 실패: ${response.status}`)
    }

    const html = await response.text()

    // 간단한 HTML 파싱으로 데이터 추출
    const programs: SemasProgram[] = []

    // 테이블 행에서 데이터 추출 (정규식 기반)
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    const rows = html.match(rowRegex) || []

    for (const row of rows) {
      // 공고 제목 추출
      const titleMatch = row.match(/class="title"[^>]*>([^<]+)</i)
      const linkMatch = row.match(/href="([^"]*pbancSn=(\d+)[^"]*)"/i)
      const dateMatch = row.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/i)
      const orgMatch = row.match(/class="org"[^>]*>([^<]+)</i)

      if (titleMatch && linkMatch) {
        programs.push({
          pbancSn: linkMatch[2] || `semas_${Date.now()}_${programs.length}`,
          pbancNm: titleMatch[1].trim(),
          sprtTrgtNm: '소상공인',
          rceptBgngDt: dateMatch?.[1] || '',
          rceptEndDt: dateMatch?.[2] || '',
          jrsdInsttNm: orgMatch?.[1]?.trim() || '소상공인진흥공단',
          pbancUrl: linkMatch[1].startsWith('http')
            ? linkMatch[1]
            : `https://www.semas.or.kr${linkMatch[1]}`,
          pbancSttusCd: '02'
        })
      }
    }

    console.log(`[SEMAS] 스크래핑 ${programs.length}개 수집`)
    return programs.length > 0 ? programs : getDemoPrograms()

  } catch (error) {
    console.error('[SEMAS] 스크래핑 실패:', error)
    return getDemoPrograms()
  }
}

/**
 * DB 저장용 포맷으로 변환
 */
export function transformSemasProgram(program: SemasProgram) {
  // 카테고리 매핑
  const category = mapSemasCategory(program.sprtBizClsfNm)

  // 해시태그 추출
  const hashtags: string[] = []
  if (program.hashTag) {
    hashtags.push(...program.hashTag.split(',').map(t => t.trim()).filter(Boolean))
  }
  if (program.sprtBizClsfNm) {
    hashtags.push(program.sprtBizClsfNm)
  }
  if (program.sprtTrgtNm) {
    hashtags.push(program.sprtTrgtNm)
  }

  // 지원유형 추론
  const supportType = inferSemasSupportType(program.pbancNm, program.sprtBizClsfNm, program.hashTag)

  // 고유 ID
  const programId = program.pbancSn
    ? `semas_${program.pbancSn}`
    : `semas_${Buffer.from(program.pbancNm).toString('base64').slice(0, 20)}`

  return {
    program_id: programId,
    title: program.pbancNm,
    content: program.sprtCn || program.aplyMthdCn || null,
    category,
    support_type: supportType,
    hashtags: [...new Set(hashtags)], // 중복 제거
    organization: program.jrsdInsttNm || '소상공인진흥공단',
    executing_agency: program.excInsttNm || null,
    reception_agency: null,
    apply_start_date: formatDate(program.rceptBgngDt),
    apply_end_date: formatDate(program.rceptEndDt),
    detail_url: program.pbancUrl || 'https://www.semas.or.kr',
    source: 'semas',
    contact_phone: program.jrsdInsttTelno || null,
    fetched_at: new Date().toISOString()
  }
}

/**
 * 지원유형 추론 (제목, 분류, 해시태그 기반)
 */
function inferSemasSupportType(title: string, classification?: string, hashtags?: string): string {
  const text = `${title} ${classification || ''} ${hashtags || ''}`.toLowerCase()

  if (text.includes('융자') || text.includes('보증') || text.includes('대출') || text.includes('정책자금')) {
    return '융자보증'
  }
  if (text.includes('기술개발') || text.includes('r&d') || text.includes('연구개발')) {
    return '기술개발'
  }
  if (text.includes('사업화') || text.includes('마케팅') || text.includes('수출') || text.includes('판로')) {
    return '사업화'
  }
  if (text.includes('시설') || text.includes('입주') || text.includes('보육') || text.includes('공간')) {
    return '시설보육'
  }
  if (text.includes('멘토링') || text.includes('컨설팅') || text.includes('교육') || text.includes('코칭')) {
    return '멘토링'
  }
  if (text.includes('인력') || text.includes('채용') || text.includes('고용')) {
    return '인력'
  }
  if (text.includes('행사') || text.includes('박람회') || text.includes('전시회')) {
    return '행사'
  }

  return '기타'
}

/**
 * 날짜 형식 정규화
 */
function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null

  // YYYY-MM-DD 형식 확인
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // YYYYMMDD 형식 변환
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  }

  return null
}

/**
 * SEMAS 분류를 공통 카테고리로 매핑
 */
function mapSemasCategory(classification?: string): string {
  if (!classification) return '기타'

  const mapping: Record<string, string> = {
    '정책자금': '금융',
    '융자': '금융',
    '대출': '금융',
    '컨설팅': '경영',
    '경영지원': '경영',
    '교육': '인력',
    '역량강화': '인력',
    '판로': '내수',
    '마케팅': '내수',
    '온라인': '내수',
    '기술': '기술',
    '스마트화': '기술',
    '디지털': '기술',
    '창업': '창업',
    '재기': '창업',
    '재창업': '창업',
    '소공인': '기술',
    '전통시장': '내수',
    '시장': '내수',
    '상권': '내수',
    '해외': '수출',
    '수출': '수출'
  }

  for (const [keyword, category] of Object.entries(mapping)) {
    if (classification.includes(keyword)) {
      return category
    }
  }

  return '기타'
}

/**
 * 데모 데이터 (API 키 없을 때)
 */
function getDemoPrograms(): SemasProgram[] {
  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const endOfYear = new Date(today.getFullYear(), 11, 31)

  const formatDateStr = (date: Date) => date.toISOString().split('T')[0]

  return [
    {
      pbancSn: 'DEMO_SEMAS_001',
      pbancNm: '[데모] 2025년 소상공인 정책자금 융자지원',
      sprtTrgtNm: '소상공인',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(endOfYear),
      jrsdInsttNm: '소상공인진흥공단',
      excInsttNm: '소상공인시장진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '소상공인 사업자금 저금리 융자 지원',
      sprtBizClsfNm: '정책자금',
      hashTag: '정책자금,융자,소상공인',
      pbancSttusCd: '02'
    },
    {
      pbancSn: 'DEMO_SEMAS_002',
      pbancNm: '[데모] 2025년 소상공인 컨설팅 지원사업',
      sprtTrgtNm: '소상공인, 소기업',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(nextMonth),
      jrsdInsttNm: '소상공인진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '경영·마케팅·세무·법률 등 전문 컨설팅 지원',
      sprtBizClsfNm: '컨설팅',
      hashTag: '컨설팅,경영지원',
      pbancSttusCd: '02'
    },
    {
      pbancSn: 'DEMO_SEMAS_003',
      pbancNm: '[데모] 2025년 소상공인 스마트화 지원사업',
      sprtTrgtNm: '소상공인',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(nextMonth),
      jrsdInsttNm: '소상공인진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '키오스크, 스마트오더 등 디지털 장비 도입 지원',
      sprtBizClsfNm: '기술지원',
      hashTag: '스마트화,디지털전환,키오스크',
      pbancSttusCd: '02'
    },
    {
      pbancSn: 'DEMO_SEMAS_004',
      pbancNm: '[데모] 2025년 전통시장 활성화 지원',
      sprtTrgtNm: '전통시장 상인',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(endOfYear),
      jrsdInsttNm: '소상공인진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '전통시장 현대화, 마케팅, 온라인 판로 지원',
      sprtBizClsfNm: '전통시장',
      hashTag: '전통시장,상권활성화,마케팅',
      pbancSttusCd: '02'
    },
    {
      pbancSn: 'DEMO_SEMAS_005',
      pbancNm: '[데모] 2025년 소상공인 재기지원 사업',
      sprtTrgtNm: '폐업 소상공인, 재창업자',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(nextMonth),
      jrsdInsttNm: '소상공인진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '폐업 소상공인 재기·재창업 종합 지원',
      sprtBizClsfNm: '재기지원',
      hashTag: '재기,재창업,희망리턴',
      pbancSttusCd: '02'
    },
    {
      pbancSn: 'DEMO_SEMAS_006',
      pbancNm: '[데모] 2025년 소상공인 온라인 판로지원',
      sprtTrgtNm: '소상공인',
      rceptBgngDt: formatDateStr(today),
      rceptEndDt: formatDateStr(endOfYear),
      jrsdInsttNm: '소상공인진흥공단',
      pbancUrl: 'https://www.semas.or.kr',
      sprtCn: '온라인 쇼핑몰 입점, 라이브커머스, 배달앱 연계 지원',
      sprtBizClsfNm: '판로지원',
      hashTag: '온라인판로,이커머스,배달앱',
      pbancSttusCd: '02'
    }
  ]
}
