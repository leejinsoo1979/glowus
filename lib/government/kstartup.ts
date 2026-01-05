/**
 * K-Startup (창업진흥원) API 연동 모듈
 *
 * API 문서: https://www.data.go.kr/data/15125364/openapi.do
 * 서비스명: 창업진흥원_K-Startup(사업소개,사업공고, 콘텐츠 등)_조회서비스
 * API명: kisedKstartupService01
 */

// K-Startup 공고정보 API 응답 타입
export interface KStartupProgram {
  intg_pbanc_yn: string           // 통합 공고 여부 (Y/N)
  intg_pbanc_biz_nm: string       // 통합 공고 사업 명
  biz_pbanc_nm: string            // 지원 사업 공고 명
  pbanc_ctnt?: string             // 공고 내용
  supt_biz_clsfc: string          // 지원 분야
  aply_trgt_ctnt: string          // 신청 대상 내용
  supt_regin: string              // 지역명
  pbanc_rcpt_bgng_dt: string      // 공고 접수 시작 일시
  pbanc_rcpt_end_dt: string       // 공고 접수 종료 일시
  pbanc_ntrp_nm?: string          // 창업 지원 기관명
  sprv_inst?: string              // 주관 기관
  biz_prch_dprt_nm?: string       // 사업 담당자 부서명
  biz_gdnc_url?: string           // 사업 안내 URL
  biz_aply_url?: string           // 사업 신청 URL
  prch_cnpl_no?: string           // 담당자 연락처
  detl_pg_url: string             // 상세페이지URL
  aply_mthd_vst_rcpt_istc?: string   // 신청 방법 방문 접수 설명
  aply_mthd_pssr_rcpt_istc?: string  // 신청 방법 우편 접수 설명
  aply_mthd_fax_rcpt_istc?: string   // 신청 방법 팩스 접수 설명
  aply_mthd_eml_rcpt_istc?: string   // 신청 방법 이메일 접수 설명
  aply_mthd_onli_rcpt_istc?: string  // 신청 방법 온라인 접수 설명
  aply_mthd_etc_istc?: string        // 신청 방법 기타 설명
  aply_excl_trgt_ctnt?: string    // 신청제외대상내용 (API 실제 필드명)
  aply_exclt_trgt_ctnt?: string   // 신청제외대상내용 (레거시)
  aply_trgt: string               // 신청 대상
  biz_enyy: string                // 창업 기간
  biz_trgt_age: string            // 대상 연령
  prfn_matr?: string              // 우대 사항
  rcrt_prgs_yn: string            // 모집진행여부 (Y/N)
  pbanc_sn?: string               // 공고일련번호
}

export interface KStartupFetchOptions {
  page?: number
  perPage?: number
  bizName?: string           // 지원 사업 공고 명 검색
  category?: string          // 지원 분야 (supt_biz_clsfc)
  bizCategoryCode?: BizCategoryCode  // 사업 구분 코드 (cmrczn_tab1~9)
  region?: string            // 지역명
  startDate?: string         // 공고 접수 시작 일시 (YYYYMMDD)
  endDate?: string           // 공고 접수 종료 일시 (YYYYMMDD)
  onlyActive?: boolean       // 모집 진행중만 (rcrt_prgs_yn=Y)
  targetAge?: string         // 대상 연령
  bizPeriod?: string         // 창업 기간
}

// K-Startup 사업 구분 코드 (BIZ_CATEGORY_CD)
export const BIZ_CATEGORY_CD = {
  cmrczn_tab1: '사업화',
  cmrczn_tab2: '창업교육',
  cmrczn_tab3: '시설,공간,보육',
  cmrczn_tab4: '멘토링,컨설팅',
  cmrczn_tab5: '행사,네트워크',
  cmrczn_tab6: '기술개발 R&D',
  cmrczn_tab7: '융자',
  cmrczn_tab8: '인력',
  cmrczn_tab9: '글로벌'
} as const

export type BizCategoryCode = keyof typeof BIZ_CATEGORY_CD

// K-Startup 콘텐츠 구분 코드 (CLSS_CD)
export const CLSS_CD = {
  notice_matr: '정책 및 규제정보(공지사항)',
  fnd_scs_case: '창업우수사례',
  kstartup_isse_trd: '생태계 이슈, 동향'
} as const

