/**
 * Text Normalizer for Radio-Grade TTS
 * 약어/숫자/고유명사/단위를 SSML 태그로 변환하여 자연스러운 발음 보장
 */

// 약어 → 풀이 매핑 (TTS 발음 최적화)
const ABBREVIATION_MAP: Record<string, string> = {
  // AI/ML 관련 (핵심)
  'AI': '에이아이',
  'ML': '엠엘',
  'LLM': '엘엘엠',
  'GPT': '지피티',
  'ChatGPT': '챗지피티',
  'RAG': '래그',
  'NLP': '엔엘피',
  'AGI': '에이지아이',

  // 기술/IT
  'API': '에이피아이',
  'UI': '유아이',
  'UX': '유엑스',
  'CEO': '씨이오',
  'CTO': '씨티오',
  'CFO': '씨에프오',
  'COO': '씨오오',
  'IT': '아이티',
  'IoT': '아이오티',
  'SaaS': '사스',
  'PaaS': '파스',
  'IaaS': '아이에이에스',
  'B2B': '비투비',
  'B2C': '비투씨',
  'D2C': '디투씨',
  'MVP': '엠브이피',
  'KPI': '케이피아이',
  'ROI': '알오아이',
  'PR': '피알',
  'IR': '아이알',
  'VC': '브이씨',
  'IP': '아이피',
  'OS': '오에스',
  'PC': '피씨',
  'URL': '유알엘',
  'HTTP': '에이치티티피',
  'HTTPS': '에이치티티피에스',
  'CSS': '씨에스에스',
  'HTML': '에이치티엠엘',
  'JSON': '제이슨',
  'XML': '엑스엠엘',
  'SQL': '에스큐엘',
  'NoSQL': '노에스큐엘',
  'DB': '디비',
  'SDK': '에스디케이',
  'GPU': '지피유',
  'TPU': '티피유',
  'CPU': '씨피유',
  'RAM': '램',
  'SSD': '에스에스디',
  'HDD': '에이치디디',
  'USB': '유에스비',
  'PDF': '피디에프',
  'PPT': '피피티',
  'AWS': '에이더블유에스',
  'GCP': '지씨피',
  'Azure': '애저',

  // 비즈니스/금융
  'ESG': '이에스지',
  'M&A': '엠앤에이',
  'IPO': '아이피오',
  'ETF': '이티에프',
  'GDP': '지디피',
  'R&D': '알앤디',
  'OKR': '오케이알',
  'MOU': '엠오유',
  'NDA': '엔디에이',
  'PoC': '피오씨',
  'PMF': '피엠에프',
  'ARR': '에이알알',
  'MRR': '엠알알',

  // 인증/표준
  'HACCP': '해썹',
  'GAP': '갭',
  'ISO': '아이에스오',
  'FDA': '에프디에이',
  'CE': '씨이',
  'KC': '케이씨',
  'GMP': '지엠피',

  // 미디어/마케팅
  'SNS': '에스엔에스',
  'SEO': '에스이오',
  'CRM': '씨알엠',
  'CTR': '씨티알',
  'CPM': '씨피엠',
  'CPC': '씨피씨',
  'CPA': '씨피에이',

  // 기타
  'MBTI': '엠비티아이',
  'JTBC': '제이티비씨',
  'KBS': '케이비에스',
  'MBC': '엠비씨',
  'SBS': '에스비에스',
  'tvN': '티비엔',
  'YTN': '와이티엔',
  'FAQ': '에프에이큐',
  'Q&A': '큐앤에이',
  'OTT': '오티티',
  'NFT': '엔에프티',
  'VR': '브이알',
  'AR': '에이알',
  'XR': '엑스알',
  'MR': '엠알',
  'ASMR': '에이에스엠알',
}

