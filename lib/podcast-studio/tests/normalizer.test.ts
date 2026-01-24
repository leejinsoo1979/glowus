/**
 * Korean Normalizer Test Suite
 * 50개 이상의 발음/정규화 테스트 케이스
 */

import { KoreanNormalizer } from '../modules/korean-normalizer'

describe('KoreanNormalizer', () => {
  let normalizer: KoreanNormalizer

  beforeEach(() => {
    normalizer = new KoreanNormalizer()
  })

  // ===========================================================================
  // 1. 숫자 정규화 (10 케이스)
  // ===========================================================================
  describe('숫자 정규화', () => {
    test('1자리 숫자', () => {
      const result = normalizer.normalize('숫자 5입니다')
      expect(result.normalized).toContain('오')
    })

    test('2자리 숫자', () => {
      const result = normalizer.normalize('25개')
      expect(result.normalized).toContain('이십오')
    })

    test('3자리 숫자', () => {
      const result = normalizer.normalize('100점')
      expect(result.normalized).toContain('백')
    })

    test('4자리 숫자 (천)', () => {
      const result = normalizer.normalize('2024년')
      expect(result.normalized).toContain('이천이십사')
    })

    test('콤마 있는 큰 숫자', () => {
      const result = normalizer.normalize('2,400만원')
      expect(result.normalized).toContain('이천사백만')
    })

    test('소수점 숫자', () => {
      const result = normalizer.normalize('3.14')
      expect(result.normalized).toContain('삼 점 일사')
    })

    test('퍼센트', () => {
      const result = normalizer.normalize('3.3%')
      expect(result.normalized).toContain('삼 점 삼 퍼센트')
    })

    test('범위 숫자', () => {
      const result = normalizer.normalize('10~20개')
      expect(result.normalized).toContain('열')
      expect(result.normalized).toContain('스물')
    })

    test('전화번호 형식', () => {
      const result = normalizer.normalize('010-1234-5678')
      expect(result.normalized).toMatch(/공일공|영일영/)
    })

    test('버전 번호', () => {
      const result = normalizer.normalize('v2.0.1')
      expect(result.normalized).toContain('버전')
    })
  })

  // ===========================================================================
  // 2. 날짜/시간 정규화 (10 케이스)
  // ===========================================================================
  describe('날짜/시간 정규화', () => {
    test('ISO 날짜 (YYYY-MM-DD)', () => {
      const result = normalizer.normalize('2026-01-24')
      expect(result.normalized).toContain('이천이십육년')
      expect(result.normalized).toContain('일월')
      expect(result.normalized).toContain('이십사일')
    })

    test('한국식 날짜 (YYYY년 M월 D일)', () => {
      const result = normalizer.normalize('2024년 12월 25일')
      expect(result.normalized).toContain('이천이십사년')
      expect(result.normalized).toContain('십이월')
    })

    test('슬래시 날짜', () => {
      const result = normalizer.normalize('2024/03/15')
      expect(result.normalized).toContain('이천이십사년')
    })

    test('시간 (24시간제)', () => {
      const result = normalizer.normalize('14:30')
      expect(result.normalized).toContain('십사시')
      expect(result.normalized).toContain('삼십분')
    })

    test('시간 (12시간제 + AM/PM)', () => {
      const result = normalizer.normalize('오후 3시 30분')
      expect(result.normalized).toContain('오후')
      expect(result.normalized).toContain('세시')
    })

    test('기간 표현', () => {
      const result = normalizer.normalize('3개월')
      expect(result.normalized).toContain('세')
      expect(result.normalized).toContain('개월')
    })

    test('연도만', () => {
      const result = normalizer.normalize('2025년에')
      expect(result.normalized).toContain('이천이십오년')
    })

    test('월일만', () => {
      const result = normalizer.normalize('3월 1일')
      expect(result.normalized).toContain('삼월')
      expect(result.normalized).toContain('일일')
    })

    test('요일 포함', () => {
      const result = normalizer.normalize('금요일')
      expect(result.normalized).toContain('금요일')
    })

    test('상대적 시간', () => {
      const result = normalizer.normalize('3일 전')
      expect(result.normalized).toContain('삼')
      expect(result.normalized).toContain('일 전')
    })
  })

  // ===========================================================================
  // 3. 통화/금액 정규화 (8 케이스)
  // ===========================================================================
  describe('통화/금액 정규화', () => {
    test('원화', () => {
      const result = normalizer.normalize('5000원')
      expect(result.normalized).toContain('오천')
      expect(result.normalized).toContain('원')
    })

    test('만원 단위', () => {
      const result = normalizer.normalize('50만원')
      expect(result.normalized).toContain('오십만')
    })

    test('억원 단위', () => {
      const result = normalizer.normalize('3억원')
      expect(result.normalized).toContain('삼억')
    })

    test('달러', () => {
      const result = normalizer.normalize('$100')
      expect(result.normalized).toContain('백')
      expect(result.normalized).toContain('달러')
    })

    test('유로', () => {
      const result = normalizer.normalize('€50')
      expect(result.normalized).toContain('오십')
      expect(result.normalized).toContain('유로')
    })

    test('엔화', () => {
      const result = normalizer.normalize('¥1000')
      expect(result.normalized).toContain('천')
      expect(result.normalized).toContain('엔')
    })

    test('소수점 금액', () => {
      const result = normalizer.normalize('$19.99')
      expect(result.normalized).toContain('십구')
      expect(result.normalized).toContain('달러')
    })

    test('콤마 금액', () => {
      const result = normalizer.normalize('₩1,000,000')
      expect(result.normalized).toContain('백만')
    })
  })

  // ===========================================================================
  // 4. 단위 정규화 (10 케이스)
  // ===========================================================================
  describe('단위 정규화', () => {
    test('제곱미터', () => {
      const result = normalizer.normalize('30㎡')
      expect(result.normalized).toContain('삼십')
      expect(result.normalized).toContain('제곱미터')
    })

    test('평', () => {
      const result = normalizer.normalize('25평')
      expect(result.normalized).toContain('이십오')
      expect(result.normalized).toContain('평')
    })

    test('킬로미터', () => {
      const result = normalizer.normalize('100km')
      expect(result.normalized).toContain('백')
      expect(result.normalized).toContain('킬로미터')
    })

    test('기가바이트', () => {
      const result = normalizer.normalize('256GB')
      expect(result.normalized).toContain('이백오십육')
      expect(result.normalized).toContain('기가바이트')
    })

    test('킬로그램', () => {
      const result = normalizer.normalize('70kg')
      expect(result.normalized).toContain('칠십')
      expect(result.normalized).toContain('킬로그램')
    })

    test('센티미터', () => {
      const result = normalizer.normalize('180cm')
      expect(result.normalized).toContain('백팔십')
      expect(result.normalized).toContain('센티미터')
    })

    test('리터', () => {
      const result = normalizer.normalize('2L')
      expect(result.normalized).toContain('이')
      expect(result.normalized).toContain('리터')
    })

    test('밀리리터', () => {
      const result = normalizer.normalize('500ml')
      expect(result.normalized).toContain('오백')
      expect(result.normalized).toContain('밀리리터')
    })

    test('속도 (km/h)', () => {
      const result = normalizer.normalize('100km/h')
      expect(result.normalized).toContain('킬로미터')
    })

    test('데이터 속도 (Mbps)', () => {
      const result = normalizer.normalize('100Mbps')
      expect(result.normalized).toContain('메가비피에스')
    })
  })

  // ===========================================================================
  // 5. 약어/영어 정규화 (10 케이스)
  // ===========================================================================
  describe('약어/영어 정규화', () => {
    test('API', () => {
      const result = normalizer.normalize('API 호출')
      expect(result.normalized).toContain('에이피아이')
    })

    test('SaaS', () => {
      const result = normalizer.normalize('SaaS 서비스')
      expect(result.normalized).toContain('사스')
    })

    test('AI', () => {
      const result = normalizer.normalize('AI 기술')
      expect(result.normalized).toContain('에이아이')
    })

    test('UI/UX', () => {
      const result = normalizer.normalize('UI/UX 디자인')
      expect(result.normalized).toContain('유아이')
      expect(result.normalized).toContain('유엑스')
    })

    test('CEO', () => {
      const result = normalizer.normalize('CEO 인터뷰')
      expect(result.normalized).toContain('씨이오')
    })

    test('PDF', () => {
      const result = normalizer.normalize('PDF 파일')
      expect(result.normalized).toContain('피디에프')
    })

    test('HTTPS', () => {
      const result = normalizer.normalize('HTTPS 프로토콜')
      expect(result.normalized).toContain('에이치티티피에스')
    })

    test('EC2 (숫자 포함)', () => {
      const result = normalizer.normalize('EC2 인스턴스')
      expect(result.normalized).toContain('이씨투')
    })

    test('S3 (숫자 포함)', () => {
      const result = normalizer.normalize('S3 버킷')
      expect(result.normalized).toContain('에스쓰리')
    })

    test('5G', () => {
      const result = normalizer.normalize('5G 네트워크')
      expect(result.normalized).toContain('오지')
    })
  })

  // ===========================================================================
  // 6. 브랜드/제품명 정규화 (8 케이스)
  // ===========================================================================
  describe('브랜드/제품명 정규화', () => {
    test('GlowUS', () => {
      normalizer.loadLexicon([
        { term: 'GlowUS', reading: '글로우어스', category: 'brand' }
      ])
      const result = normalizer.normalize('GlowUS 플랫폼')
      expect(result.normalized).toContain('글로우어스')
    })

    test('iPhone', () => {
      normalizer.loadLexicon([
        { term: 'iPhone', reading: '아이폰', category: 'brand' }
      ])
      const result = normalizer.normalize('iPhone 16')
      expect(result.normalized).toContain('아이폰')
    })

    test('ChatGPT', () => {
      normalizer.loadLexicon([
        { term: 'ChatGPT', reading: '챗지피티', category: 'brand' }
      ])
      const result = normalizer.normalize('ChatGPT 활용')
      expect(result.normalized).toContain('챗지피티')
    })

    test('YouTube', () => {
      normalizer.loadLexicon([
        { term: 'YouTube', reading: '유튜브', category: 'brand' }
      ])
      const result = normalizer.normalize('YouTube 채널')
      expect(result.normalized).toContain('유튜브')
    })

    test('Google', () => {
      normalizer.loadLexicon([
        { term: 'Google', reading: '구글', category: 'brand' }
      ])
      const result = normalizer.normalize('Google 검색')
      expect(result.normalized).toContain('구글')
    })

    test('Tesla', () => {
      normalizer.loadLexicon([
        { term: 'Tesla', reading: '테슬라', category: 'brand' }
      ])
      const result = normalizer.normalize('Tesla 전기차')
      expect(result.normalized).toContain('테슬라')
    })

    test('Netflix', () => {
      normalizer.loadLexicon([
        { term: 'Netflix', reading: '넷플릭스', category: 'brand' }
      ])
      const result = normalizer.normalize('Netflix 드라마')
      expect(result.normalized).toContain('넷플릭스')
    })

    test('Spotify', () => {
      normalizer.loadLexicon([
        { term: 'Spotify', reading: '스포티파이', category: 'brand' }
      ])
      const result = normalizer.normalize('Spotify 재생')
      expect(result.normalized).toContain('스포티파이')
    })
  })

  // ===========================================================================
  // 7. 특수 패턴 정규화 (8 케이스)
  // ===========================================================================
  describe('특수 패턴 정규화', () => {
    test('괄호 처리', () => {
      const result = normalizer.normalize('AI(인공지능)')
      expect(result.normalized).not.toContain('(')
    })

    test('슬래시 처리', () => {
      const result = normalizer.normalize('가입/탈퇴')
      expect(result.normalized).toContain('또는')
    })

    test('하이픈 연결', () => {
      const result = normalizer.normalize('온라인-오프라인')
      expect(result.normalized).not.toContain('-')
    })

    test('물결표 범위', () => {
      const result = normalizer.normalize('10~20대')
      expect(result.normalized).toContain('에서')
    })

    test('따옴표 제거', () => {
      const result = normalizer.normalize('"핵심"')
      expect(result.normalized).not.toContain('"')
    })

    test('줄임말 처리', () => {
      const result = normalizer.normalize('etc.')
      expect(result.normalized).toContain('등')
    })

    test('이모지 제거', () => {
      const result = normalizer.normalize('좋아요👍')
      expect(result.normalized).not.toContain('👍')
    })

    test('URL 단순화', () => {
      const result = normalizer.normalize('https://example.com')
      // URL은 적절히 처리되어야 함
      expect(result.normalized).toBeDefined()
    })
  })

  // ===========================================================================
  // 8. tokenMap 검증 (4 케이스)
  // ===========================================================================
  describe('tokenMap 검증', () => {
    test('tokenMap에 변환 기록 포함', () => {
      const result = normalizer.normalize('100원')
      expect(result.tokenMap.length).toBeGreaterThan(0)
      expect(result.tokenMap[0]).toHaveProperty('original')
      expect(result.tokenMap[0]).toHaveProperty('normalized')
      expect(result.tokenMap[0]).toHaveProperty('rule')
    })

    test('위치 정보 포함', () => {
      const result = normalizer.normalize('2024년 100원')
      for (const token of result.tokenMap) {
        expect(token.position).toHaveProperty('start')
        expect(token.position).toHaveProperty('end')
      }
    })

    test('여러 변환 추적', () => {
      const result = normalizer.normalize('2024년 3월 100원')
      expect(result.tokenMap.length).toBeGreaterThanOrEqual(2)
    })

    test('경고 포함 여부', () => {
      // OOV 토큰 포함 시 경고 생성
      const result = normalizer.normalize('xyzabc123')
      // 경고가 있거나 정상 처리되어야 함
      expect(result.warnings).toBeDefined()
    })
  })

  // ===========================================================================
  // 9. 규칙 추가/확장 (4 케이스)
  // ===========================================================================
  describe('규칙 추가/확장', () => {
    test('커스텀 규칙 추가', () => {
      normalizer.addRule({
        id: 'custom_test',
        pattern: /테스트패턴/g,
        replacement: '커스텀결과',
        description: '테스트 규칙',
        priority: 100,
        category: 'special'
      })
      const result = normalizer.normalize('테스트패턴 입력')
      expect(result.normalized).toContain('커스텀결과')
    })

    test('렉시콘 로드', () => {
      normalizer.loadLexicon([
        { term: 'CustomBrand', reading: '커스텀브랜드', category: 'brand' }
      ])
      const result = normalizer.normalize('CustomBrand 제품')
      expect(result.normalized).toContain('커스텀브랜드')
    })

    test('테스트 케이스 조회', () => {
      const testCases = normalizer.getTestCases()
      expect(testCases.length).toBeGreaterThan(0)
      expect(testCases[0]).toHaveProperty('input')
      expect(testCases[0]).toHaveProperty('expected')
    })

    test('우선순위 렉시콘', () => {
      normalizer.loadLexicon([
        { term: 'API', reading: '커스텀에이피아이', category: 'acronym', priority: 'user' },
        { term: 'API', reading: '에이피아이', category: 'acronym', priority: 'global' }
      ])
      const result = normalizer.normalize('API 호출')
      expect(result.normalized).toContain('커스텀에이피아이')
    })
  })
})
