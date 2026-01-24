/**
 * Korean Text Normalizer
 * Production-grade text normalization for Korean TTS
 *
 * 핵심 기능:
 * - 숫자/날짜/시간/퍼센트/통화/범위 정규화
 * - 단위 (㎡, 평, mm, cm, GB, km 등)
 * - 약어/영어 (API, SaaS, CRM, EC2, PDF, UI/UX, Veo3 등)
 * - 브랜드/제품명 (lexicon 기반 고정 발음)
 * - 괄호/슬래시/하이픈/특수기호 처리
 * - 디버깅을 위한 상세 tokenMap 제공
 */

import type {
  INormalizer,
  NormalizationRule,
  NormalizationResult,
  LexiconEntry
} from '../core/types'

// ============================================================================
// Korean Number Constants
// ============================================================================

const KOREAN_DIGITS: Record<string, string> = {
  '0': '영',
  '1': '일',
  '2': '이',
  '3': '삼',
  '4': '사',
  '5': '오',
  '6': '육',
  '7': '칠',
  '8': '팔',
  '9': '구'
}

// 고유어 수사 (개수, 시간 등에 사용)
const KOREAN_NATIVE_NUMBERS: Record<number, string> = {
  1: '한',
  2: '두',
  3: '세',
  4: '네',
  5: '다섯',
  6: '여섯',
  7: '일곱',
  8: '여덟',
  9: '아홉',
  10: '열',
  20: '스물'
}

// 영문자 발음 매핑 (개별 알파벳)
const ALPHABET_READINGS: Record<string, string> = {
  'A': '에이', 'B': '비', 'C': '씨', 'D': '디', 'E': '이',
  'F': '에프', 'G': '지', 'H': '에이치', 'I': '아이', 'J': '제이',
  'K': '케이', 'L': '엘', 'M': '엠', 'N': '엔', 'O': '오',
  'P': '피', 'Q': '큐', 'R': '알', 'S': '에스', 'T': '티',
  'U': '유', 'V': '브이', 'W': '더블유', 'X': '엑스', 'Y': '와이', 'Z': '제트'
}

// 자주 사용되는 영어 단어/약어 발음 (기본 제공)
const COMMON_ENGLISH_READINGS: Record<string, string> = {
  // IT/테크
  'AI': '에이아이',
  'API': '에이피아이',
  'GPU': '지피유',
  'CPU': '씨피유',
  'SSD': '에스에스디',
  'HDD': '에이치디디',
  'USB': '유에스비',
  'URL': '유알엘',
  'UI': '유아이',
  'UX': '유엑스',
  'IT': '아이티',
  'IoT': '아이오티',
  'OS': '오에스',
  'PC': '피씨',
  'VR': '브이알',
  'AR': '에이알',
  'ML': '엠엘',
  'DL': '디엘',
  'LLM': '엘엘엠',
  'NLP': '엔엘피',
  'SDK': '에스디케이',
  'IDE': '아이디이',
  'DB': '디비',
  'SQL': '에스큐엘',
  'NoSQL': '노에스큐엘',
  'SaaS': '사스',
  'PaaS': '파스',
  'IaaS': '이아스',
  'AWS': '에이더블유에스',
  'GCP': '지씨피',
  'CI': '씨아이',
  'CD': '씨디',
  'HTTP': '에이치티티피',
  'HTTPS': '에이치티티피에스',
  'JSON': '제이슨',
  'XML': '엑스엠엘',
  'CSS': '씨에스에스',
  'HTML': '에이치티엠엘',
  'JS': '제이에스',
  'TS': '티에스',
  'PDF': '피디에프',
  'PNG': '피엔지',
  'JPG': '제이피지',
  'JPEG': '제이펙',
  'GIF': '지프',
  'MP3': '엠피쓰리',
  'MP4': '엠피포',
  // 소셜/서비스
  'SNS': '에스엔에스',
  'DM': '디엠',
  'FAQ': '에프에이큐',
  'QA': '큐에이',
  'CEO': '씨이오',
  'CFO': '씨에프오',
  'CTO': '씨티오',
  'VP': '브이피',
  'PR': '피알',
  'HR': '에이치알',
  'B2B': '비투비',
  'B2C': '비투씨',
  'KPI': '케이피아이',
  'ROI': '알오아이',
  'OKR': '오케이알',
  // 일반
  'vs': '버서스',
  'VS': '버서스',
  'OK': '오케이',
  'VIP': '브이아이피',
  'DIY': '디아이와이',
  'MZ': '엠제트',
  'MBTI': '엠비티아이',
  'ESG': '이에스지',
  'NFT': '엔에프티',
  // 영어 발음
  'the': '더',
  'The': '더',
  'of': '오브',
  'for': '포',
  'to': '투',
  'and': '앤드',
  'or': '오어',
  'in': '인',
  'on': '온',
  'at': '앳',
  'by': '바이',
  'with': '위드',
  'from': '프롬',
  // 기술 용어
  'deep': '딥',
  'Deep': '딥',
  'machine': '머신',
  'Machine': '머신',
  'learning': '러닝',
  'Learning': '러닝',
  'neural': '뉴럴',
  'Neural': '뉴럴',
  'network': '네트워크',
  'Network': '네트워크',
  'data': '데이터',
  'Data': '데이터',
  'cloud': '클라우드',
  'Cloud': '클라우드',
  'server': '서버',
  'Server': '서버',
  'app': '앱',
  'App': '앱',
  'web': '웹',
  'Web': '웹',
  'open': '오픈',
  'Open': '오픈',
  'source': '소스',
  'Source': '소스',
  'chat': '챗',
  'Chat': '챗',
  'bot': '봇',
  'Bot': '봇',
  'smart': '스마트',
  'Smart': '스마트'
}