export type ContentClassCode = keyof typeof CLSS_CD

// K-Startup 지원분야 → 공통 카테고리 매핑
export const KSTARTUP_CATEGORIES: Record<string, string> = {
  '사업화': '창업',
  '창업교육': '창업',
  '시설,공간,보육': '창업',
  '시설·공간·보육': '창업',
  '멘토링,컨설팅': '경영',
  '멘토링·컨설팅': '경영',
  '행사,네트워크': '기타',
  '행사·네트워크': '기타',
  '기술개발 R&D': '기술',
  'R&D': '기술',
  '융자': '금융',
  '인력': '인력',
  '글로벌': '수출',
  '해외진출': '수출',
  '판로·수출': '내수'
}

/**
 * K-Startup 공고정보 API 호출
 * 엔드포인트: /getAnnouncementInformation01
 */
export async function fetchKStartupPrograms(
  options: KStartupFetchOptions = {}
): Promise<KStartupProgram[]> {
  const API_KEY = process.env.KSTARTUP_API_KEY

  // API 키가 없으면 데모 데이터 반환
  if (!API_KEY) {
    console.log('[KStartup] API 키 없음 - 데모 데이터 반환')
    return getDemoPrograms()
  }

  const {
    page = 1,
    perPage = 100,
    bizName,
    category,
    bizCategoryCode,
    region,
    startDate,
    endDate,
    onlyActive = true,
    targetAge,
    bizPeriod
  } = options

  const baseUrl = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01'

  // URL 파라미터 구성 (공식 문서 기준)
  const params = new URLSearchParams({
    ServiceKey: API_KEY,  // 대문자 S
    page: page.toString(),
    perPage: perPage.toString(),
    returnType: 'json'
  })

  // 조건부 필터 추가
  if (bizName) {
    params.append('biz_pbanc_nm', bizName)
  }
  if (category) {
    params.append('supt_biz_clsfc', category)
  }
  if (bizCategoryCode) {
    params.append('biz_category_cd', bizCategoryCode)  // cmrczn_tab1~9
  }
  if (region) {
    params.append('supt_regin', region)
  }
  if (startDate) {
    params.append('pbanc_rcpt_bgng_dt', startDate)
  }
  if (endDate) {
    params.append('pbanc_rcpt_end_dt', endDate)
  }
  if (onlyActive) {
    params.append('rcrt_prgs_yn', 'Y')
  }
  if (targetAge) {
    params.append('biz_trgt_age', targetAge)
  }
  if (bizPeriod) {
    params.append('biz_enyy', bizPeriod)
  }

  try {
    const url = `${baseUrl}?${params.toString()}`
    console.log('[KStartup] API 호출:', url.replace(API_KEY, '***'))

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`K-Startup API 오류: ${response.status}`)
    }

    const data = await response.json()

    // 응답 구조 확인 및 데이터 추출
    // 공공데이터포털 표준 응답 구조: { response: { body: { items: [...] } } }
    // 또는 data.go.kr 신규 구조: { data: [...] }
    let items: KStartupProgram[] = []

    if (data.data && Array.isArray(data.data)) {
      items = data.data
    } else if (data.response?.body?.items) {
      items = Array.isArray(data.response.body.items)
        ? data.response.body.items
        : [data.response.body.items]
    } else if (Array.isArray(data)) {
      items = data
    }

    console.log(`[KStartup] ${items.length}개 공고 수집`)
    return items

  } catch (error) {
    console.error('[KStartup] API 호출 오류:', error)
    return getDemoPrograms()
  }
}

/**
 * K-Startup 공고 데이터를 공통 형식으로 변환
 * API에서 제공하는 모든 데이터를 content 필드에 통합
 */
