// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { getGrokClient } from '@/lib/llm/client'
import crypto from 'crypto'
import { checkCredits, deductCredits, CREDIT_PRICING } from '@/lib/credits'

export const dynamic = 'force-dynamic'

// 캐시 설정
const CACHE_TTL_DAYS = 7  // 캐시 유효기간 (일)
const MODEL_VERSION = 'grok-4-1-fast'  // 모델 버전 (변경 시 캐시 무효화)

/**
 * 카테고리별 상세 매칭 정보
 */
interface CategoryDetail {
  score: number               // 획득 점수
  max: number                 // 최대 점수
  status: 'full' | 'partial' | 'low' | 'none'  // 매칭 상태
  reason: string              // 매칭 근거 설명
  profile_value: string       // 내 프로필 값
  program_requirement: string // 프로그램 요구사항
  tips?: string               // 개선 팁 (선택)
}

/**
 * 적합도 점수 구성 요소
 */
interface FitScoreBreakdown {
  industry_match: number      // 업종 매칭 (30%)
  scale_match: number         // 매출/직원 규모 (20%)
  region_match: number        // 지역 (15%)
  type_match: number          // 사업자 유형 (15%)
  special_match: number       // 특수 조건 (20%)
  reasons: string[]           // 매칭 이유 설명
  summary?: string            // 종합 의견
  analysis_quality?: 'high' | 'medium' | 'low'  // 분석 품질 (상세내용 유무에 따라)
  content_length?: number     // 분석에 사용된 콘텐츠 길이
  // 자격 미달 여부
  disqualified?: boolean      // 필수 조건 미충족으로 제외
  disqualification_reasons?: string[]  // 미충족 사유
  // 카테고리별 상세 정보
  industry_detail?: CategoryDetail
  scale_detail?: CategoryDetail
  region_detail?: CategoryDetail
  type_detail?: CategoryDetail
  special_details?: CategoryDetail[]
}

/**
 * 매칭된 프로그램 정보
 */
interface MatchedProgram {
  program: any
  fit_score: number
  fit_breakdown: FitScoreBreakdown
  ai_analysis?: AIAnalysisResult
}

/**
 * AI 분석 결과
 */
interface AIAnalysisResult {
  fit_level: 'excellent' | 'good' | 'possible' | 'poor' | 'disqualified'
  fit_score: number  // 0-100
  summary: string
  company_stage_fit: string
  program_value: string
  strategic_reasons: string[]
  concerns: string[]
  action_recommendation: string
  confidence: number  // 0-1
}

/**
 * 🔐 프로필 해시 생성
 * - 매칭에 영향을 주는 주요 필드만 포함
 * - 프로필 변경 시 캐시 자동 무효화
 */
function generateProfileHash(profile: any): string {
  const keyFields = {
    industry_category: profile.industry_category || '',
    industry_subcategory: profile.industry_subcategory || '',
    business_years: profile.business_years || 0,
    startup_stage: profile.startup_stage || '',
    employee_count: profile.employee_count || 0,
    annual_revenue: profile.annual_revenue || 0,
    region: profile.region || '',
    entity_type: profile.entity_type || '',
    business_description: profile.business_description?.slice(0, 200) || '',
    main_products: profile.main_products?.slice(0, 200) || '',
    core_technologies: profile.core_technologies?.slice(0, 200) || '',
    tech_certifications: (profile.tech_certifications || []).sort().join(','),
    interested_categories: (profile.interested_categories || []).sort().join(','),
    interested_keywords: (profile.interested_keywords || []).sort().join(','),
    is_youth_startup: profile.is_youth_startup || false,
    is_female_owned: profile.is_female_owned || false,
    is_social_enterprise: profile.is_social_enterprise || false,
    is_venture_certified: profile.is_venture_certified || false,
    is_export_business: profile.is_export_business || false,
    model_version: MODEL_VERSION  // 모델 버전도 해시에 포함
  }

  const jsonStr = JSON.stringify(keyFields)
  return crypto.createHash('md5').update(jsonStr).digest('hex')
}

/**
 * 📦 캐시에서 AI 분석 결과 조회
 */
async function getCachedAIResult(
  adminSupabase: any,
  userId: string,
  programId: string,
  profileHash: string
): Promise<AIAnalysisResult | null> {
  try {
    const { data, error } = await adminSupabase
      .from('ai_match_cache')
      .select('ai_result, id, hit_count')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .eq('profile_hash', profileHash)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error) {
      // 테이블이 없는 경우 (PGRST205) 조용히 무시
      if (error.code === 'PGRST205' || error.code === 'PGRST116') {
        return null
      }
      console.error('[AI Cache] Lookup error:', error.message)
      return null
    }

    if (!data) return null

    // 캐시 히트 카운트 증가 (비동기, 에러 무시)
    adminSupabase
      .from('ai_match_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {})
      .catch(() => {})

    console.log(`[AI Cache] HIT for program ${programId.slice(0, 8)}`)
    return data.ai_result as AIAnalysisResult
  } catch (error) {
    // 테이블 없어도 에러 출력 안함
    return null
  }
}

/**
 * 💾 AI 분석 결과를 캐시에 저장
 */
async function cacheAIResult(
  adminSupabase: any,
  userId: string,
  programId: string,
  profileHash: string,
  result: AIAnalysisResult
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS)

    const { error } = await adminSupabase
      .from('ai_match_cache')
      .upsert({
        user_id: userId,
        program_id: programId,
        profile_hash: profileHash,
        ai_result: result,
        model_version: MODEL_VERSION,
        expires_at: expiresAt.toISOString(),
        hit_count: 0
      }, {
        onConflict: 'user_id,program_id,profile_hash'
      })

    if (error) {
      // 테이블이 없는 경우 (PGRST205) 조용히 무시
      if (error.code === 'PGRST205') {
        return
      }
      console.error('[AI Cache] Save error:', error.message)
      return
    }

    console.log(`[AI Cache] SAVED for program ${programId.slice(0, 8)}`)
  } catch (error) {
    // 캐시 저장 실패는 무시 (기능에 영향 없음)
  }
}

/**
 * 🧠 AI 기반 지능형 매칭 분석
 * - 회사 현재 상태 깊이 이해
 * - 지원사업 실제 내용 분석
 * - 전략적 판단 제공
 */
async function analyzeWithAI(profile: any, program: any): Promise<AIAnalysisResult | null> {
  try {
    // 1. 회사 컨텍스트 구성
    const companyContext = `
## 회사 정보
- 회사명: ${profile.company_name || '미입력'}
- 대표자: ${profile.ceo_name || '미입력'}
- 업종: ${profile.industry_category || '미입력'} / ${profile.industry_subcategory || ''}
- 업력: ${profile.business_years || '미입력'}년
- 창업단계: ${profile.startup_stage || '미입력'}
- 직원수: ${profile.employee_count || '미입력'}명
- 매출: ${profile.annual_revenue ? (profile.annual_revenue / 100000000).toFixed(1) + '억원' : '미입력'}
- 지역: ${profile.region || '미입력'} ${profile.city || ''}
- 사업자유형: ${profile.entity_type || '미입력'}

## 사업 내용
${profile.business_description || '미입력'}

## 주요 제품/서비스
${profile.main_products || '미입력'}

## 핵심 기술
${profile.core_technologies || '미입력'}

## 보유 인증
${profile.tech_certifications?.join(', ') || '없음'}

## 관심 분야
${profile.interested_categories?.join(', ') || '미입력'}

## 관심 키워드
${profile.interested_keywords?.join(', ') || '미입력'}

## 특수 조건
- 청년창업: ${profile.is_youth_startup ? '예' : '아니오'}
- 여성기업: ${profile.is_female_owned ? '예' : '아니오'}
- 사회적기업: ${profile.is_social_enterprise ? '예' : '아니오'}
- 수출기업: ${profile.is_export_business ? '예' : '아니오'}
`

    // 2. 지원사업 정보 정제
    const programContent = stripHtmlTags(program.content || '')
    const programContext = `
## 지원사업 정보
- 제목: ${program.title}
- 주관기관: ${program.organization || '미입력'}
- 수행기관: ${program.executing_agency || '미입력'}
- 카테고리: ${program.category || '미입력'}
- 지원유형: ${program.support_type || '미입력'}
- 신청기간: ${program.apply_start_date || '미정'} ~ ${program.apply_end_date || '미정'}
- 지원금액: ${program.support_amount || '공고 참조'}

## 상세 내용
${programContent.slice(0, 3000)}
`

    // 3. AI 분석 요청 (Grok 4.1 Fast - 빠르고 저렴)
    const grok = getGrokClient()
    const response = await grok.chat.completions.create({
      model: 'grok-4-1-fast',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{
        role: 'system',
        content: '당신은 정부지원사업 전문 컨설턴트입니다. 회사 정보와 지원사업 정보를 분석하여 적합성을 판단합니다. 응답은 반드시 JSON 형식으로만 해주세요.'
      }, {
        role: 'user',
        content: `아래 회사 정보와 지원사업 정보를 분석하여 이 회사에게 이 지원사업이 적합한지 판단해주세요.

${companyContext}

---

${programContext}

---

## 분석 요청

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "fit_level": "excellent|good|possible|poor|disqualified 중 하나",
  "fit_score": 0-100 사이 점수,
  "summary": "2-3문장으로 핵심 판단 요약",
  "company_stage_fit": "이 회사의 현재 단계(업력, 규모, 기술수준)에서 이 사업이 적합한 이유 또는 부적합한 이유",
  "program_value": "이 지원사업이 회사에 제공할 수 있는 실질적 가치",
  "strategic_reasons": ["지원해야 하는 전략적 이유 3가지 (구체적으로)"],
  "concerns": ["우려사항이나 주의점 (있다면)"],
  "action_recommendation": "구체적인 행동 권고 (신청 추천/비추천 및 이유)",
  "confidence": 0.0-1.0 사이 확신도
}

판단 기준:
1. 회사의 현재 발전 단계에서 필요한 지원인가?
2. 회사의 기술/제품과 지원사업의 목적이 부합하는가?
3. 자격 요건(업력, 규모, 지역 등)을 충족하는가?
4. 경쟁률 대비 선정 가능성이 있는가?
5. 지원 규모와 조건이 회사에 실질적 도움이 되는가?

disqualified는 자격 요건을 명백히 미충족할 때만 사용하세요.`
      }],
      response_format: { type: 'json_object' }
    })

    // 4. 응답 파싱
    const content = response.choices[0]?.message?.content
    if (!content) return null

    const result = JSON.parse(content) as AIAnalysisResult
    return result

  } catch (error: any) {
    console.error('[AI Analysis] Error for program:', program.title?.slice(0, 50))
    console.error('[AI Analysis] Error details:', error?.message || error)
    return null
  }
}