// 단위 읽기
const UNIT_READINGS: Record<string, string> = {
  // 길이
  'km': '킬로미터',
  'km²': '제곱킬로미터',
  'km2': '제곱킬로미터',
  'm': '미터',
  'm²': '제곱미터',
  'm2': '제곱미터',
  '㎡': '제곱미터',
  'cm': '센티미터',
  'mm': '밀리미터',
  'nm': '나노미터',
  '평': '평',
  // 무게
  'kg': '킬로그램',
  'g': '그램',
  'mg': '밀리그램',
  't': '톤',
  'ton': '톤',
  // 부피
  'L': '리터',
  'l': '리터',
  'ml': '밀리리터',
  'mL': '밀리리터',
  'cc': '씨씨',
  // 속도
  'km/h': '킬로미터 퍼 아워',
  'm/s': '미터 퍼 세컨드',
  'mph': '마일 퍼 아워',
  // 데이터
  'GB': '기가바이트',
  'MB': '메가바이트',
  'KB': '킬로바이트',
  'TB': '테라바이트',
  'PB': '페타바이트',
  'Gbps': '기가비피에스',
  'Mbps': '메가비피에스',
  'Kbps': '킬로비피에스',
  'bps': '비피에스',
  // 시간
  'ms': '밀리초',
  'sec': '초',
  'min': '분',
  'hr': '시간',
  // 전기/물리
  'V': '볼트',
  'W': '와트',
  'kW': '킬로와트',
  'MW': '메가와트',
  'A': '암페어',
  'Hz': '헤르츠',
  'kHz': '킬로헤르츠',
  'MHz': '메가헤르츠',
  'GHz': '기가헤르츠',
  // 온도
  '°C': '도',
  '℃': '도',
  '°F': '화씨',
  // 기타
  '%': '퍼센트',
  'px': '픽셀',
  'dpi': '디피아이',
  'fps': '프레임 퍼 세컨드'
}

// ============================================================================
// Korean Normalizer Class
// ============================================================================

export class KoreanNormalizer implements INormalizer {
  private rules: NormalizationRule[] = []
  private lexicon: Map<string, LexiconEntry> = new Map()
  private lexiconVariants: Map<string, string> = new Map()
  private testCases: Array<{ input: string; expected: string; rule: string }> = []

  constructor() {
    this.initializeDefaultRules()
  }

