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
    return getDemoPrograms()
  }

  const params = new URLSearchParams({
    crtfcKey: API_KEY,
    dataType: 'json',
    pageUnit: String(options.searchCount || 100),
    pageIndex: String(options.pageIndex || 1)
  })

  // 해시태그 필터 (카테고리 필터는 API에서 지원하지 않음)
  if (options.hashtags?.length) {
    params.append('hashtags', options.hashtags.join(','))
  }

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })

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
 * 지원유형 추론 (제목, 해시태그 기반)
 */
function inferSupportType(title: string, hashtags?: string, category?: string): string {
  const text = `${title} ${hashtags || ''} ${category || ''}`.toLowerCase()

  // 융자/보증
  if (text.includes('융자') || text.includes('보증') || text.includes('대출') || text.includes('정책자금')) {
    return '융자보증'
  }
  // 기술개발/R&D
  if (text.includes('기술개발') || text.includes('r&d') || text.includes('연구개발') || text.includes('기술혁신')) {
    return '기술개발'
  }
  // 사업화/마케팅
  if (text.includes('사업화') || text.includes('마케팅') || text.includes('수출') || text.includes('판로') || text.includes('해외진출')) {
    return '사업화'
  }
  // 시설/공간/보육
  if (text.includes('시설') || text.includes('입주') || text.includes('보육') || text.includes('센터') || text.includes('공간')) {
    return '시설보육'
  }
  // 멘토링/컨설팅/교육
  if (text.includes('멘토링') || text.includes('컨설팅') || text.includes('교육') || text.includes('코칭') || text.includes('사관학교')) {
    return '멘토링'
  }
  // 인력/채용
  if (text.includes('인력') || text.includes('채용') || text.includes('고용') || text.includes('인턴')) {
    return '인력'
  }
  // 행사/네트워킹
  if (text.includes('행사') || text.includes('박람회') || text.includes('전시회') || text.includes('ir') || text.includes('데모데이')) {
    return '행사'
  }

  return '기타'
}

/**
 * DB 저장용 포맷으로 변환
 */