// 단위 → 읽기 매핑
const UNIT_MAP: Record<string, string> = {
  'km': '킬로미터',
  'cm': '센티미터',
  'mm': '밀리미터',
  'm': '미터',
  'kg': '킬로그램',
  'g': '그램',
  'mg': '밀리그램',
  'L': '리터',
  'ml': '밀리리터',
  'mL': '밀리리터',
  '%': '퍼센트',
  '℃': '도',
  '°C': '도',
  'GB': '기가바이트',
  'MB': '메가바이트',
  'TB': '테라바이트',
  'KB': '킬로바이트',
}

/**
 * 특수문자 이스케이프 (SSML 안전)
 */
export function escapeForSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 약어를 <sub alias="..."> 태그로 변환
 */
export function normalizeAbbreviations(text: string): string {
  let result = text

  for (const [abbr, reading] of Object.entries(ABBREVIATION_MAP)) {
    // 단어 경계에서만 매칭 (정규식)
    const regex = new RegExp(`\\b${abbr}\\b`, 'g')
    result = result.replace(regex, `<sub alias="${reading}">${abbr}</sub>`)
  }

  return result
}

/**
 * 숫자를 <say-as> 태그로 변환
 * - 기수: 일반 숫자 (123 → 백이십삼)
 * - 서수: ~번째 (1번째 → 첫 번째)
 * - 전화번호: 하이픈 포함 숫자
 * - 연도: 4자리 숫자
 */
export function normalizeNumbers(text: string): string {
  let result = text

  // 서수 (1번째, 2번째 등)
  result = result.replace(/(\d+)(번째|위|등|차)/g, (_, num, suffix) => {
    return `<say-as interpret-as="ordinal">${num}</say-as>${suffix}`
  })

  // 연도 (2024년, 2025년 등)
  result = result.replace(/(\d{4})(년)/g, (_, year, suffix) => {
    return `<say-as interpret-as="date" format="y">${year}</say-as>${suffix}`
  })

  // 퍼센트 (50%, 3.5% 등)
  result = result.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => {
    return `<say-as interpret-as="cardinal">${num}</say-as>퍼센트`
  })

  // 전화번호 패턴 (010-1234-5678)
  result = result.replace(/(\d{2,4})-(\d{3,4})-(\d{4})/g, (match) => {
    return `<say-as interpret-as="telephone">${match}</say-as>`
  })

  // 금액 (1,000원, 50만원 등)
  result = result.replace(/(\d{1,3}(?:,\d{3})*)(원|달러|엔|위안)/g, (_, num, currency) => {
    const cleanNum = num.replace(/,/g, '')
    return `<say-as interpret-as="cardinal">${cleanNum}</say-as>${currency}`
  })

  // 단위가 붙은 숫자 (10km, 5kg 등)
  for (const [unit, reading] of Object.entries(UNIT_MAP)) {
    const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}(?![a-zA-Z])`, 'g')
    result = result.replace(regex, (_, num) => {
      return `<say-as interpret-as="cardinal">${num}</say-as>${reading}`
    })
  }

  return result
}

/**
 * 영어 단어를 자연스럽게 읽기 위한 처리
 * (한글 문장 속 영어 단어)
 */
export function normalizeEnglishWords(text: string): string {
  // 일반적인 영어 단어는 그대로 두고, 특수한 경우만 처리
  // Google TTS Neural2는 영어를 잘 처리함
  return text
}

/**
 * 웃음/감탄사 처리 (TTS 대신 효과음으로 대체할 마커 삽입)
 */
export function normalizeLaughs(text: string): string {
  // 웃음 표현을 마커로 대체 (나중에 효과음으로 처리)
  const laughPatterns = [
    { pattern: /\(웃음\)/g, marker: '<!--LAUGH_NORMAL-->' },
    { pattern: /\(피식\)/g, marker: '<!--LAUGH_SOFT-->' },
    { pattern: /\(하하\)/g, marker: '<!--LAUGH_HAHA-->' },
    { pattern: /\(큭\)/g, marker: '<!--LAUGH_CHUCKLE-->' },
    { pattern: /\(웃참\s*실패\)/g, marker: '<!--LAUGH_BURST-->' },
    { pattern: /ㅋㅋㅋ+/g, marker: '<!--LAUGH_TEXT-->' },
    { pattern: /ㅎㅎㅎ+/g, marker: '<!--LAUGH_TEXT-->' },
  ]

  let result = text
  for (const { pattern, marker } of laughPatterns) {
    result = result.replace(pattern, ` ${marker} `)
  }

  return result
}

/**
 * 마크다운 기호 및 특수문자 정리
 */
export function cleanMarkdown(text: string): string {
  let result = text

  // 마크다운 볼드/이탤릭 제거: **text**, *text*, __text__, _text_
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1')
  result = result.replace(/\*([^*]+)\*/g, '$1')
  result = result.replace(/__([^_]+)__/g, '$1')
  result = result.replace(/_([^_]+)_/g, '$1')

  // 마크다운 링크 제거: [text](url) → text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 마크다운 헤더 기호 제거: # ## ### 등
  result = result.replace(/^#{1,6}\s*/gm, '')

  // 마크다운 리스트 기호 제거: - * + 및 숫자 리스트
  result = result.replace(/^\s*[-*+]\s+/gm, '')
  result = result.replace(/^\s*\d+\.\s+/gm, '')

  // 코드 블록 제거: `code` 및 ```code```
  result = result.replace(/```[^`]*```/g, '')
  result = result.replace(/`([^`]+)`/g, '$1')

  // 대괄호 내용 추출: [텍스트] → 텍스트
  result = result.replace(/\[([^\]]+)\]/g, '$1')

  // 괄호 안의 설명 제거 (선택적): (설명) - TTS에서 어색할 수 있음
  // result = result.replace(/\([^)]*\)/g, '')

  // 남은 특수기호 정리
  result = result.replace(/[#*_~`|]/g, '')

  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ')

  // 앞뒤 공백 제거
  result = result.trim()

  return result
}