  private initializeDefaultRules(): void {
    // =========================================================================
    // Priority 100+: Lexicon (최우선)
    // =========================================================================
    this.addRule({
      id: 'lexicon_lookup',
      pattern: /\b([A-Za-z][A-Za-z0-9._-]*[A-Za-z0-9]|[A-Za-z])\b/g,
      replacement: (match) => this.lookupLexicon(match) || match,
      description: 'Lexicon lookup for brands/acronyms',
      priority: 100,
      category: 'brand',
      testCases: [
        { input: 'GlowUS', expected: '글로우어스' },
        { input: 'API', expected: '에이피아이' },
        { input: 'SaaS', expected: '사스' }
      ]
    })

    // =========================================================================
    // Priority 95-99: Dates & Times
    // =========================================================================
    this.addRule({
      id: 'date_yyyy_mm_dd',
      pattern: /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
      replacement: (_, year, month, day) => {
        return `${this.numberToKorean(year)}년 ${this.numberToKorean(month)}월 ${this.numberToKorean(day)}일`
      },
      description: 'Date format (YYYY-MM-DD)',
      priority: 98,
      category: 'date',
      testCases: [
        { input: '2026-01-24', expected: '이천이십육년 일월 이십사일' },
        { input: '2024/12/31', expected: '이천이십사년 십이월 삼십일일' }
      ]
    })

    this.addRule({
      id: 'date_mm_dd',
      pattern: /(\d{1,2})월\s*(\d{1,2})일/g,
      replacement: (_, month, day) => {
        return `${this.numberToKorean(month)}월 ${this.numberToKorean(day)}일`
      },
      description: 'Korean date format (M월 D일)',
      priority: 97,
      category: 'date',
      testCases: [
        { input: '1월 24일', expected: '일월 이십사일' }
      ]
    })

    this.addRule({
      id: 'time_hh_mm_ss',
      pattern: /(\d{1,2}):(\d{2})(?::(\d{2}))?/g,
      replacement: (_, hour, minute, second) => {
        let result = `${this.numberToKorean(hour)}시 ${this.numberToKorean(minute)}분`
        if (second) {
          result += ` ${this.numberToKorean(second)}초`
        }
        return result
      },
      description: 'Time format (HH:MM:SS)',
      priority: 96,
      category: 'time',
      testCases: [
        { input: '14:30', expected: '십사시 삼십분' },
        { input: '09:05:30', expected: '구시 오분 삼십초' }
      ]
    })

    // =========================================================================
    // Priority 90-94: Currency
    // =========================================================================
    this.addRule({
      id: 'currency_won_large',
      pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(만|억|조)\s*원/g,
      replacement: (_, num, unit) => {
        const cleanNum = num.replace(/,/g, '')
        const spoken = this.numberToKorean(cleanNum)
        return `${spoken}${unit} 원`
      },
      description: 'Korean Won with large units',
      priority: 93,
      category: 'currency',
      testCases: [
        { input: '2,400만원', expected: '이천사백만 원' },
        { input: '5억원', expected: '오억 원' }
      ]
    })

    this.addRule({
      id: 'currency_won',
      pattern: /(\d{1,3}(?:,\d{3})*)\s*원/g,
      replacement: (_, num) => {
        const cleanNum = num.replace(/,/g, '')
        return `${this.numberToKorean(cleanNum)} 원`
      },
      description: 'Korean Won',
      priority: 92,
      category: 'currency',
      testCases: [
        { input: '12,000원', expected: '만이천 원' },
        { input: '500원', expected: '오백 원' }
      ]
    })

    this.addRule({
      id: 'currency_dollar',
      pattern: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(만|억|조)?/g,
      replacement: (_, num, unit) => {
        const cleanNum = num.replace(/,/g, '')
        if (cleanNum.includes('.')) {
          const [whole, decimal] = cleanNum.split('.')
          return `${this.numberToKorean(whole)} 점 ${this.digitsToKorean(decimal)}${unit ? unit : ''} 달러`
        }
        return `${this.numberToKorean(cleanNum)}${unit ? unit : ''} 달러`
      },
      description: 'Dollar currency',
      priority: 91,
      category: 'currency',
      testCases: [
        { input: '$100', expected: '백 달러' },
        { input: '$1,500만', expected: '천오백만 달러' }
      ]
    })

    // =========================================================================
    // Priority 85-89: Percentages
    // =========================================================================
    this.addRule({
      id: 'percent_decimal',
      pattern: /(\d+)\.(\d+)\s*%/g,
      replacement: (_, whole, decimal) => {
        return `${this.numberToKorean(whole)} 점 ${this.digitsToKorean(decimal)} 퍼센트`
      },
      description: 'Percentage with decimal',
      priority: 88,
      category: 'percent',
      testCases: [
        { input: '3.3%', expected: '삼 점 삼 퍼센트' },
        { input: '99.9%', expected: '구십구 점 구 퍼센트' }
      ]
    })

    this.addRule({
      id: 'percent_integer',
      pattern: /(\d+)\s*%/g,
      replacement: (_, num) => `${this.numberToKorean(num)} 퍼센트`,
      description: 'Percentage integer',
      priority: 87,
      category: 'percent',
      testCases: [
        { input: '50%', expected: '오십 퍼센트' },
        { input: '100%', expected: '백 퍼센트' }
      ]
    })

    // =========================================================================
    // Priority 80-84: Units (제곱미터, 평, etc.)
    // =========================================================================
    this.addRule({
      id: 'unit_sqm',
      pattern: /(\d+(?:\.\d+)?)\s*(?:m²|㎡|m2)/g,
      replacement: (_, num) => `${this.numberToKorean(String(Math.floor(parseFloat(num))))} 제곱미터`,
      description: 'Square meters',
      priority: 84,
      category: 'unit',
      testCases: [
        { input: '30㎡', expected: '삼십 제곱미터' },
        { input: '100m²', expected: '백 제곱미터' }
      ]
    })

    this.addRule({
      id: 'unit_pyeong',
      pattern: /(\d+(?:\.\d+)?)\s*평/g,
      replacement: (_, num) => `${this.numberToKorean(String(Math.floor(parseFloat(num))))} 평`,
      description: 'Pyeong (Korean area unit)',
      priority: 83,
      category: 'unit',
      testCases: [
        { input: '30평', expected: '삼십 평' }
      ]
    })

    // 일반 단위들
    const unitPriority = 80
    Object.entries(UNIT_READINGS).forEach(([unit, reading], index) => {
      if (!['%', 'm²', '㎡', 'm2'].includes(unit)) {
        const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        this.addRule({
          id: `unit_${unit.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          pattern: new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapedUnit}(?![a-zA-Z가-힣])`, 'g'),
          replacement: (_, num) => {
            const parsed = parseFloat(num)
            if (num.includes('.')) {
              const [whole, decimal] = num.split('.')
              return `${this.numberToKorean(whole)} 점 ${this.digitsToKorean(decimal)} ${reading}`
            }
            return `${this.numberToKorean(num)} ${reading}`
          },
          description: `Unit: ${unit} -> ${reading}`,
          priority: unitPriority - (index * 0.1),
          category: 'unit'
        })
      }
    })