/**
 * 키워드 사전 - 업종별 연관 키워드
 */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  '정보통신업': ['IT', 'ICT', '소프트웨어', 'SW', '플랫폼', '앱', '웹', '클라우드', 'AI', '인공지능', '빅데이터', '데이터', '디지털', '테크', '스타트업', '핀테크', '블록체인', 'SaaS', '솔루션'],
  '제조업': ['제조', '생산', '공장', '기계', '장비', '부품', '소재', '스마트팩토리', '자동화', '로봇', '3D프린팅'],
  '바이오/헬스케어': ['바이오', '헬스케어', '의료', '제약', '건강', '메디컬', '병원', '진단', '치료', '임상', '신약'],
  '콘텐츠/미디어': ['콘텐츠', '미디어', '영상', '게임', '엔터테인먼트', '크리에이터', '방송', 'OTT', '웹툰', '애니메이션'],
  '유통/물류': ['유통', '물류', '이커머스', '커머스', '쇼핑', '배송', '풀필먼트', '라스트마일'],
  '교육/에듀테크': ['교육', '에듀테크', '학습', '강의', 'LMS', '온라인교육', '이러닝'],
  '환경/에너지': ['환경', '에너지', '친환경', 'ESG', '탄소', '신재생', '태양광', '전기차', 'EV'],
  '농업/식품': ['농업', '식품', '푸드테크', 'F&B', '농산물', '스마트팜'],
  '금융/핀테크': ['금융', '핀테크', '은행', '보험', '투자', '결제', '페이먼트'],
  '부동산/건설': ['부동산', '건설', '건축', '프롭테크', '인테리어'],
}

/**
 * 지역 키워드
 */
const REGION_KEYWORDS: Record<string, string[]> = {
  '서울': ['서울', '수도권', '강남', '판교'],
  '경기': ['경기', '수도권', '판교', '성남', '수원', '화성'],
  '인천': ['인천', '수도권'],
  '부산': ['부산', '동남권', '경남'],
  '대구': ['대구', '경북', '대경권'],
  '광주': ['광주', '전남', '호남'],
  '대전': ['대전', '충청', '세종'],
  '울산': ['울산', '동남권'],
  '세종': ['세종', '충청', '대전'],
  '강원': ['강원', '춘천', '원주'],
  '충북': ['충북', '충청', '청주'],
  '충남': ['충남', '충청', '천안'],
  '전북': ['전북', '호남', '전주'],
  '전남': ['전남', '호남', '광주'],
  '경북': ['경북', '대경권', '포항'],
  '경남': ['경남', '동남권', '창원'],
  '제주': ['제주'],
}

/**
 * 창업 단계 키워드
 */
const STAGE_KEYWORDS: Record<string, string[]> = {
  '예비창업': ['예비', '예비창업자', '창업준비', '창업교육', '아이디어'],
  '초기창업': ['초기', '초기창업', '시드', 'seed', '3년이내', '7년이내', '신규창업'],
  '성장기': ['성장', '도약', '스케일업', 'scale-up', '확장'],
  '성숙기': ['글로벌', '해외진출', 'IR', '투자유치', '시리즈'],
}

/**
 * HTML 태그 제거 함수
 * - HTML 태그, 스크립트, 스타일 제거
 * - HTML 엔티티 디코딩
 * - 연속 공백 정리
 */