export function transformKStartupProgram(program: KStartupProgram) {
  // 날짜 형식 변환 (다양한 형식 지원)
  const formatDate = (dateStr: string): string | null => {
    if (!dateStr) return null

    // "2012-11-29 00:00:00" 형식
    if (dateStr.includes('-')) {
      return dateStr.split(' ')[0]
    }

    // "20121129" 형식
    const clean = dateStr.replace(/[^0-9]/g, '').slice(0, 8)
    if (clean.length !== 8) return null
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }

  // 고유 ID 생성
  const programId = program.pbanc_sn
    ? `kstartup_${program.pbanc_sn}`
    : `kstartup_${Buffer.from(
      program.biz_pbanc_nm + program.pbanc_rcpt_bgng_dt
    ).toString('base64').slice(0, 20)}`

  // 카테고리 매핑
  const category = mapKStartupCategory(program.supt_biz_clsfc)

  // 해시태그 추출
  const hashtags: string[] = []
  if (program.supt_biz_clsfc) hashtags.push(program.supt_biz_clsfc)
  if (program.aply_trgt) {
    hashtags.push(...program.aply_trgt.split(',').map(s => s.trim()))
  }
  if (program.supt_regin) hashtags.push(program.supt_regin)
  if (program.biz_enyy) {
    hashtags.push(...program.biz_enyy.split(',').map(s => s.trim()))
  }

  // 상세 URL 정규화
  let detailUrl = program.detl_pg_url || program.biz_gdnc_url || ''
  if (detailUrl && !detailUrl.startsWith('http')) {
    detailUrl = `https://${detailUrl}`
  }

  // 지원유형 매핑
  const supportType = mapKStartupSupportType(program.supt_biz_clsfc)

  // 신청방법 조합
  const applicationMethods: string[] = []
  if (program.aply_mthd_onli_rcpt_istc) applicationMethods.push(`• 온라인: ${program.aply_mthd_onli_rcpt_istc}`)
  if (program.aply_mthd_vst_rcpt_istc) applicationMethods.push(`• 방문: ${program.aply_mthd_vst_rcpt_istc}`)
  if (program.aply_mthd_pssr_rcpt_istc) applicationMethods.push(`• 우편: ${program.aply_mthd_pssr_rcpt_istc}`)
  if (program.aply_mthd_eml_rcpt_istc) applicationMethods.push(`• 이메일: ${program.aply_mthd_eml_rcpt_istc}`)
  if (program.aply_mthd_fax_rcpt_istc) applicationMethods.push(`• 팩스: ${program.aply_mthd_fax_rcpt_istc}`)
  if (program.aply_mthd_etc_istc) applicationMethods.push(`• 기타: ${program.aply_mthd_etc_istc}`)

  // ========== 전체 내용을 content에 통합 ==========
  const contentParts: string[] = []

  // 공고 개요
  if (program.pbanc_ctnt) {
    contentParts.push('【공고개요】\n' + program.pbanc_ctnt)
  }

  // 신청대상
  if (program.aply_trgt_ctnt) {
    contentParts.push('【신청대상】\n' + program.aply_trgt_ctnt)
  } else if (program.aply_trgt) {
    contentParts.push('【신청대상】\n' + program.aply_trgt)
  }

  // 제외대상
  if (program.aply_excl_trgt_ctnt || program.aply_exclt_trgt_ctnt) {
    contentParts.push('【제외대상】\n' + (program.aply_excl_trgt_ctnt || program.aply_exclt_trgt_ctnt))
  }

  // 지원분야
  if (program.supt_biz_clsfc) {
    contentParts.push('【지원분야】\n' + program.supt_biz_clsfc)
  }

  // 지역
  if (program.supt_regin) {
    contentParts.push('【지역】\n' + program.supt_regin)
  }

  // 대상연령
  if (program.biz_trgt_age) {
    contentParts.push('【대상연령】\n' + program.biz_trgt_age)
  }

  // 창업업력
  if (program.biz_enyy) {
    contentParts.push('【창업업력】\n' + program.biz_enyy)
  }

  // 우대사항
  if (program.prfn_matr) {
    contentParts.push('【우대사항】\n' + program.prfn_matr)
  }

  // 신청방법
  if (applicationMethods.length > 0) {
    contentParts.push('【신청방법】\n' + applicationMethods.join('\n'))
  }

  // 신청기간
  const startDate = formatDate(program.pbanc_rcpt_bgng_dt)
  const endDate = formatDate(program.pbanc_rcpt_end_dt)
  if (startDate && endDate) {
    contentParts.push('【신청기간】\n' + startDate + ' ~ ' + endDate)
  }

  // 주관기관
  if (program.pbanc_ntrp_nm || program.sprv_inst) {
    contentParts.push('【주관기관】\n' + (program.pbanc_ntrp_nm || program.sprv_inst))
  }

  // 담당부서
  if (program.biz_prch_dprt_nm) {
    contentParts.push('【담당부서】\n' + program.biz_prch_dprt_nm)
  }

  // 연락처
  if (program.prch_cnpl_no) {
    contentParts.push('【연락처】\n' + program.prch_cnpl_no)
  }

  const fullContent = contentParts.join('\n\n')

  return {
    program_id: programId,
    title: program.biz_pbanc_nm || program.intg_pbanc_biz_nm,
    content: fullContent || null,  // API 데이터 전체 통합
    category,
    support_type: supportType,
    hashtags: [...new Set(hashtags.filter(Boolean))], // 중복 제거
    organization: program.pbanc_ntrp_nm || program.sprv_inst || '창업진흥원',
    executing_agency: program.biz_prch_dprt_nm || null,
    reception_agency: null,
    apply_start_date: formatDate(program.pbanc_rcpt_bgng_dt),
    apply_end_date: formatDate(program.pbanc_rcpt_end_dt),
    detail_url: detailUrl,
    source: 'kstartup',
    fetched_at: new Date().toISOString(),
    // 추가 필드들 (개별 컬럼 저장용)
    eligibility_criteria: program.aply_trgt_ctnt || program.aply_trgt || null,
    target_excluded: program.aply_excl_trgt_ctnt || program.aply_exclt_trgt_ctnt || null,
    target_regions: program.supt_regin ? [program.supt_regin] : null,
    application_method: applicationMethods.length > 0 ? applicationMethods.join('\n') : null,
    contact_phone: program.prch_cnpl_no || null
  }
}