    // =========================================================================
    // Priority 70-79: Ranges and Periods
    // =========================================================================
    this.addRule({
      id: 'range_tilde',
      pattern: /(\d+)\s*[~～]\s*(\d+)/g,
      replacement: (_, start, end) => {
        return `${this.numberToKorean(start)}에서 ${this.numberToKorean(end)}`
      },
      description: 'Number range with tilde',
      priority: 78,
      category: 'range',
      testCases: [
        { input: '1~2', expected: '일에서 이' },
        { input: '10~20', expected: '십에서 이십' }
      ]
    })

    this.addRule({
      id: 'range_dash',
      pattern: /(\d+)\s*-\s*(\d+)(?=\s*(?:개|명|원|일|주|개월|년|시간|분|초|회))/g,
      replacement: (_, start, end) => {
        return `${this.numberToKorean(start)}에서 ${this.numberToKorean(end)}`
      },
      description: 'Number range with dash',
      priority: 77,
      category: 'range',
      testCases: [
        { input: '1-2주', expected: '일에서 이주' },
        { input: '3-5일', expected: '삼에서 오일' }
      ]
    })

    this.addRule({
      id: 'period_weeks',
      pattern: /(\d+)\s*주/g,
      replacement: (_, num) => `${this.numberToKorean(num)} 주`,
      description: 'Weeks',
      priority: 76,
      category: 'unit',
      testCases: [
        { input: '2주', expected: '이 주' }
      ]
    })

    // =========================================================================
    // Priority 60-69: Large Numbers
    // =========================================================================
    this.addRule({
      id: 'large_number_with_unit',
      pattern: /(\d{1,3}(?:,\d{3})*)\s*(만|억|조)/g,
      replacement: (_, num, unit) => {
        const cleanNum = num.replace(/,/g, '')
        return `${this.numberToKorean(cleanNum)}${unit}`
      },
      description: 'Large Korean numbers with units',
      priority: 68,
      category: 'number',
      testCases: [
        { input: '100만', expected: '백만' },
        { input: '1,000억', expected: '천억' }
      ]
    })