/**
 * TTS용 텍스트 정리 (읽기 어려운 패턴 제거)
 */
export function cleanForTTS(text: string): string {
  let result = text

  // URL 제거
  result = result.replace(/https?:\/\/[^\s]+/g, '')

  // 이메일 제거
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')

  // 파일 경로 제거
  result = result.replace(/[a-zA-Z]:\\[^\s]+/g, '')
  result = result.replace(/\/[a-zA-Z0-9_\-./]+/g, ' ')

  // 특수 기호를 말로 변환
  result = result.replace(/→/g, ' 에서 ')
  result = result.replace(/←/g, ' 로부터 ')
  result = result.replace(/↔/g, ' 양방향 ')
  result = result.replace(/\.\.\./g, ' ')
  result = result.replace(/…/g, ' ')

  // 괄호 정리
  result = result.replace(/\(([^)]*)\)/g, ', $1,')
  result = result.replace(/【([^】]*)】/g, '$1')
  result = result.replace(/「([^」]*)」/g, '$1')
  result = result.replace(/『([^』]*)』/g, '$1')

  // 연속 문장부호 정리
  result = result.replace(/[.!?]{2,}/g, '.')
  result = result.replace(/,{2,}/g, ',')

  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ')

  return result.trim()
}

/**
 * 전체 텍스트 정규화 파이프라인
 */
export function normalizeText(text: string): string {
  let result = text

  // 0. 마크다운 기호 정리 (가장 먼저!)
  result = cleanMarkdown(result)

  // 1. TTS용 텍스트 정리
  result = cleanForTTS(result)

  // 2. 웃음/감탄사 마커 처리 (SSML 이스케이프 전에)
  result = normalizeLaughs(result)

  // 3. 특수문자 이스케이프
  result = escapeForSSML(result)

  // 4. 약어 치환
  result = normalizeAbbreviations(result)

  // 5. 숫자 처리
  result = normalizeNumbers(result)

  // 6. 영어 단어 처리
  result = normalizeEnglishWords(result)

  return result
}

export default {
  escapeForSSML,
  normalizeAbbreviations,
  normalizeNumbers,
  normalizeEnglishWords,
  normalizeLaughs,
  normalizeText,
  cleanMarkdown,
  cleanForTTS
}