/**
 * K-Startup 상세 페이지에서 전체 정보 크롤링
 * 기본정보, 신청정보, 지원내용, 제출서류, 첨부파일 등 모든 데이터 추출
 */
export async function scrapeKStartupDetail(detailUrl: string): Promise<{
  content?: string
  attachments?: Array<{ name: string; url: string }>
  organization?: string
  contact?: string
  region?: string
  target_age?: string
  biz_period?: string
} | null> {
  if (!detailUrl || !detailUrl.includes('k-startup.go.kr')) {
    return null
  }

  // pbancSn 파라미터 확인
  if (!detailUrl.includes('pbancSn=')) {
    console.log('[KStartup] 유효하지 않은 URL (pbancSn 없음):', detailUrl)
    return null
  }

  try {
    console.log('[KStartup] 상세페이지 크롤링:', detailUrl)

    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    })

    if (!response.ok) {
      console.error('[KStartup] 상세페이지 로드 실패:', response.status)
      return null
    }

    const html = await response.text()

    // 헬퍼 함수: 텍스트 추출 (메타데이터용)
    const stripHtml = (str: string) =>
      str.replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#40;/g, '(')
        .replace(/&#41;/g, ')')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // 헬퍼 함수: HTML 태그 정리 (스크립트 제거, 불필요한 속성 제거)
    const cleanHtml = (str: string) =>
      str.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gim, "") // 버튼 제거 (기능 동작 안하므로)
        .replace(/\son\w+="[^"]*"/g, "") // remove event handlers
        .replace(/<a\b[^>]*javascript[^>]*>[\s\S]*?<\/a>/gim, "") // remove javascript links
        // 중소벤처24 통합로그인 팝업 레이어 제거
        .replace(/<div id="div_login_layer"[\s\S]*?<\/div>(\s*<\/div>)+/gim, "")
        .trim()

    const result: {
      content?: string
      attachments?: Array<{ name: string; url: string }>
      organization?: string
      contact?: string
      region?: string
      target_age?: string
      biz_period?: string
      evaluation_criteria?: string | null
      required_documents?: string | null
    } = {}

    // ========== 1. 전체 컨텐츠 레이아웃 추출 (app_notice_details-wrap) ==========
    // K-Startup의 상세 내용은 이 클래스 안에 모두 포함됨
    const wrapMatch = html.match(/<div class="app_notice_details-wrap">([\s\S]*?)<div class="board_file">/i)

    // 정규식 매칭이 어려우므로 주요 섹션 조합
    const contentParts: string[] = []

    // (1) information_box-wrap (제목, 기본정보표, 본문 박스)
    const infoBoxMatch = html.match(/<div class="information_box-wrap">([\s\S]*?)<\/div>\s*<div class="information_list-wrap">/i)
    if (infoBoxMatch) {
      contentParts.push(`<div class="information_box-wrap">${cleanHtml(infoBoxMatch[1])}</div>`)
    } else {
      // bg_box나 box만이라도 찾기
      const bgBox = html.match(/<div class="bg_box">([\s\S]*?)<\/div>/i)
      // box는 내부 div가 많아서 box_inner로 찾거나 box 전체
      const boxMatch = html.match(/<div class="box">\s*<div class="box_inner">([\s\S]*?)<\/div>\s*<\/div>/i)

      if (bgBox) contentParts.push(`<div class="bg_box">${cleanHtml(bgBox[1])}</div>`)
      if (boxMatch) contentParts.push(`<div class="box"><div class="box_inner">${cleanHtml(boxMatch[1])}</div></div>`)
    }

    // (2) information_list-wrap (하단 상세 테이블들)
    // 이 섹션이 때로는 매우 김.
    const infoListWrapMatch = html.match(/<div class="information_list-wrap">([\s\S]*?)<\/div>\s*<div style="margin-top:100px;">/i) ||
      html.match(/<div class="information_list-wrap">([\s\S]*?)<div class="guide_wrap">/i) ||
      html.match(/<div class="information_list-wrap">([\s\S]*?)<\/div>\s*<\/div>/i)

    if (infoListWrapMatch) {
      const infoListContent = cleanHtml(infoListWrapMatch[1])
      contentParts.push(`<div class="information_list-wrap">${infoListContent}</div>`)

      // ========== 평가 항목 & 제출 서류 추출 (Heuristic) ==========
      // information_list-wrap 안에 보통 테이블 형태로 들어있음

      // 1. 제출서류 (required_documents)
      // "제출서류" 또는 "신청서류" 라는 텍스트 근처의 테이블이나 리스트 추출
      if (infoListContent.includes('제출서류') || infoListContent.includes('신청서류')) {
        // 간단히 해당 키워드가 포함된 h5/h4 태그와 그 다음 div/table 추출 시도
        const docMatch = infoListContent.match(/<h[3-5][^>]*>.*?(제출서류|신청서류).*?<\/h[3-5]>\s*<div[^>]*>([\s\S]*?)<\/div>/i)
        if (docMatch) {
          result.required_documents = stripHtml(docMatch[0])
        }
      }

      // 2. 평가 항목 (evaluation_criteria)
      // "평가항목", "평가방법", "선정기준" 등이 포함된 영역
      if (infoListContent.includes('평가항목') || infoListContent.includes('평가방법') || infoListContent.includes('선정기준')) {
        const evalMatch = infoListContent.match(/<h[3-5][^>]*>.*?(평가항목|평가방법|선정기준).*?<\/h[3-5]>\s*<div[^>]*>([\s\S]*?)<\/div>/i)
        if (evalMatch) {
          result.evaluation_criteria = stripHtml(evalMatch[0])
        }
      }
    }

    // (3) guide_wrap (유의사항)
    const guideMatch = html.match(/<div class="guide_wrap">([\s\S]*?)<\/div>/i)
    if (guideMatch) {
      contentParts.push(`<div class="guide_wrap">${cleanHtml(guideMatch[1])}</div>`)
    }

    if (contentParts.length > 0) {
      // 전체 래퍼로 감싸서 반환. k-startup-original 클래스 추가
      result.content = `<div class="app_notice_details-wrap k-startup-original">${contentParts.join('\n')}</div>`
    }

    // Fallbacks if not found in infoList
    if (!result.required_documents && html.includes('제출서류')) {
      // 전체 HTML에서 검색
      const docMatch = html.match(/<h[3-5][^>]*>.*?(제출서류|신청서류).*?<\/h[3-5]>\s*(?:<div[^>]*>)?([\s\S]*?)(?:<\/div>|<\/table>)/i)
      if (docMatch) result.required_documents = stripHtml(docMatch[0])
    }

    if (!result.evaluation_criteria && (html.includes('평가항목') || html.includes('선정기준'))) {
      const evalMatch = html.match(/<h[3-5][^>]*>.*?(평가항목|선정기준).*?<\/h[3-5]>\s*(?:<div[^>]*>)?([\s\S]*?)(?:<\/div>|<\/table>)/i)
      if (evalMatch) result.evaluation_criteria = stripHtml(evalMatch[0])
    }

    // Clean up extracted text
    if (result.required_documents) result.required_documents = result.required_documents.substring(0, 1000) // Limit length
    if (result.evaluation_criteria) result.evaluation_criteria = result.evaluation_criteria.substring(0, 1000)

    // ========== 2. 메타데이터 추출 (검색/필터용) ==========
    const bgBoxHtml = html.match(/<div class="bg_box">([\s\S]*?)<\/div>/i)?.[1] || ''
    const tableInnerRegex = /<div class="table_inner">\s*<p class="tit">([^<]+)<\/p>\s*<p class="txt"[^>]*>([\s\S]*?)<\/p>\s*<\/div>/gi
    let match
    while ((match = tableInnerRegex.exec(bgBoxHtml)) !== null) {
      const tit = stripHtml(match[1])
      const txt = stripHtml(match[2])
      if (txt) {
        if (tit.includes('주관기관')) result.organization = txt
        if (tit.includes('연락처')) result.contact = txt
        if (tit.includes('지역')) result.region = txt
        if (tit.includes('대상연령')) result.target_age = txt
        if (tit.includes('창업업력')) result.biz_period = txt
      }
    }

    // ========== 3. 첨부파일 ==========
    const attachments: Array<{ name: string; url: string }> = []

    const fileListRegex = /<li class="clear">\s*<a class="file_bg"[^>]*>([^<]+)<\/a>[\s\S]*?<a href="([^"]*fileDownload[^"]*)"/gi
    let fileMatch
    while ((fileMatch = fileListRegex.exec(html)) !== null) {
      const name = stripHtml(fileMatch[1])
      const url = fileMatch[2].startsWith('http') ? fileMatch[2] : `https://www.k-startup.go.kr${fileMatch[2]}`
      if (name.length > 1) attachments.push({ name, url })
    }

    // Fallback
    if (attachments.length === 0) {
      const simpleFileRegex = /href="([^"]*(?:fileDown|download)[^"]*)"[^>]*>([^<]+)/gi
      while ((fileMatch = simpleFileRegex.exec(html)) !== null) {
        const url = fileMatch[1].startsWith('http') ? fileMatch[1] : `https://www.k-startup.go.kr${fileMatch[1]}`
        const name = stripHtml(fileMatch[2])
        if (name.length > 1 && name !== '다운로드') attachments.push({ name, url })
      }
    }

    if (attachments.length > 0) {
      result.attachments = attachments
    }

    if (result.content) {
      console.log('[KStartup] 원본 레이아웃 크롤링 성공')
      return result
    }

    return null
  } catch (error) {
    console.error('[KStartup] 크롤링 오류:', error)
    return null
  }
}