    this.addRule({
      id: 'comma_number',
      pattern: /\b(\d{1,3}(?:,\d{3})+)\b/g,
      replacement: (_, num) => this.numberToKorean(num.replace(/,/g, '')),
      description: 'Comma-separated numbers',
      priority: 65,
      category: 'number',
      testCases: [
        { input: '1,000', expected: '천' },
        { input: '1,234,567', expected: '백이십삼만 사천오백육십칠' }
      ]
    })

    this.addRule({
      id: 'large_plain_number',
      pattern: /\b(\d{5,})\b/g,
      replacement: (_, num) => this.numberToKorean(num),
      description: 'Large plain numbers (5+ digits)',
      priority: 60,
      category: 'number'
    })

    // =========================================================================
    // Priority 50-59: Ordinals and Special Numbers
    // =========================================================================
    this.addRule({
      id: 'ordinal_je',
      pattern: /제(\d+)/g,
      replacement: (_, num) => `제${this.numberToKorean(num)}`,
      description: 'Ordinal numbers (제N)',
      priority: 55,
      category: 'number',
      testCases: [
        { input: '제1', expected: '제일' },
        { input: '제100', expected: '제백' }
      ]
    })

    this.addRule({
      id: 'version_number',
      pattern: /v(\d+)(?:\.(\d+))?(?:\.(\d+))?/gi,
      replacement: (_, major, minor, patch) => {
        let result = `버전 ${this.numberToKorean(major)}`
        if (minor) result += ` 점 ${this.numberToKorean(minor)}`
        if (patch) result += ` 점 ${this.numberToKorean(patch)}`
        return result
      },
      description: 'Version numbers',
      priority: 54,
      category: 'number',
      testCases: [
        { input: 'v3', expected: '버전 삼' },
        { input: 'Veo3', expected: '버전 삼' }
      ]
    })

    // =========================================================================
    // Priority 40-49: Special Characters and Punctuation
    // =========================================================================
    this.addRule({
      id: 'slash_or',
      pattern: /([가-힣A-Za-z]+)\s*\/\s*([가-힣A-Za-z]+)/g,
      replacement: (_, a, b) => `${a} 또는 ${b}`,
      description: 'Slash as "or"',
      priority: 45,
      category: 'punctuation',
      testCases: [
        { input: 'UI/UX', expected: '유아이 또는 유엑스' }
      ]
    })

    this.addRule({
      id: 'parentheses_remove',
      pattern: /[（）\(\)]/g,
      replacement: ' ',
      description: 'Remove parentheses',
      priority: 44,
      category: 'punctuation'
    })

    this.addRule({
      id: 'brackets_remove',
      pattern: /[「」『』【】\[\]]/g,
      replacement: '',
      description: 'Remove brackets',
      priority: 43,
      category: 'punctuation'
    })

    this.addRule({
      id: 'ellipsis',
      pattern: /\.{2,}|…/g,
      replacement: ', ',
      description: 'Ellipsis to pause',
      priority: 42,
      category: 'punctuation'
    })

    this.addRule({
      id: 'normalize_comma',
      pattern: /\s*[,，、]\s*/g,
      replacement: ', ',
      description: 'Normalize commas',
      priority: 41,
      category: 'punctuation'
    })

    this.addRule({
      id: 'remove_asterisk',
      pattern: /\*+/g,
      replacement: '',
      description: 'Remove asterisks',
      priority: 40,
      category: 'punctuation'
    })

    // =========================================================================
    // Priority 30-39: English Word Handling
    // =========================================================================

    // 모든 대문자 약어 (2-5자) -> 알파벳별 발음
    this.addRule({
      id: 'acronym_all_caps',
      pattern: /\b([A-Z]{2,5})\b/g,
      replacement: (_, acronym) => {
        // 먼저 common에서 찾기
        if (COMMON_ENGLISH_READINGS[acronym]) {
          return COMMON_ENGLISH_READINGS[acronym]
        }
        // 없으면 알파벳별로 읽기
        return acronym.split('').map((c: string) => ALPHABET_READINGS[c] || c).join('')
      },
      description: 'Acronym to Korean pronunciation',
      priority: 38,
      category: 'english',
      testCases: [
        { input: 'AI', expected: '에이아이' },
        { input: 'API', expected: '에이피아이' },
        { input: 'XYZ', expected: '엑스와이제트' }
      ]
    })