function stripHtmlTags(html: string): string {
  if (!html) return ''

  return html
    // 스크립트, 스타일 태그와 내용 제거
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // HTML 태그 제거
    .replace(/<[^>]+>/g, ' ')
    // HTML 엔티티 디코딩
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    // 연속 공백 정리
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 짧은 키워드(2-3자)는 단어 경계로 매칭, 긴 키워드는 부분 일치
 * - "IT", "AI", "SW" 등 짧은 영문은 단어 경계 필수
 * - "소프트웨어", "인공지능" 등 긴 단어는 포함 여부만 확인
 */
function matchKeyword(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()

  // 영문 2-3자 키워드는 단어 경계로 매칭 (IT가 title에 매칭되는 것 방지)
  if (/^[a-z]{2,3}$/i.test(keyword)) {
    // 단어 경계: 공백, 문장부호, 괄호, 시작/끝
    const regex = new RegExp(`(?:^|[\\s,.;:()\\[\\]{}'"·•-])${lowerKeyword}(?:[\\s,.;:()\\[\\]{}'"·•-]|$)`, 'i')
    return regex.test(lowerText)
  }

  // 긴 키워드는 단순 포함 여부
  return lowerText.includes(lowerKeyword)
}

/**
 * 텍스트에서 키워드 매칭 점수 계산 (HTML 제거 + 단어 경계 매칭)
 */
function calculateKeywordMatch(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0

  // HTML 태그 제거
  const cleanText = stripHtmlTags(text)

  let matches = 0
  for (const keyword of keywords) {
    if (matchKeyword(cleanText, keyword)) {
      matches++
    }
  }
  return Math.min(matches / Math.max(keywords.length * 0.3, 1), 1) // 30% 이상 매칭시 만점
}

/**
 * 매칭된 키워드 목록 반환 (디버깅/표시용)
 */
function getMatchedKeywords(text: string, keywords: string[]): string[] {
  if (!text || keywords.length === 0) return []

  const cleanText = stripHtmlTags(text)
  return keywords.filter(keyword => matchKeyword(cleanText, keyword))
}

/**
 * 상태 결정 헬퍼 함수
 */
function getStatus(score: number, max: number): 'full' | 'partial' | 'low' | 'none' {
  const ratio = score / max
  if (ratio >= 0.9) return 'full'
  if (ratio >= 0.6) return 'partial'
  if (ratio >= 0.3) return 'low'
  return 'none'
}

/**
 * 프로그램 텍스트에서 요구사항 추출
 */
function extractRequirement(programText: string, keywords: string[], defaultText: string): string {
  for (const keyword of keywords) {
    if (programText.includes(keyword.toLowerCase())) {
      return keyword
    }
  }
  return defaultText
}

/**
 * 회사 프로필과 프로그램 간의 적합도 계산 (텍스트 분석 기반)
 */
function calculateFitScore(profile: any, program: any): FitScoreBreakdown {
  const breakdown: FitScoreBreakdown = {
    industry_match: 0,
    scale_match: 0,
    region_match: 0,
    type_match: 0,
    special_match: 0,
    reasons: [],
    special_details: [],
    disqualified: false,
    disqualification_reasons: []
  }

  // 프로그램 텍스트 통합 (HTML 제거 후 사용)
  // 실제 DB 스키마에 맞는 필드명 사용: eligibility_criteria (not eligibility)
  const rawContent = [
    program.title || '',
    program.content || '',
    program.ai_summary || '',
    program.eligibility_criteria || '',
    program.category || ''
  ].join(' ')

  // HTML 태그 제거 후 정제된 텍스트
  const programText = stripHtmlTags(rawContent).toLowerCase()

  // 분석 품질 판정 (상세 내용 길이에 따라) - HTML 제거 후 측정
  const cleanContent = stripHtmlTags(program.content || '')
  const cleanEligibility = stripHtmlTags(program.eligibility_criteria || '')
  const contentLength = cleanContent.length + cleanEligibility.length

  let analysisQuality: 'high' | 'medium' | 'low' = 'low'
  if (contentLength > 1000) {
    analysisQuality = 'high'
  } else if (contentLength > 300) {
    analysisQuality = 'medium'
  }

  breakdown.analysis_quality = analysisQuality
  breakdown.content_length = contentLength

  const profileText = [
    profile.business_description || '',
    profile.main_products || '',
    profile.core_technologies || '',
    profile.industry_category || ''
  ].join(' ').toLowerCase()

  // 1. 업종 매칭 (30점) - 🔄 전면 재설계: "제한 기반" 필터링
  // 핵심 원칙: 대부분의 창업/중소기업 지원사업은 업종 무관. 특정 업종 "제한"이 있을 때만 패널티
  let industryScore = 20 // ✨ 기본 점수 높게 시작 (업종 제한이 없으면 신청 가능하다고 가정)
  let industryReason = ''
  let matchedKeywords: string[] = []
  let programIndustryReq = '제한 없음'

  // === STEP 1: 특정 업종 전용 사업인지 체크 (제외 조건) ===
  const RESTRICTED_INDUSTRY_MAP: Record<string, string[]> = {
    '농업/축산': ['농업', '농산물', '축산', '영농', '농촌', '농가', '스마트팜', '농기계', '양식', '어업', '수산'],
    '관광/요식': ['관광', '여행', '호텔', '숙박', '음식점', '요식업', '외식', '카페'],
    '건설/부동산': ['건설업', '건축업', '시공', '건물'],
    '바이오/의료': ['제약', '의약품', '임상', '병원', '의료기기', '헬스케어 전용'],
    '제조업 전용': ['제조공장', '생산라인', '제조설비', '공장자동화'],
  }

  let restrictedTo = ''
  for (const [industry, keywords] of Object.entries(RESTRICTED_INDUSTRY_MAP)) {
    // 제목에 특정 업종이 명시된 경우 (가장 확실한 제한)
    const titleHasRestriction = keywords.some(k => program.title?.includes(k))
    if (titleHasRestriction) {
      restrictedTo = industry
      break
    }
  }

  // 프로필 업종과 제한 업종 비교
  const profileIndustry = profile.industry_category || ''
  const isProfileMatchingRestriction = restrictedTo && (
    (restrictedTo === '농업/축산' && profileIndustry.includes('농')) ||
    (restrictedTo === '관광/요식' && (profileIndustry.includes('관광') || profileIndustry.includes('요식'))) ||
    (restrictedTo === '건설/부동산' && (profileIndustry.includes('건설') || profileIndustry.includes('부동산'))) ||
    (restrictedTo === '바이오/의료' && (profileIndustry.includes('바이오') || profileIndustry.includes('의료'))) ||
    (restrictedTo === '제조업 전용' && profileIndustry.includes('제조'))
  )

  // 🔄 프로필 키워드 (interested_keywords 우선, fallback으로 업종 키워드 사용)
  const profileKeywords: string[] = profile.interested_keywords && profile.interested_keywords.length > 0
    ? profile.interested_keywords
    : (profile.industry_category && INDUSTRY_KEYWORDS[profile.industry_category]
        ? INDUSTRY_KEYWORDS[profile.industry_category]
        : [])

  if (restrictedTo && !isProfileMatchingRestriction) {
    // 특정 업종 전용인데 내 업종이 아님 → 낮은 점수
    industryScore = 5
    programIndustryReq = `${restrictedTo} 전용`
    industryReason = `⚠️ 이 사업은 "${restrictedTo}" 업종 전용. 귀사(${profileIndustry || '미입력'})와 업종 불일치`
  } else {
    // === STEP 2: 일반 창업/중소기업 지원 사업 판별 (가산점) ===
    const generalStartupKeywords = ['창업', '스타트업', '벤처', '중소기업', '소상공인', '혁신기업', '성장지원', '사업화', 'R&D', '기술개발', '입주', '보육']
    const hasGeneralKeyword = generalStartupKeywords.some(k => programText.includes(k))

    if (hasGeneralKeyword) {
      industryScore = 22
      programIndustryReq = '창업/중소기업 전반'
      industryReason = '창업/중소기업 대상 사업으로 대부분의 업종에서 신청 가능'
    }

    // === STEP 3: 프로필 키워드 매칭 (보너스) ===
    if (profileKeywords.length > 0) {
      matchedKeywords = getMatchedKeywords(rawContent, profileKeywords)

      if (matchedKeywords.length > 0) {
        // 키워드 매칭 성공 → 보너스 점수 (기존 3점 → 4점으로 상향)
        const bonusScore = Math.min(matchedKeywords.length * 4, 12) // 최대 +12점 (기존 +10)
        industryScore = Math.min(30, industryScore + bonusScore)
        programIndustryReq = matchedKeywords.slice(0, 5).join(', ')

        // 키워드 종류에 따라 메시지 차별화
        const keywordSource = profile.interested_keywords?.length > 0 ? '귀사 프로필' : profile.industry_category
        industryReason = `✅ "${matchedKeywords.slice(0, 3).join('", "')}" 키워드 발견. ${keywordSource}과 높은 연관성`
      }
    }

    // === STEP 4: 프로필 텍스트 직접 매칭 (추가 보너스) ===
    if (profileText.length > 10) {
      const profileWords = profileText.split(/\s+/).filter(w => w.length > 2)
      const directMatchedWords = profileWords.filter(word => programText.includes(word) && word.length > 2)
      if (directMatchedWords.length >= 2) {
        industryScore = Math.min(30, industryScore + 3)
        if (!industryReason || !industryReason.includes('✅')) {
          industryReason = `귀사 사업설명의 "${directMatchedWords.slice(0, 2).join('", "')}" 등이 공고 내용과 일치`
        }
      }
    }

    // === STEP 5: 전업종 명시 (만점) ===
    if (programText.includes('전업종') || programText.includes('업종무관') || programText.includes('업종 제한 없')) {
      industryScore = 28
      programIndustryReq = '전업종 (제한없음)'
      industryReason = '✅ 업종 제한 없이 모든 기업이 신청 가능한 사업'
    }
  }

  // 프로필 미입력시
  if (!profile.industry_category) {
    industryScore = Math.max(15, industryScore - 5)
    industryReason = industryReason || '프로필에 업종 정보가 없어 정확한 매칭 불가. 업종 입력시 맞춤 분석 제공'
  }

  breakdown.industry_match = Math.min(30, Math.max(5, industryScore))
  if (industryReason) breakdown.reasons.push(industryReason)

  // 업종 상세 정보 - 🔄 사용된 프로필 키워드 정보 추가
  const keywordInfo = profileKeywords.length > 0
    ? `${profile.industry_category || '미입력'} (키워드: ${profileKeywords.slice(0, 5).join(', ')}${profileKeywords.length > 5 ? '...' : ''})`
    : profile.industry_category || '미입력'

  breakdown.industry_detail = {
    score: breakdown.industry_match,
    max: 30,
    status: getStatus(breakdown.industry_match, 30),
    reason: industryReason,
    profile_value: keywordInfo,
    program_requirement: programIndustryReq,
    matched_keywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,  // 매칭된 키워드
    profile_keywords: profileKeywords.length > 0 ? profileKeywords : undefined,   // 사용된 프로필 키워드
    tips: !profile.interested_keywords?.length && !profile.industry_category
      ? '프로필에서 사업 설명을 입력하면 AI가 키워드를 추출하여 더 정확한 매칭이 가능합니다'
      : undefined
  }

  // 2. 규모 매칭 (20점) - 텍스트 분석 기반
  let scaleScore = 10 // 기본점수
  let scaleReason = ''
  let programScaleReq = '제한 없음'
  let profileScaleValue = ''

  // 프로필 규모 정보 구성
  if (profile.employee_count) {
    profileScaleValue = `직원 ${profile.employee_count}명`
    if (profile.annual_revenue) {
      profileScaleValue += `, 매출 ${profile.annual_revenue}억원`
    }
  } else if (profile.annual_revenue) {
    profileScaleValue = `매출 ${profile.annual_revenue}억원`
  } else {
    profileScaleValue = '미입력'
  }

  // 소상공인/소기업 관련
  if (programText.includes('소상공인') || programText.includes('소기업')) {
    programScaleReq = '소상공인/소기업 (10인 이하)'
    if (profile.employee_count && profile.employee_count <= 10) {
      scaleScore = 20
      scaleReason = `귀사 직원수 ${profile.employee_count}명으로 소상공인 기준(10인 이하) 충족. 신청 가능`
    } else if (!profile.employee_count) {
      scaleScore = 15
      scaleReason = '소상공인/소기업 대상 사업. 직원수 미입력으로 자격 여부 확인 필요'
    } else {
      scaleScore = 8
      scaleReason = `귀사 직원수 ${profile.employee_count}명으로 소상공인 기준(10인 이하) 초과 가능성. 자격 확인 필요`
    }
  }

  // 중소기업 관련
  if (programText.includes('중소기업') || programText.includes('중소벤처')) {
    programScaleReq = '중소기업 (300인 이하)'
    if (profile.employee_count && profile.employee_count <= 300) {
      scaleScore = Math.max(scaleScore, 18)
      scaleReason = `귀사 직원수 ${profile.employee_count}명으로 중소기업 기준(300인 이하) 충족`
    } else if (!profile.employee_count) {
      scaleScore = Math.max(scaleScore, 15)
      scaleReason = '중소기업 대상 사업. 직원수 미입력으로 정확한 자격 확인 필요'
    } else {
      scaleScore = 6
      scaleReason = `귀사 직원수 ${profile.employee_count}명으로 중소기업 기준 초과 가능성 있음`
    }
  }

  // 스타트업 관련
  if (programText.includes('스타트업') || programText.includes('창업기업')) {
    const isStartup = profile.entity_type === '법인' && profile.business_years && profile.business_years <= 7
    programScaleReq = programScaleReq === '제한 없음' ? '스타트업/창업기업 (7년 이하)' : programScaleReq
    if (isStartup) {
      scaleScore = 20
      scaleReason = `귀사 업력 ${profile.business_years}년으로 창업기업 기준(7년 이하) 충족. 스타트업 지원사업 신청 가능`
    } else if (profile.business_years && profile.business_years > 7) {
      scaleScore = Math.max(scaleScore, 8)
      scaleReason = `귀사 업력 ${profile.business_years}년으로 창업기업 기준(7년 이하) 초과. 자격 미달 가능성`
    } else if (!scaleReason) {
      scaleScore = Math.max(scaleScore, 14)
      scaleReason = '스타트업/창업기업 대상 사업. 업력 정보 입력시 정확한 자격 확인 가능'
    }
  }

  if (!scaleReason) {
    scaleReason = '공고에서 특별한 규모 제한을 명시하지 않음. 대부분의 기업 신청 가능'
    if (profileScaleValue === '미입력') {
      scaleReason = '규모 정보 미입력. 직원수/매출액 입력시 정확한 자격 분석 제공'
    }
  }

  breakdown.scale_match = scaleScore

  // 규모 상세 정보
  breakdown.scale_detail = {
    score: scaleScore,
    max: 20,
    status: getStatus(scaleScore, 20),
    reason: scaleReason,
    profile_value: profileScaleValue,
    program_requirement: programScaleReq,
    tips: profileScaleValue === '미입력' ? '직원수, 매출액을 입력하면 더 정확한 매칭이 가능합니다' : undefined
  }

  // 3. 지역 매칭 (15점) - 타이틀 우선 체크 + 본문 분석
  let regionScore = 8 // 기본점수
  let regionReason = ''
  let programRegionReq = '전국'

  // 타이틀에서 지역 먼저 체크 (더 정확함)
  const titleLower = (program.title || '').toLowerCase()

  if (profile.region) {
    const regionKeywords = REGION_KEYWORDS[profile.region] || [profile.region]

    // 1단계: 타이틀에서 먼저 다른 지역 체크 (가장 정확)
    let otherRegionInTitle = ''
    for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
      if (region !== profile.region) {
        // 타이틀에서 [지역명] 형태나 지역명 포함 체크
        const titleHasRegion = keywords.some(k => {
          const kLower = k.toLowerCase()
          // [경남], [대전], 경남기업 등의 패턴
          return titleLower.includes(`[${kLower}]`) ||
                 titleLower.includes(`${kLower}시`) ||
                 titleLower.includes(`${kLower}도`) ||
                 titleLower.includes(`${kLower}군`) ||
                 titleLower.includes(`${kLower}구`) ||
                 titleLower.startsWith(kLower) ||
                 titleLower.includes(` ${kLower} `) ||
                 titleLower.includes(`${kLower}·`) ||
                 titleLower.includes(`·${kLower}`)
        })
        if (titleHasRegion) {
          otherRegionInTitle = region
          break
        }
      }
    }

    if (otherRegionInTitle) {
      // 타이틀에 다른 지역이 명시됨 → 무조건 제외
      regionScore = 0
      programRegionReq = `${otherRegionInTitle} 지역 한정`
      regionReason = `❌ 타이틀에 "${otherRegionInTitle}" 지역 명시. 귀사(${profile.region})는 지역 요건 미충족`
      breakdown.disqualified = true
      breakdown.disqualification_reasons!.push(`지역 제한: ${otherRegionInTitle} 지역만 가능 (귀사: ${profile.region})`)
    } else {
      // 2단계: 내 지역과 매칭 체크
      const matchedRegionKeyword = regionKeywords.find(k => programText.includes(k.toLowerCase()))

      if (matchedRegionKeyword) {
        regionScore = 15
        programRegionReq = `${profile.region} 소재기업 우대`
        regionReason = `공고에서 "${matchedRegionKeyword}" 지역 우대 조건 발견. 귀사(${profile.region}) 소재지와 일치`
      } else if (titleLower.includes('[전국]') || programText.includes('전국') || programText.includes('지역무관')) {
        regionScore = 12
        programRegionReq = '전국 (지역무관)'
        regionReason = '전국 단위 사업으로 지역 제한 없음'
      } else {
        // 3단계: 본문에서 다른 지역 체크
        let otherRegionInContent = ''
        for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
          if (region !== profile.region) {
            const found = keywords.find(k => programText.includes(k.toLowerCase()))
            if (found) {
              otherRegionInContent = region
              break
            }
          }
        }

        if (otherRegionInContent) {
          regionScore = 0
          programRegionReq = `${otherRegionInContent} 지역 한정`
          regionReason = `❌ 본문에 ${otherRegionInContent} 지역 관련 내용. 귀사(${profile.region})는 지역 요건 미충족 가능`
          breakdown.disqualified = true
          breakdown.disqualification_reasons!.push(`지역 제한: ${otherRegionInContent} 지역 (귀사: ${profile.region})`)
        } else {
          regionScore = 12
          programRegionReq = '지역 제한 명시 없음'
          regionReason = '특정 지역 제한 명시 없음. 전국 기업 신청 가능으로 추정'
        }
      }
    }
  } else {
    regionScore = 10
    regionReason = '프로필에 지역 정보 미입력. 지역 입력시 지역 우대 사업 매칭 가능'
  }

  breakdown.region_match = regionScore
  if (regionReason) breakdown.reasons.push(regionReason)

  // 지역 상세 정보
  breakdown.region_detail = {
    score: regionScore,
    max: 15,
    status: getStatus(regionScore, 15),
    reason: regionReason,
    profile_value: profile.region || '미입력',
    program_requirement: programRegionReq,
    tips: !profile.region ? '지역을 선택하면 우대 지원사업을 더 잘 찾을 수 있습니다' : undefined
  }

  // 4. 사업자 유형/창업단계 매칭 (15점)
  let typeScore = 8
  let typeReason = ''
  let programTypeReq = '제한 없음'
  let profileTypeValue = ''

  // 프로필 유형 정보 구성
  const typeComponents = []
  if (profile.entity_type) typeComponents.push(profile.entity_type)
  if (profile.startup_stage) typeComponents.push(profile.startup_stage)
  if (profile.business_years) typeComponents.push(`업력 ${profile.business_years}년`)
  profileTypeValue = typeComponents.length > 0 ? typeComponents.join(', ') : '미입력'

  if (profile.entity_type || profile.startup_stage) {
    // 예비창업자
    if (profile.entity_type === '예비창업자' || profile.startup_stage === '예비창업') {
      const stageKeywords = STAGE_KEYWORDS['예비창업']
      const matchedStageKeyword = stageKeywords.find(k => programText.includes(k.toLowerCase()))
      if (matchedStageKeyword) {
        typeScore = 15
        programTypeReq = '예비창업자 대상'
        typeReason = `공고에서 "${matchedStageKeyword}" 조건 발견. 귀사(예비창업자)에 적합한 사업`
      } else {
        typeScore = 6
        programTypeReq = '기존 사업자 대상 추정'
        typeReason = '예비창업자 관련 키워드 미발견. 이미 사업자등록 완료한 기업 대상 사업으로 추정'
      }
    }
    // 초기창업
    else if (profile.startup_stage === '초기창업' || (profile.business_years && profile.business_years <= 3)) {
      const stageKeywords = STAGE_KEYWORDS['초기창업']
      const matchedStageKeyword = stageKeywords.find(k => programText.includes(k.toLowerCase()))
      if (matchedStageKeyword) {
        typeScore = 15
        programTypeReq = '초기창업 (3년 이내)'
        typeReason = `공고에서 "${matchedStageKeyword}" 조건 발견. 귀사 업력(${profile.business_years || '3년 이내'})이 초기창업 기준에 적합`
      } else {
        typeScore = 12
        programTypeReq = '창업기업 전반'
        typeReason = `초기창업 명시 조건은 없으나 업력 ${profile.business_years || '3'}년 이하로 대부분의 창업지원사업 신청 가능`
      }
    }
    // 성장기
    else if (profile.startup_stage === '성장기' || (profile.business_years && profile.business_years > 3 && profile.business_years <= 7)) {
      const stageKeywords = STAGE_KEYWORDS['성장기']
      const matchedStageKeyword = stageKeywords.find(k => programText.includes(k.toLowerCase()))
      if (matchedStageKeyword) {
        typeScore = 15
        programTypeReq = '성장기 (스케일업)'
        typeReason = `공고에서 "${matchedStageKeyword}" 조건 발견. 귀사 업력(${profile.business_years}년)이 성장기 기업 기준에 적합`
      } else {
        typeScore = 10
        programTypeReq = '중소기업 전반'
        typeReason = `업력 ${profile.business_years}년으로 초기창업 사업 자격 미달 가능. 성장기/일반 중소기업 사업 확인 필요`
      }
    }
    // 성숙기 (7년 초과)
    else if (profile.business_years && profile.business_years > 7) {
      if (programText.includes('글로벌') || programText.includes('해외') || programText.includes('수출')) {
        typeScore = 14
        programTypeReq = '수출/글로벌 진출 기업'
        typeReason = `업력 ${profile.business_years}년의 기업. 글로벌/수출 관련 지원사업에 적합`
      } else {
        typeScore = 8
        programTypeReq = '창업기업 대상 추정'
        typeReason = `업력 ${profile.business_years}년으로 창업초기 지원사업(7년 이내) 자격 미달 가능성. 일반 중소기업 사업 확인 권장`
      }
    }
    // 법인
    if (profile.entity_type === '법인' && (programText.includes('법인') || programText.includes('기업'))) {
      typeScore = Math.max(typeScore, 12)
      if (!typeReason || typeReason.includes('미입력')) {
        typeReason = '법인 사업자로서 대부분의 기업 지원사업 신청 가능'
      }
    }
    // 개인사업자
    if (profile.entity_type === '개인') {
      if (programText.includes('법인') && !programText.includes('개인')) {
        typeScore = Math.min(typeScore, 6)
        programTypeReq = '법인 사업자 대상'
        typeReason = '이 사업은 법인 사업자 대상으로 추정. 개인사업자 신청 불가 가능성 높음'
      }
    }
  } else {
    typeReason = '사업자 유형/창업단계 정보 미입력. 해당 정보 입력시 정확한 자격 분석 가능'
  }

  breakdown.type_match = typeScore
  if (typeReason && !typeReason.includes('미입력')) breakdown.reasons.push(typeReason)

  // 유형 상세 정보
  breakdown.type_detail = {
    score: typeScore,
    max: 15,
    status: getStatus(typeScore, 15),
    reason: typeReason,
    profile_value: profileTypeValue,
    program_requirement: programTypeReq,
    tips: profileTypeValue === '미입력' ? '사업자 유형, 창업단계를 입력하면 맞춤 지원사업을 찾기 쉬워집니다' : undefined
  }

  // 5. 특수 조건 및 우대사항 매칭 (20점)
  let specialScore = 0
  const specialReasons: string[] = []
  const specialDetails: CategoryDetail[] = []

  // 특수조건 체크 헬퍼 (상세 근거 포함)
  const checkSpecialCondition = (
    label: string,
    hasProfile: boolean,
    programHas: boolean,
    points: number,
    profileVal: string,
    progReq: string,
    matchedKeyword?: string
  ) => {
    let status: 'full' | 'partial' | 'low' | 'none' = 'none'
    let score = 0
    let reason = ''

    if (hasProfile && programHas) {
      score = points
      status = 'full'
      reason = matchedKeyword
        ? `공고에서 "${matchedKeyword}" 조건 발견. 귀사가 ${label}에 해당하여 +${points}점 우대 적용`
        : `${label} 조건 충족으로 +${points}점 우대 적용`
    } else if (hasProfile && !programHas) {
      status = 'partial'
      reason = `귀사는 ${label}이나 이 공고는 해당 우대조건 없음`
    } else if (!hasProfile && programHas) {
      status = 'low'
      reason = matchedKeyword
        ? `공고에서 "${matchedKeyword}" 우대 조건 발견. 귀사는 해당 없어 우대점수 미획득`
        : `이 공고는 ${label} 우대가 있으나 귀사는 해당 없음`
    } else {
      return 0 // 둘 다 해당 없으면 표시 안함
    }

    if (score > 0) {
      specialReasons.push(`${label} +${points}점`)
    }

    specialDetails.push({
      score,
      max: points,
      status,
      reason,
      profile_value: profileVal,
      program_requirement: progReq
    })

    return score
  }

  // 청년창업
  // 청년창업 - 패널티 로직 추가
  const youthKeywords = ['청년', '39세', 'youth', '만39세', '청년창업']
  // 제목에 청년 키워드가 있으면 강력한 제약으로 간주
  const titleHasYouth = youthKeywords.some(k => program.title?.includes(k))
  const foundYouthKeyword = youthKeywords.find(k => programText.includes(k.toLowerCase()))

  const youthScore = checkSpecialCondition(
    '청년기업',
    profile.is_youth_startup || false,
    !!foundYouthKeyword,
    6,
    profile.is_youth_startup ? '대표자 만 39세 이하' : '해당 없음',
    foundYouthKeyword ? `${foundYouthKeyword} 우대/제한` : '연령 제한 없음',
    foundYouthKeyword
  )
  specialScore += youthScore

  // 청년 전용 사업인데 청년이 아닌 경우 자격 미달 처리
  if (!profile.is_youth_startup && (titleHasYouth || (foundYouthKeyword && programText.includes('제한')))) {
    breakdown.disqualified = true
    breakdown.disqualification_reasons!.push(`청년 전용 사업 (${foundYouthKeyword} 대상) - 귀사는 연령 요건 미충족`)
    // 점수 대폭 삭감 (다른 매칭 점수가 있어도 추천되지 않도록)
    breakdown.industry_match = 0
    breakdown.scale_match = 0
    breakdown.region_match = 0
    breakdown.type_match = 0
    specialScore = 0
  }


  // 여성기업
  const femaleKeywords = ['여성', '여성기업', '여성창업', 'woman']
  const foundFemaleKeyword = femaleKeywords.find(k => programText.includes(k.toLowerCase()))
  specialScore += checkSpecialCondition(
    '여성기업',
    profile.is_female_owned || false,
    !!foundFemaleKeyword,
    6,
    profile.is_female_owned ? '여성 대표 기업' : '해당 없음',
    foundFemaleKeyword ? `${foundFemaleKeyword} 우대` : '성별 제한 없음',
    foundFemaleKeyword
  )

  // 사회적기업
  const socialKeywords = ['사회적기업', '사회적경제', '소셜벤처', '협동조합']
  const foundSocialKeyword = socialKeywords.find(k => programText.includes(k.toLowerCase()))
  specialScore += checkSpecialCondition(
    '사회적기업',
    profile.is_social_enterprise || false,
    !!foundSocialKeyword,
    6,
    profile.is_social_enterprise ? '사회적기업 인증' : '해당 없음',
    foundSocialKeyword ? `${foundSocialKeyword} 우대` : '제한 없음',
    foundSocialKeyword
  )

  // 벤처인증 - tech_certifications 배열도 체크
  const ventureKeywords = ['벤처', '벤처기업', '이노비즈', 'inno-biz', '벤처인증']
  const foundVentureKeyword = ventureKeywords.find(k => programText.includes(k.toLowerCase()))
  const hasVentureCert = profile.is_venture_certified ||
    (profile.tech_certifications && profile.tech_certifications.some((c: string) =>
      c.includes('벤처') || c.includes('이노비즈')
    ))
  specialScore += checkSpecialCondition(
    '벤처인증',
    hasVentureCert,
    !!foundVentureKeyword,
    5,
    hasVentureCert ? '벤처기업 인증 보유' : '미인증',
    foundVentureKeyword ? `${foundVentureKeyword} 우대` : '인증 불요',
    foundVentureKeyword
  )

  // 기술인증/특허 보유
  const techKeywords = ['특허', '기술인증', '연구소', 'R&D', '기술개발', '지식재산', 'IP']
  const foundTechKeyword = techKeywords.find(k => programText.includes(k.toLowerCase()))
  const hasTechCerts = profile.tech_certifications && profile.tech_certifications.length > 0
  specialScore += checkSpecialCondition(
    '기술/특허',
    hasTechCerts,
    !!foundTechKeyword,
    5,
    hasTechCerts ? `보유: ${profile.tech_certifications.slice(0, 2).join(', ')}` : '없음',
    foundTechKeyword ? `${foundTechKeyword} 우대` : '기술 요건 없음',
    foundTechKeyword
  )

  // 수출/해외진출
  const exportKeywords = ['수출', '해외진출', '글로벌', '해외시장', '수출기업']
  const foundExportKeyword = exportKeywords.find(k => programText.includes(k.toLowerCase()))
  specialScore += checkSpecialCondition(
    '수출기업',
    profile.is_export_business || false,
    !!foundExportKeyword,
    5,
    profile.is_export_business ? '수출/해외사업 진행중' : '내수 위주',
    foundExportKeyword ? `${foundExportKeyword} 우대` : '수출 요건 없음',
    foundExportKeyword
  )

  // 관심 분야 매칭 - 🔄 강화: 카테고리별 키워드 매핑
  if (profile.interested_categories && profile.interested_categories.length > 0) {
    // 관심분야 → 실제 매칭할 키워드 매핑
    const INTEREST_KEYWORDS_MAP: Record<string, string[]> = {
      '자금지원': ['융자', '보증', '대출', '자금', '지원금', '보조금', '출자', '투자'],
      '기술개발': ['R&D', '연구개발', '기술개발', '기술혁신', '연구소', '기술지원', '개발비'],
      'R&D': ['R&D', '연구개발', '기술개발', '과제', '연구소', '기술지원'],
      '사업화': ['사업화', '시제품', '제품화', '양산', '상용화', '제작지원'],
      '판로개척': ['판로', '마케팅', '수출', '해외진출', '판매', '입점', '전시회', '박람회'],
      '인력지원': ['인력', '채용', '고용', '인건비', '일자리', '청년고용'],
      '시설': ['입주', '공간', '센터', '보육', '오피스', '시설', '장비'],
      '교육': ['교육', '멘토링', '컨설팅', '아카데미', '강의', '역량강화'],
    }

    let categoryScore = 0
    const matchedCategories: string[] = []

    for (const cat of profile.interested_categories) {
      // 카테고리에서 키워드 추출 (괄호 안 내용 포함)
      let keywords: string[] = []

      // 매핑된 키워드 찾기
      for (const [key, vals] of Object.entries(INTEREST_KEYWORDS_MAP)) {
        if (cat.includes(key)) {
          keywords = [...keywords, ...vals]
        }
      }

      // 직접 키워드도 추가 (괄호 안 텍스트)
      const bracketMatch = cat.match(/\(([^)]+)\)/)
      if (bracketMatch) {
        keywords = [...keywords, ...bracketMatch[1].split(/[\/,]/)]
      }

      // 프로그램에서 키워드 매칭
      const foundKeyword = keywords.find(k => programText.includes(k.toLowerCase()))
      if (foundKeyword) {
        categoryScore += 5 // 카테고리당 5점 (최대 2개 = 10점)
        matchedCategories.push(`${cat.split('(')[0].trim()}`)
      }
    }

    if (categoryScore > 0) {
      const bonus = Math.min(categoryScore, 10) // 최대 10점
      specialScore += bonus
      specialReasons.push(`관심분야 +${bonus}점`)
      specialDetails.push({
        score: bonus,
        max: 10,
        status: bonus >= 8 ? 'full' : 'partial',
        reason: `✅ 귀사 관심분야 "${matchedCategories.join(', ')}"와 높은 연관성`,
        profile_value: profile.interested_categories.join(', '),
        program_requirement: matchedCategories.join(', ')
      })
    } else {
      specialDetails.push({
        score: 0,
        max: 10,
        status: 'low',
        reason: `귀사 관심분야(${profile.interested_categories.slice(0, 2).join(', ')})가 이 공고 내용에서 발견되지 않음`,
        profile_value: profile.interested_categories.join(', '),
        program_requirement: '관련 분야 없음'
      })
    }
  }

  // 지원유형 매칭
  if (profile.preferred_support_types && profile.preferred_support_types.length > 0 && program.support_type) {
    const typeMatched = profile.preferred_support_types.includes(program.support_type)
    if (typeMatched) {
      specialScore += 4
      specialReasons.push(`지원유형 +4점`)
      specialDetails.push({
        score: 4,
        max: 4,
        status: 'full',
        reason: `이 공고의 지원유형 "${program.support_type}"이 귀사 선호유형과 일치하여 +4점`,
        profile_value: profile.preferred_support_types.join(', '),
        program_requirement: program.support_type
      })
    } else {
      specialDetails.push({
        score: 0,
        max: 4,
        status: 'low',
        reason: `이 공고의 지원유형 "${program.support_type}"이 귀사 선호유형(${profile.preferred_support_types.slice(0, 2).join(', ')})과 불일치`,
        profile_value: profile.preferred_support_types.join(', '),
        program_requirement: program.support_type
      })
    }
  }

  breakdown.special_match = Math.min(20, specialScore)
  breakdown.reasons.push(...specialReasons)
  breakdown.special_details = specialDetails.filter(d => d.status !== 'none' || d.score > 0)

  // ❌ 업종 불일치 패널티 제거 - 이제 제한 기반 필터링으로 대체됨
  // (업종 제한이 명시된 사업만 낮은 점수를 받음, 일반 사업은 높은 기본점수 유지)

  // 종합 의견 생성
  let finalScore = breakdown.industry_match + breakdown.scale_match +
    breakdown.region_match + breakdown.type_match + breakdown.special_match

  // 강점/약점 분석
  const strengths: string[] = []
  const weaknesses: string[] = []

  if (breakdown.industry_detail?.status === 'full' || breakdown.industry_match >= 25) {
    strengths.push('업종 적합성 우수')
  } else if (breakdown.industry_match < 15) {
    weaknesses.push('업종 관련성 낮음')
  }

  if (breakdown.scale_detail?.status === 'full' || breakdown.scale_match >= 18) {
    strengths.push('규모 조건 충족')
  } else if (breakdown.scale_match < 10) {
    weaknesses.push('규모 요건 미달 가능')
  }

  if (breakdown.region_detail?.status === 'full' || breakdown.region_match >= 13) {
    strengths.push('지역 우대 적용')
  }

  if (breakdown.type_detail?.status === 'full' || breakdown.type_match >= 13) {
    strengths.push('창업단계 적합')
  } else if (breakdown.type_match < 8) {
    weaknesses.push('사업자유형 조건 확인 필요')
  }

  if (breakdown.special_match >= 10) {
    strengths.push('특별 우대 조건 충족')
  }

  // 종합 의견 텍스트 생성 (Premium Narrative Logic)
  let summaryText = ''

  // 1. [What] 지원사업의 성격 규명 (정확도 개선)
  const supportTypeMap: Record<string, string> = {
    '금융': '운영/시설 자금 융자 및 보증을 지원하는',
    '기술개발': 'R&D 및 기술개발 비용을 지원하는',
    '사업화': '시제품 제작 및 사업 고도화 자금을 지원하는',
    '시설': '창업 공간 입주 및 보육을 지원하는',
    '인력': '신규 인력 채용 인건비를 지원하는',
    '판로': '마케팅 및 국내외 판로 개척을 돕는',
    '수출': '해외 시장 진출 및 수출 제반 비용을 지원하는',
    '교육': '실무 역량 강화 교육 및 멘토링을 제공하는',
    '행사': '네트워킹 및 전시회 참가를 지원하는'
  }

  // 제목 및 본문 기반 정밀 분석
  let programNature = '';
  const fullText = (program.title + ' ' + (program.content || '')).replace(/\s+/g, ' ');

  if (program.title?.includes('입주') || program.title?.includes('공간') || program.title?.includes('센터') || program.title?.includes('보육')) {
    programNature = '입주 공간 및 보육 프로그램을 제공하는';
  } else if (program.title?.includes('융자') || program.title?.includes('보증') || program.title?.includes('대출')) {
    programNature = '저금리 융자 및 보증을 지원하는';
  } else if (program.title?.includes('교육') || program.title?.includes('멘토링') || program.title?.includes('아카데미')) {
    programNature = '체계적인 교육과 멘토링을 제공하는';
  } else if (fullText.includes('시제품') || fullText.includes('제작')) {
    programNature = '시제품 제작 및 사업화 자금을 지원하는';
  } else if (program.title?.includes('마케팅') || fullText.includes('판로')) {
    programNature = '마케팅 비용 및 판로 개척을 지원하는';
  } else if (program.support_type && supportTypeMap[program.support_type]) {
    programNature = supportTypeMap[program.support_type];
  } else {
    programNature = '기업의 성장을 다각도로 지원하는';
  }

  // 2. [Why] 핵심 매칭 포인트 문장화
  // 상위 3개 포인트 추출
  const keyPoints = [
    { label: '업종', score: breakdown.industry_match, reason: breakdown.industry_detail?.reason, weight: 3 },
    { label: '규모', score: breakdown.scale_match, reason: breakdown.scale_detail?.reason, weight: 2 },
    { label: '지역', score: breakdown.region_match, reason: breakdown.region_detail?.reason, weight: 2 },
    { label: '우대', score: breakdown.special_match, reason: specialReasons.join(', '), weight: 3 } // 우대사항 가중치 높임
  ]
    .filter(p => p.score >= 10 && p.reason && !p.reason.includes('미입력'))
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight)) // 가중치 적용 정렬

  let matchNarrative = '';
  if (keyPoints.length > 0) {
    const bestPoint = keyPoints[0];
    // 구체적인 이유를 자연스럽게 연결
    if (bestPoint.label === '우대') {
      matchNarrative = `특히 **${bestPoint.reason}** 등의 우대 요건을 갖추고 있어 선정 확률이 매우 높으며`;
    } else if (bestPoint.label === '업종') {
      matchNarrative = `귀사의 주요 업종인 **${profile.industry_category}** 분야를 대상으로 하여 적합성이 뛰어나며`;
    } else if (bestPoint.label === '지역') {
      matchNarrative = `**${profile.region}** 지역 기업을 우대하는 사업으로 지역 할당 혜택을 기대할 수 있으며`;
    } else {
      matchNarrative = `귀사의 현재 기업 규모와 업력에 최적화된 사업이며`;
    }
  } else {
    // Fallback narrative if detailed points are missing
    matchNarrative = `전반적인 지원 요건이 귀사의 **${profile.industry_category || '업종'}** 및 기업 현황과 잘 부합하며`;
    // Force populate reasons if empty
    if (breakdown.reasons.length === 0) {
      breakdown.reasons.push(`✅ ${program.category || '일반'} 분야 적합`);
      breakdown.reasons.push(`✅ 기본 자격 요건 충족`);
    }
  }

  // 3. [Benefit/Action] 최종 제안 생성 + [Amount/Scale] 지원 규모 추출
  // 금액 또는 선발 규모 추출 (Regex 개선)
  let extractedBenefit = program.support_amount;
  let benefitType = 'money'; // money | count | space

  const fullTextForBenefit = (program.title + ' ' + (program.content || '')).replace(/\s+/g, ' ');

  if (!extractedBenefit) {
    // 1. 금액 찾기 (더 강력한 Regex: 접두어 없이도 '0000원' '0억' 등을 포착하되, 날짜 등 오탐지 주의)
    // "최대", "지원", "금액" 뒤에 나오거나, 혹은 "000,000원" "0억원" 패턴을 직접 찾음 (단, 공고일자 등 제외)
    const specificAmountRegex = /(?:최대|지원|한도|규모|총)\s?(:?금액|예산)?\s?(\d+(?:,\d+)?(?:억|천|백|십)?(?:만)?원)/;
    const looseAmountRegex = /(\d+(?:,\d+)?(?:억|천|백)?(?:만)?원)/;

    const specificMatch = fullTextForBenefit.match(specificAmountRegex);
    const looseMatch = fullTextForBenefit.match(looseAmountRegex);

    if (specificMatch) {
      extractedBenefit = specificMatch[2];
      benefitType = 'money';
    } else if (looseMatch) {
      extractedBenefit = looseMatch[1];
      benefitType = 'money';
    } else {
      // 2. 입주 공간 등의 경우 (00개실, 00평)
      const spaceRegex = /(\d+(?:개실|평|m2|호실))/;
      const spaceMatch = fullTextForBenefit.match(spaceRegex);
      if (spaceMatch) {
        extractedBenefit = spaceMatch[1];
        benefitType = 'space';
      }
      else {
        // 3. 선발 규모 찾기 (00개사, 00팀, 00명)
        const countRegex = /(\d+(?:명|개사|팀|업체))(?:\s(?:내외|선발|모집))?/;
        const countMatch = fullTextForBenefit.match(countRegex);
        if (countMatch) {
          extractedBenefit = countMatch[1];
          benefitType = 'count';
        }
      }
    }
  }

  let benefitNarrative = '';
  if (extractedBenefit) {
    if (benefitType === 'money') {
      benefitNarrative = ` **최대 ${extractedBenefit}**의 자금을 지원하며,`;
    } else if (benefitType === 'space') {
      benefitNarrative = ` **${extractedBenefit}** 규모의 입주 공간을 제공하며,`;
    } else {
      benefitNarrative = ` 총 **${extractedBenefit}** 규모로 선발하며,`;
    }
  } else if (programNature.includes('입주') || programNature.includes('공간')) {
    // 금액/규모를 못 찾았지만 입주 사업인 경우
    benefitNarrative = ` **독립형 입주 공간**을 지원하며,`;
    extractedBenefit = '독립 사무공간';
    benefitType = 'space';
  }

  if (finalScore >= 80) {
    summaryText = `이 사업은 ${program.organization || '정부/지자체'}에서 주관하여 ${programNature}입니다.${benefitNarrative} ${matchNarrative}, ${keyPoints[1] ? keyPoints[1].reason + ' 또한 강점입니다.' : '다른 자격 요건도 충족합니다.'} 놓치지 말고 신청하시기를 강력 추천합니다.`;
  } else if (finalScore >= 65) {
    summaryText = `이 사업은 ${programNature}입니다.${benefitNarrative} ${matchNarrative} 전반적인 지원 자격을 충족하고 있습니다. 상세 요건을 확인 후 신청 준비를 하시는 것이 좋겠습니다.`;
  } else if (finalScore >= 50) {
    summaryText = `신청을 고려해볼 만한 사업입니다.${benefitNarrative} ${matchNarrative} ${keyPoints.length > 0 ? keyPoints[0].reason : '기본적인 자격 요건은 충족'}하지만, ${weaknesses.length > 0 ? weaknesses[0] + ' 등 일부 조건에 대한 확인이 필요합니다.' : '세부 요건을 꼼꼼히 따져보아야 합니다.'}`;
  } else {
    // 탈락/비추천 인 경우에도 어떤 사업인지는 설명
    summaryText = `이 사업은 ${programNature}이나, 귀사의 현황과 맞지 않아 적합성이 낮습니다. ${weaknesses.length > 0 ? weaknesses.join(', ') : '주요 자격 요건이 맞지 않을 수 있습니다.'} 다른 지원사업을 우선적으로 검토하시기 바랍니다.`;
  }



  // Breakdown Reasons 업데이트 (UI 표시용)
  // 중복 제거 및 포맷팅
  const existingReasons = new Set(breakdown.reasons);

  // 금액/규모 정보가 있으면 최상단 강조
  if (extractedBenefit && !breakdown.reasons.some(r => r.includes(extractedBenefit!))) {
    let icon = '💰';
    let label = '지원규모';

    if (benefitType === 'money') { icon = '💰'; label = '지원금'; }
    else if (benefitType === 'space') { icon = '🏢'; label = '입주공간'; }
    else { icon = '👥'; label = '선발규모'; }

    breakdown.reasons.unshift(`${icon} ${label}: ${extractedBenefit}`);
  }

  if (keyPoints.length > 0 && !breakdown.reasons.some(r => r.includes(keyPoints[0].label))) {
    // 상위 매칭 포인트가 리스트에 없으면 추가
    if (keyPoints[0].reason) breakdown.reasons.push(`✅ ${keyPoints[0].label} 적합: ${keyPoints[0].reason}`);
  }



  // 최종 체크: 자격 미달(Disqualified)인 경우 점수 초기화
  if (breakdown.disqualified) {
    breakdown.industry_match = 0
    breakdown.scale_match = 0
    breakdown.region_match = 0
    breakdown.type_match = 0
    breakdown.special_match = 0
    // 요약문도 "자격 미달"로 강제 변경
    breakdown.summary = `지원 자격 미달입니다. ${breakdown.disqualification_reasons?.join(', ') || '필수 자격 요건을 충족하지 않습니다.'} 상세 요건을 다시 한번 확인하시기 바랍니다.`
  } else {
    breakdown.summary = summaryText
  }

  return breakdown
}