export function transformBizinfoProgram(program: BizinfoProgram) {
  return {
    program_id: program.pblancId,
    title: program.pblancNm,
    category: program.searchLclasNm || '기타',
    support_type: inferSupportType(program.pblancNm, program.hashtags, program.searchLclasNm),
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

/**
 * 기업마당 상세 페이지 크롤링
 */
export async function scrapeBizinfoDetail(detailUrl: string): Promise<{
  content?: string
  attachments?: Array<{ name: string; url: string }>
} | null> {
  if (!detailUrl) return null

  // 상대 경로인 경우 도메인 추가 (/web/... -> https://www.bizinfo.go.kr/web/...)
  if (detailUrl.startsWith('/')) {
    detailUrl = `https://www.bizinfo.go.kr${detailUrl}`
  }

  if (!detailUrl.includes('bizinfo.go.kr')) {
    return null
  }

  try {
    // URL에서 ID 추출 및 보정 (PBLN_0000000000103367 -> PBLN_000000000103367)
    // 16자리 숫자(총 길이 21)인 경우 0을 하나 제거하여 15자리(총 길이 20)로 보정
    let targetUrl = detailUrl
    try {
      const urlObj = new URL(detailUrl)
      const pblancId = urlObj.searchParams.get('pblancId')
      if (pblancId && pblancId.length === 21 && pblancId.startsWith('PBLN_0')) {
        const fixedId = pblancId.replace('PBLN_0', 'PBLN_')
        targetUrl = detailUrl.replace(pblancId, fixedId)
        console.log(`[Bizinfo] 잘못된 ID 포맷 감지. URL 보정: ${targetUrl}`)
      }
    } catch (e) {
      // URL 파싱 에러 무시
    }

    console.log('[Bizinfo] 상세페이지 크롤링:', targetUrl)

    let fetchResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    // 404 발생 시, ID 길이 문제(0이 하나 더 들어간 경우) 체크하여 재시도
    if (!fetchResponse.ok && fetchResponse.status === 404) {
      const urlObj = new URL(detailUrl)
      const pblancId = urlObj.searchParams.get('pblancId')

      // 잘못된 ID 패턴 (PBLN_ + 16자리 숫자) 감지 -> 15자리로 수정
      // 예: PBLN_0000000000103367 (오류) -> PBLN_000000000103367 (정상)
      if (pblancId && pblancId.length === 21 && pblancId.startsWith('PBLN_0')) {
        const fixedId = pblancId.replace('PBLN_0', 'PBLN_')
        const fixedUrl = detailUrl.replace(pblancId, fixedId)
        console.log(`[Bizinfo] ID 포맷 오류 감지. 수정된 URL로 재시도: ${fixedUrl}`)

        fetchResponse = await fetch(fixedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        // 수정된 URL이 성공했다면 로그
        if (fetchResponse.ok) {
          console.log('[Bizinfo] ID 자동 수정 성공')
        }
      }
    }

    if (!fetchResponse.ok) {
      console.error('[Bizinfo] 상세페이지 로드 실패:', fetchResponse.status)
      return null
    }

    let html = await fetchResponse.text()

    // 상대 경로 수정 (이미지, 링크 등)
    html = html.replace(/src="\/([^"]*)"/g, 'src="https://www.bizinfo.go.kr/$1"')
    html = html.replace(/href="\/([^"]*)"/g, 'href="https://www.bizinfo.go.kr/$1"')

    // 헬퍼 함수
    const cleanHtml = (str: string) =>
      str.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim()

    const result: {
      content?: string
      attachments?: Array<{ name: string; url: string }>
      pdf_url?: string
    } = {}

    // Extract PDF URL from iframe/object/embed tags
    const pdfRegex = /<(iframe|object|embed)[^>]+(src|data)="([^"]+\.pdf)"[^>]*>/gi;
    let pdfMatch;
    if ((pdfMatch = pdfRegex.exec(html)) !== null) {
      let pdfUrl = pdfMatch[3];
      // Ensure it's an absolute URL
      if (pdfUrl.startsWith('/')) {
        pdfUrl = `https://www.bizinfo.go.kr${pdfUrl}`;
      }
      result.pdf_url = pdfUrl;
    }

    // 1. 본문 추출 (Nested Div 처리)
    const viewContMarker = 'class="view_cont"'
    let startIndex = html.indexOf(viewContMarker)

    // board_view, bbs_view, sub_cont 등 대체 클래스 확인
    if (startIndex === -1) {
      startIndex = html.indexOf('class="board_view"')
    }
    if (startIndex === -1) {
      startIndex = html.indexOf('class="bbs_view"')
    }
    if (startIndex === -1) {
      startIndex = html.indexOf('class="sub_cont"')
    }

    if (startIndex !== -1) {
      // <div class="view_cont">의 시작점(<div) 찾기
      const openingDivStart = html.lastIndexOf('<div', startIndex)

      if (openingDivStart !== -1) {
        let depth = 0
        let currentIndex = openingDivStart
        let foundEnd = false
        const maxLen = html.length

        // 태그 밸런싱으로 닫는 태그 찾기
        while (currentIndex < maxLen) {
          const nextOpen = html.indexOf('<div', currentIndex + 1)
          const nextClose = html.indexOf('</div>', currentIndex + 1)

          if (nextClose === -1) break

          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++
            currentIndex = nextOpen
          } else {
            if (depth === 0) {
              // 최상위 div 닫힘
              const contentRaw = html.substring(openingDivStart, nextClose + 6)
              result.content = `<div class="bizinfo-original">${cleanHtml(contentRaw)}</div>`
              foundEnd = true
              break
            } else {
              depth--
              currentIndex = nextClose
            }
          }
        }
      }
    } else {
      // Fallback: 정규식 시도 (매우 단순한 구조일 경우)
      let contentMatch = html.match(/<div class="view_cont"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/\/\s*view_cont\s*-->/i)
      if (contentMatch) {
        result.content = `<div class="bizinfo-original">${cleanHtml(contentMatch[1])}</div>`
      }
    }

    // 2. 첨부파일 추출
    const attachments: Array<{ name: string; url: string }> = []

    // 파일 영역 찾기 (class="add_file" 또는 class="file_list")
    const fileMarkers = ['class="add_file"', 'class="file_list"']
    let fileHtml = ''

    for (const marker of fileMarkers) {
      const fStart = html.indexOf(marker)
      if (fStart !== -1) {
        // 태그 밸런싱으로 영역 추출
        const openingDivStart = html.lastIndexOf('<div', fStart) // add_file은 div
        const openingUlStart = html.lastIndexOf('<ul', fStart)   // file_list는 ul일 수 있음

        let startPos = openingDivStart
        let tagName = 'div'

        // 더 가까운 태그 선택 (또는 marker에 맞는 태그)
        if (marker.includes('file_list') && openingUlStart !== -1) {
          startPos = openingUlStart
          tagName = 'ul'
        } else if (startPos === -1 && openingUlStart !== -1) {
          startPos = openingUlStart
          tagName = 'ul'
        }

        if (startPos !== -1) {
          let depth = 0
          let curr = startPos
          const maxLen = html.length

          while (curr < maxLen) {
            const nextOpen = html.indexOf(`<${tagName}`, curr + 1)
            const nextClose = html.indexOf(`</${tagName}>`, curr + 1)

            if (nextClose === -1) break

            if (nextOpen !== -1 && nextOpen < nextClose) {
              depth++
              curr = nextOpen
            } else {
              if (depth === 0) {
                fileHtml = html.substring(startPos, nextClose + tagName.length + 3)
                break
              } else {
                depth--
                curr = nextClose
              }
            }
          }
        }
        if (fileHtml) break
      }
    }

    if (fileHtml) {
      // 링크 추출
      const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      let match
      while ((match = linkRegex.exec(fileHtml)) !== null) {
        const href = match[1] // url
        let text = match[2].replace(/<[^>]+>/g, '').trim() // filename

        // view.do? ... &attachSeq=... 같은 형식일 수 있음
        if (href.includes('down.do') || href.includes('download')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.bizinfo.go.kr${href.startsWith('/') ? '' : '/'}${href}`
          if (text) attachments.push({ name: text, url: fullUrl })
        }
      }
    }

    // fileLoad() onclick 핸들러에서 파일 추출
    // 패턴: fileLoad('/webapp/upload/bizinfo/file/2026/01' + '/' + '202601021619040019.jpg', '[배포용]2026시니어인턴십.jpg')
    const fileLoadRegex = /fileLoad\s*\(\s*['"]([^'"]+)['"]\s*\+\s*['"]\/['"]\s*\+\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
    let fileLoadMatch
    while ((fileLoadMatch = fileLoadRegex.exec(html)) !== null) {
      const basePath = fileLoadMatch[1] // /webapp/upload/bizinfo/file/2026/01
      const fileName = fileLoadMatch[2] // 202601021619040019.jpg
      const displayName = fileLoadMatch[3] // [배포용]2026시니어인턴십.jpg
      const fullUrl = `https://www.bizinfo.go.kr${basePath}/${fileName}`
      attachments.push({ name: displayName, url: fullUrl })
    }

    // 단일 인자 fileLoad도 체크: fileLoad('/webapp/upload/bizinfo/file/2026/01/filename.pdf', 'displayname.pdf')
    const fileLoadSimpleRegex = /fileLoad\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
    let fileLoadSimpleMatch
    while ((fileLoadSimpleMatch = fileLoadSimpleRegex.exec(html)) !== null) {
      const filePath = fileLoadSimpleMatch[1]
      const displayName = fileLoadSimpleMatch[2]
      // 이미 추가된 파일인지 확인
      if (!attachments.some(a => a.name === displayName)) {
        const fullUrl = filePath.startsWith('http') ? filePath : `https://www.bizinfo.go.kr${filePath}`
        attachments.push({ name: displayName, url: fullUrl })
      }
    }

    if (attachments.length > 0) {
      result.attachments = attachments
    }

    return result
  } catch (error) {
    console.error('[Bizinfo] 크롤링 오류:', error)
    return null
  }
}