    // 영어 단어 (common readings에서 찾기)
    this.addRule({
      id: 'english_common_words',
      pattern: /\b([A-Za-z][a-z]+)\b/g,
      replacement: (_, word) => {
        const reading = COMMON_ENGLISH_READINGS[word] || COMMON_ENGLISH_READINGS[word.toLowerCase()]
        return reading || word
      },
      description: 'Common English words to Korean',
      priority: 37,
      category: 'english',
      testCases: [
        { input: 'Deep', expected: '딥' },
        { input: 'learning', expected: '러닝' }
      ]
    })

    // CamelCase 분리 (예: ChatGPT -> 챗지피티)
    this.addRule({
      id: 'camelcase_split',
      pattern: /\b([A-Z][a-z]+)([A-Z][A-Za-z0-9]*)\b/g,
      replacement: (_, first, rest) => {
        const firstReading = COMMON_ENGLISH_READINGS[first] || COMMON_ENGLISH_READINGS[first.toLowerCase()] || first
        // rest가 대문자 약어면 알파벳별, 아니면 단어로
        let restReading = COMMON_ENGLISH_READINGS[rest]
        if (!restReading) {
          if (/^[A-Z]+$/.test(rest)) {
            restReading = rest.split('').map((c: string) => ALPHABET_READINGS[c] || c).join('')
          } else if (/^[A-Z]+\d+$/.test(rest)) {
            const letters = rest.replace(/\d+/g, '')
            const numbers = rest.replace(/[A-Z]+/g, '')
            restReading = letters.split('').map((c: string) => ALPHABET_READINGS[c] || c).join('') + this.numberToKorean(numbers)
          } else {
            restReading = rest
          }
        }
        return firstReading + restReading
      },
      description: 'CamelCase to Korean',
      priority: 36,
      category: 'english',
      testCases: [
        { input: 'ChatGPT', expected: '챗지피티' }
      ]
    })

    // =========================================================================
    // Priority 30-35: Final Cleanup
    // =========================================================================
    this.addRule({
      id: 'multiple_spaces',
      pattern: /\s{2,}/g,
      replacement: ' ',
      description: 'Collapse multiple spaces',
      priority: 32,
      category: 'special'
    })

    // 자연스러운 조사 연결 (숫자 뒤 조사)
    this.addRule({
      id: 'number_particle_fix',
      pattern: /(일|이|삼|사|오|육|칠|팔|구|십|백|천|만|억|조)\s+(이|가|을|를|은|는|와|과|로|으로|에|에서)/g,
      replacement: '$1$2',
      description: 'Connect number with particle',
      priority: 31,
      category: 'special'
    })

    // 불필요한 띄어쓰기 정리 (숫자+단위)
    this.addRule({
      id: 'number_unit_connect',
      pattern: /(일|이|삼|사|오|육|칠|팔|구|십|백|천|만|억|조)\s+(퍼센트|달러|원|명|개|번|회|년|월|일|시|분|초|주|평|미터|킬로)/g,
      replacement: '$1$2',
      description: 'Connect number with unit',
      priority: 30,
      category: 'special'
    })