/**
 * GET: 프로필 기반 맞춤 프로그램 매칭
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    // 기본 최소 점수 50: 50점 이상은 "검토 가치 있음"으로 보여줌
    const minScore = parseInt(searchParams.get('min_score') || '50')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    // 기본값 false: 진행중 + 예정 공고 모두 표시 (사용자가 준비할 수 있도록)
    const activeOnly = searchParams.get('active_only') === 'true'
    // 예정 공고 포함 옵션 (기본 true)
    const includeUpcoming = searchParams.get('include_upcoming') !== 'false'

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '프로필을 먼저 생성해주세요.',
        redirect: '/dashboard-group/company/government-programs/profile'
      }, { status: 400 })
    }

    // 프로그램 조회 (데모 제외)
    const today = new Date().toISOString().split('T')[0]
    // 예정 공고 포함 시 향후 365일 이내 시작하는 공고까지 포함 (1년)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 365)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    let programsQuery = adminSupabase
      .from('government_programs')
      .select('*')
      .or('archived.is.null,archived.eq.false')
      .not('title', 'ilike', '%데모%')
      .not('title', 'ilike', '%테스트%')

    if (activeOnly) {
      // 진행중인 공고만
      programsQuery = programsQuery
        .lte('apply_start_date', today)
        .gte('apply_end_date', today)
    } else if (includeUpcoming) {
      // 진행중 + 예정 공고 (마감된 것 제외)
      // apply_end_date가 오늘 이후이거나 NULL인 경우
      // apply_start_date가 60일 이내인 경우
      programsQuery = programsQuery
        .or(`apply_end_date.gte.${today},apply_end_date.is.null`)
        .lte('apply_start_date', futureDateStr)
    }

    const { data: programs, error: programsError } = await programsQuery

    if (programsError) {
      throw programsError
    }

    // 각 프로그램에 대해 적합도 계산
    const matchedPrograms: MatchedProgram[] = []

    for (const program of programs || []) {
      const fitBreakdown = calculateFitScore(profile, program)
      const fitScore =
        fitBreakdown.industry_match +
        fitBreakdown.scale_match +
        fitBreakdown.region_match +
        fitBreakdown.type_match +
        fitBreakdown.special_match

      // 자격 미달(disqualified) 프로그램은 점수와 무관하게 제외
      if (fitBreakdown.disqualified) {
        continue
      }

      // 점수 필터링
      if (fitScore >= minScore) {
        matchedPrograms.push({
          program,
          fit_score: fitScore,
          fit_breakdown: fitBreakdown
        })
      }
    }

    // 적합도 순으로 정렬
    matchedPrograms.sort((a, b) => b.fit_score - a.fit_score)

    // AI 분석 옵션
    const useAI = searchParams.get('ai') === 'true'
    const aiLimit = parseInt(searchParams.get('ai_limit') || '5') // 상위 N개만 AI 분석
    const skipCache = searchParams.get('skip_cache') === 'true'  // 캐시 무시 옵션

    // 🧠 상위 매칭에 AI 분석 적용 (캐싱 포함)
    let creditsUsed = 0
    let creditsRemaining = 0

    if (useAI && matchedPrograms.length > 0) {
      const topMatches = matchedPrograms.slice(0, Math.min(aiLimit, matchedPrograms.length))
      const profileHash = generateProfileHash(profile)

      // 💰 크레딧 확인 (AI 매칭 1회 = 50 크레딧)
      const matchingCredits = CREDIT_PRICING.matching || 50
      const creditCheck = await checkCredits(user.id, matchingCredits)

      if (!creditCheck.canUse) {
        return NextResponse.json({
          error: '크레딧이 부족합니다',
          code: 'INSUFFICIENT_CREDITS',
          required: matchingCredits,
          balance: creditCheck.balance + creditCheck.dailyBalance,
          tier: creditCheck.tier,
        }, { status: 402 })
      }

      console.log(`[AI Analysis] Starting analysis for ${topMatches.length} programs (cache: ${skipCache ? 'disabled' : 'enabled'})`)

      // 순차적으로 AI 분석 실행 (캐시 확인 포함)
      const aiResults: (AIAnalysisResult | null)[] = []
      let cacheHits = 0
      let apiCalls = 0

      for (let i = 0; i < topMatches.length; i++) {
        const program = topMatches[i].program
        console.log(`[AI Analysis] ${i + 1}/${topMatches.length}: ${program.title?.slice(0, 40)}`)

        let result: AIAnalysisResult | null = null

        // 1. 캐시 확인 (skip_cache가 아닌 경우)
        if (!skipCache) {
          result = await getCachedAIResult(adminSupabase, user.id, program.id, profileHash)
          if (result) {
            cacheHits++
            console.log(`[AI Analysis] Result ${i + 1}: CACHE HIT`)
          }
        }

        // 2. 캐시 미스 → API 호출
        if (!result) {
          result = await analyzeWithAI(profile, program)
          if (result) {
            apiCalls++
            // 성공한 결과는 캐시에 저장
            await cacheAIResult(adminSupabase, user.id, program.id, profileHash, result)
            console.log(`[AI Analysis] Result ${i + 1}: API CALL → saved to cache`)
          } else {
            console.log(`[AI Analysis] Result ${i + 1}: FAILED`)
          }
        }

        aiResults.push(result)

        // API 호출 후 딜레이 (캐시 히트면 딜레이 불필요)
        if (!result || apiCalls > 0) {
          if (i < topMatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }
      }

      // 💰 API 호출한 만큼만 크레딧 차감 (캐시 히트는 무료)
      if (apiCalls > 0) {
        const chargeResult = await deductCredits(user.id, matchingCredits, {
          type: 'usage',
          category: 'matching',
          description: `AI 매칭 분석 (${apiCalls}개 프로그램)`,
          model: MODEL_VERSION,
        })
        creditsUsed = matchingCredits
        creditsRemaining = chargeResult.balance
        console.log(`[AI Analysis] Credits charged: ${matchingCredits}, remaining: ${creditsRemaining}`)
      }

      console.log(`[AI Analysis] Complete: ${cacheHits} cache hits, ${apiCalls} API calls`)

      // AI 분석 결과 적용
      for (let i = 0; i < topMatches.length; i++) {
        if (aiResults[i]) {
          topMatches[i].ai_analysis = aiResults[i]
          // AI 점수를 반영 (가중 평균)
          const aiScore = aiResults[i]!.fit_score
          const ruleScore = topMatches[i].fit_score
          // AI 점수 70%, 규칙 점수 30%
          topMatches[i].fit_score = Math.round(aiScore * 0.7 + ruleScore * 0.3)
          // AI 분석 summary를 breakdown에 반영
          topMatches[i].fit_breakdown.summary = aiResults[i]!.summary
          topMatches[i].fit_breakdown.reasons = [
            ...aiResults[i]!.strategic_reasons.map(r => `🎯 ${r}`),
            ...(aiResults[i]!.concerns.length > 0 ? [`⚠️ ${aiResults[i]!.concerns[0]}`] : [])
          ]
        }
      }

      // AI 점수 기준 재정렬
      matchedPrograms.sort((a, b) => b.fit_score - a.fit_score)
    }

    // 페이지네이션 적용
    const paginatedResults = matchedPrograms.slice(offset, offset + limit)
    const totalMatched = matchedPrograms.length

    // AI 캐시 통계 (응답에 포함)
    const aiStats = useAI ? {
      enabled: true,
      analyzed_count: Math.min(aiLimit, matchedPrograms.length),
      cache_enabled: !skipCache
    } : { enabled: false }

    return NextResponse.json({
      success: true,
      matches: paginatedResults,
      pagination: {
        total: totalMatched,
        offset,
        limit,
        has_more: offset + limit < totalMatched
      },
      profile_completeness: profile.profile_completeness || 0,
      ai: aiStats,
      message: totalMatched > 0
        ? `${totalMatched}개의 맞춤 지원사업을 찾았습니다.${useAI ? ' (AI 분석 적용)' : ''}`
        : '조건에 맞는 지원사업이 없습니다. 프로필을 업데이트해보세요.'
    })

  } catch (error: any) {
    console.error('[ProgramMatch] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '매칭 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST: 특정 프로그램에 대한 적합도 분석
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { program_id } = await request.json()

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '프로필을 먼저 생성해주세요.'
      }, { status: 400 })
    }

    // 프로그램 조회
    const { data: program, error: programError } = await adminSupabase
      .from('government_programs')
      .select('*')
      .eq('id', program_id)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 적합도 계산
    const fitBreakdown = calculateFitScore(profile, program)
    const fitScore =
      fitBreakdown.industry_match +
      fitBreakdown.scale_match +
      fitBreakdown.region_match +
      fitBreakdown.type_match +
      fitBreakdown.special_match

    // 신청 기록 저장 또는 업데이트 (관심 표시)
    const { data: application, error: appError } = await adminSupabase
      .from('program_applications')
      .upsert({
        user_id: user.id,
        program_id: program_id,
        company_id: profile.company_id,
        fit_score: fitScore,
        fit_reasons: fitBreakdown,
        status: 'interested'
      }, {
        onConflict: 'user_id,program_id'
      })
      .select()
      .single()

    if (appError) {
      console.error('[ProgramMatch] Application save error:', appError)
      // 저장 실패해도 분석 결과는 반환
    }

    // 적합도 레벨 결정
    let fitLevel: 'high' | 'medium' | 'low'
    let fitMessage: string

    if (fitScore >= 70) {
      fitLevel = 'high'
      fitMessage = '이 지원사업은 귀사에 매우 적합합니다!'
    } else if (fitScore >= 50) {
      fitLevel = 'medium'
      fitMessage = '이 지원사업은 귀사에 적합할 수 있습니다.'
    } else {
      fitLevel = 'low'
      fitMessage = '이 지원사업은 조건이 맞지 않을 수 있습니다.'
    }

    // 개선 제안 생성
    const suggestions: string[] = []

    if (fitBreakdown.industry_match < 20) {
      suggestions.push('프로필의 업종 정보를 업데이트하면 더 정확한 매칭이 가능합니다.')
    }
    if (fitBreakdown.scale_match < 15) {
      suggestions.push('매출/직원 수 정보를 입력하면 규모 조건을 확인할 수 있습니다.')
    }
    if (fitBreakdown.region_match < 10) {
      suggestions.push('지역 정보를 확인하고 업데이트해보세요.')
    }
    if (fitBreakdown.special_match < 10 && profile.profile_completeness < 80) {
      suggestions.push('특수 조건 (청년/여성/사회적기업 등)을 입력하면 우대 사업을 찾을 수 있습니다.')
    }

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        title: program.title,
        organization: program.organization,
        apply_end_date: program.apply_end_date,
        link: program.link
      },
      fit_analysis: {
        score: fitScore,
        level: fitLevel,
        message: fitMessage,
        breakdown: {
          industry: { score: fitBreakdown.industry_match, max: 30 },
          scale: { score: fitBreakdown.scale_match, max: 20 },
          region: { score: fitBreakdown.region_match, max: 15 },
          type: { score: fitBreakdown.type_match, max: 15 },
          special: { score: fitBreakdown.special_match, max: 20 }
        },
        reasons: fitBreakdown.reasons,
        suggestions
      },
      application_id: application?.id
    })

  } catch (error: any) {
    console.error('[ProgramMatch] POST Error:', error)
    return NextResponse.json(
      { error: error.message || '분석 실패' },
      { status: 500 }
    )
  }
}