/**
 * K-Startup 분류를 지원유형으로 매핑
 */
function mapKStartupSupportType(classification: string): string {
  if (!classification) return '기타'

  const text = classification.toLowerCase()

  if (text.includes('사업화')) return '사업화'
  if (text.includes('교육') || text.includes('사관학교')) return '멘토링'
  if (text.includes('시설') || text.includes('공간') || text.includes('보육')) return '시설보육'
  if (text.includes('멘토링') || text.includes('컨설팅')) return '멘토링'
  if (text.includes('행사') || text.includes('네트워크')) return '행사'
  if (text.includes('기술개발') || text.includes('r&d')) return '기술개발'
  if (text.includes('융자')) return '융자보증'
  if (text.includes('인력')) return '인력'
  if (text.includes('글로벌') || text.includes('해외')) return '사업화'

  return '기타'
}

/**
 * K-Startup 분류를 공통 카테고리로 매핑
 */
function mapKStartupCategory(classification: string): string {
  if (!classification) return '기타'

  for (const [key, value] of Object.entries(KSTARTUP_CATEGORIES)) {
    if (classification.includes(key)) {
      return value
    }
  }

  // 키워드 기반 매핑
  if (classification.includes('창업') || classification.includes('사업화')) return '창업'
  if (classification.includes('금융') || classification.includes('융자')) return '금융'
  if (classification.includes('기술') || classification.includes('R&D')) return '기술'
  if (classification.includes('인력') || classification.includes('채용')) return '인력'
  if (classification.includes('수출') || classification.includes('해외')) return '수출'
  if (classification.includes('판로') || classification.includes('마케팅')) return '내수'
  if (classification.includes('컨설팅') || classification.includes('경영')) return '경영'

  return '기타'
}