    // Collect test cases
    this.testCases = this.rules
      .filter(r => r.testCases && r.testCases.length > 0)
      .flatMap(r => r.testCases!.map(tc => ({ ...tc, rule: r.description })))
  }

  // ===========================================================================
  // Number Conversion Methods
  // ===========================================================================

  /**
   * 숫자를 한국어로 변환 (예: 12345 -> 만이천삼백사십오)
   */
  private numberToKorean(numStr: string): string {
    const num = parseInt(numStr, 10)
    if (isNaN(num)) return numStr
    if (num === 0) return '영'

    // 매우 큰 수는 자릿수별로
    if (num >= 1000000000000) {
      return this.digitsToKorean(numStr)
    }

    const units = ['', '만', '억', '조']
    const result: string[] = []
    let remaining = num
    let unitIndex = 0

    while (remaining > 0) {
      const chunk = remaining % 10000
      if (chunk > 0) {
        const chunkStr = this.chunkToKorean(chunk)
        result.unshift(chunkStr + units[unitIndex])
      }
      remaining = Math.floor(remaining / 10000)
      unitIndex++
    }

    return result.join('').trim()
  }

  /**
   * 4자리 이하 숫자를 한국어로 (예: 2400 -> 이천사백)
   */
  private chunkToKorean(num: number): string {
    if (num === 0) return ''

    const parts: string[] = []
    const positions = [
      { value: 1000, name: '천' },
      { value: 100, name: '백' },
      { value: 10, name: '십' }
    ]

    let remaining = num

    for (const { value, name } of positions) {
      const digit = Math.floor(remaining / value)
      if (digit > 0) {
        if (digit === 1) {
          parts.push(name)
        } else {
          parts.push(KOREAN_DIGITS[digit.toString()] + name)
        }
        remaining %= value
      }
    }

    if (remaining > 0) {
      parts.push(KOREAN_DIGITS[remaining.toString()])
    }

    return parts.join('')
  }

  /**
   * 숫자를 자릿수별로 읽기 (예: 123 -> 일 이 삼)
   */
  private digitsToKorean(numStr: string): string {
    return numStr.split('').map(d => KOREAN_DIGITS[d] || d).join(' ')
  }

  // ===========================================================================
  // Lexicon Methods
  // ===========================================================================

  private lookupLexicon(term: string): string | null {
    // 직접 검색
    const entry = this.lexicon.get(term)
    if (entry) return entry.reading

    // 대소문자 무시 검색
    const lowerTerm = term.toLowerCase()
    for (const [key, entry] of this.lexicon) {
      if (key.toLowerCase() === lowerTerm) {
        return entry.reading
      }
    }

    // 변형 검색
    const mainTerm = this.lexiconVariants.get(term) || this.lexiconVariants.get(lowerTerm)
    if (mainTerm) {
      const entry = this.lexicon.get(mainTerm)
      if (entry) return entry.reading
    }

    return null
  }

  // ===========================================================================
  // Public Interface
  // ===========================================================================

  addRule(rule: NormalizationRule): void {
    this.rules.push(rule)
    this.rules.sort((a, b) => b.priority - a.priority)

    if (rule.testCases) {
      this.testCases.push(...rule.testCases.map(tc => ({
        ...tc,
        rule: rule.description
      })))
    }
  }

  loadLexicon(entries: LexiconEntry[]): void {
    for (const entry of entries) {
      this.lexicon.set(entry.term, entry)

      if (entry.variants) {
        for (const variant of entry.variants) {
          this.lexiconVariants.set(variant, entry.term)
        }
      }
    }
  }

  getTestCases(): Array<{ input: string; expected: string; rule: string }> {
    return this.testCases
  }

  normalize(text: string): NormalizationResult {
    const tokenMap: NormalizationResult['tokenMap'] = []
    const warnings: string[] = []
    let normalized = text

    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
      let match: RegExpExecArray | null

      while ((match = regex.exec(normalized)) !== null) {
        const original = match[0]
        const startPos = match.index

        let replacement: string
        if (typeof rule.replacement === 'function') {
          replacement = rule.replacement(original, ...match.slice(1))
        } else {
          replacement = original.replace(rule.pattern, rule.replacement)
        }

        if (replacement !== original) {
          tokenMap.push({
            original,
            normalized: replacement,
            rule: rule.description,
            position: { start: startPos, end: startPos + original.length }
          })

          // 치환 적용
          normalized = normalized.slice(0, startPos) + replacement + normalized.slice(startPos + original.length)

          // regex 위치 조정
          regex.lastIndex = startPos + replacement.length
        }
      }
    }

    // OOV 토큰 경고
    const foreignWords = normalized.match(/[A-Za-z]{2,}/g) || []
    for (const word of foreignWords) {
      if (!this.lexicon.has(word) && !this.lexiconVariants.has(word)) {
        warnings.push(`OOV token: ${word}`)
      }
    }

    // 최종 정리
    normalized = normalized.replace(/\s+/g, ' ').trim()

    return {
      original: text,
      normalized,
      tokenMap: tokenMap.sort((a, b) => a.position.start - b.position.start),
      warnings
    }
  }
}

// ===========================================================================
// Factory Function
// ===========================================================================

export function createNormalizer(): KoreanNormalizer {
  const normalizer = new KoreanNormalizer()

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lexiconData = require('../config/glowus_lexicon.json')
    normalizer.loadLexicon(lexiconData.entries)
  } catch (e) {
    console.warn('Could not load default lexicon:', e)
  }

  return normalizer
}

export default KoreanNormalizer