/**
 * 데모 데이터 (API 키 없을 때 사용)
 */
function getDemoPrograms(): KStartupProgram[] {
  return [
    {
      intg_pbanc_yn: 'N',
      intg_pbanc_biz_nm: '',
      biz_pbanc_nm: '[데모] 2026년 예비창업패키지 모집공고',
      supt_biz_clsfc: '사업화',
      pbanc_rcpt_bgng_dt: '2026-01-01 00:00:00',
      pbanc_rcpt_end_dt: '2026-02-28 00:00:00',
      aply_trgt_ctnt: '예비창업자',
      supt_regin: '전국',
      aply_trgt: '예비창업자',
      biz_enyy: '',
      biz_trgt_age: '',
      rcrt_prgs_yn: 'Y',
      detl_pg_url: 'https://www.k-startup.go.kr'
    },
    {
      intg_pbanc_yn: 'N',
      intg_pbanc_biz_nm: '',
      biz_pbanc_nm: '[데모] 2026년 초기창업패키지 모집공고',
      supt_biz_clsfc: '사업화',
      pbanc_rcpt_bgng_dt: '2026-01-15 00:00:00',
      pbanc_rcpt_end_dt: '2026-03-15 00:00:00',
      aply_trgt_ctnt: '창업 3년 이내 기업',
      supt_regin: '전국',
      aply_trgt: '초기창업자',
      biz_enyy: '3년미만',
      biz_trgt_age: '',
      rcrt_prgs_yn: 'Y',
      detl_pg_url: 'https://www.k-startup.go.kr'
    },
    {
      intg_pbanc_yn: 'N',
      intg_pbanc_biz_nm: '',
      biz_pbanc_nm: '[데모] 2026년 창업도약패키지 모집공고',
      supt_biz_clsfc: '사업화',
      pbanc_rcpt_bgng_dt: '2026-02-01 00:00:00',
      pbanc_rcpt_end_dt: '2026-03-31 00:00:00',
      aply_trgt_ctnt: '창업 3~7년 기업',
      supt_regin: '전국',
      aply_trgt: '도약기창업자',
      biz_enyy: '3년미만,5년미만,7년미만',
      biz_trgt_age: '',
      rcrt_prgs_yn: 'Y',
      detl_pg_url: 'https://www.k-startup.go.kr'
    },
    {
      intg_pbanc_yn: 'N',
      intg_pbanc_biz_nm: '',
      biz_pbanc_nm: '[데모] 2026년 글로벌창업사관학교 모집공고',
      supt_biz_clsfc: '해외진출',
      pbanc_rcpt_bgng_dt: '2026-03-01 00:00:00',
      pbanc_rcpt_end_dt: '2026-04-30 00:00:00',
      aply_trgt_ctnt: '글로벌 진출 희망 스타트업',
      supt_regin: '전국',
      aply_trgt: '창업기업',
      biz_enyy: '',
      biz_trgt_age: '',
      prfn_matr: '영어 가능자 우대',
      rcrt_prgs_yn: 'Y',
      detl_pg_url: 'https://www.k-startup.go.kr'
    }
  ]
}
