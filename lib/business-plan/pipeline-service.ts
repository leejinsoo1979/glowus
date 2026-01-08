// @ts-nocheck
// =====================================================
// 사업계획서 자동생성 파이프라인 서비스
// =====================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini AI 클라이언트
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const getGeminiModel = () => genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
import {
  BusinessPlan,
  BusinessPlanSection,
  BusinessPlanTemplate,
  CompanyFactCard,
  PlanQuestion,
  PipelineStage,
  PipelineExecutionLog,
  PipelineProgress,
  PIPELINE_STAGES,
  TemplateSection,
  ValidationMessage,
  FactCategory
} from './types'

// Gemini AI 사용 (OpenAI 대체)

// =====================================================
// Stage 0: 데이터 충족도 체크 & 인터뷰 모드
// =====================================================

/**
 * 회사 데이터 충족도 체크
 * 각 섹션별로 필요한 데이터가 얼마나 있는지 분석
 */
export async function checkDataSufficiency(
  companyId: string,
  templateSections: TemplateSection[]
): Promise<{
  sufficient: boolean
  overallScore: number
  sectionScores: { sectionId: string; title: string; score: number; missingData: string[] }[]
  requiredQuestions: { category: string; question: string; priority: number }[]
}> {
  const supabase = createAdminClient()

  // 기존 팩트카드 조회
  const { data: facts } = await supabase
    .from('company_fact_cards')
    .select('*')
    .eq('company_id', companyId)

  // 회사 프로필 조회
  const { data: profile } = await supabase
    .from('company_support_profiles')
    .select('*')
    .eq('company_id', companyId)
    .single()

  const sectionScores: { sectionId: string; title: string; score: number; missingData: string[] }[] = []
  const requiredQuestions: { category: string; question: string; priority: number }[] = []

  // 섹션별 필요 데이터 매핑
  const sectionDataRequirements: Record<string, { categories: FactCategory[]; essentialKeys: string[] }> = {
    '사업 개요': {
      categories: ['company_info', 'product'],
      essentialKeys: ['business_description', 'main_products', 'company_name']
    },
    '기술 현황': {
      categories: ['technology', 'intellectual_property'],
      essentialKeys: ['core_technologies', 'tech_differentiation']
    },
    '사업화 전략': {
      categories: ['market', 'plan'],
      essentialKeys: ['target_market', 'business_model', 'revenue_model']
    },
    '시장 분석': {
      categories: ['market'],
      essentialKeys: ['market_size', 'competitors', 'market_trend']
    },
    '팀 구성': {
      categories: ['team'],
      essentialKeys: ['ceo_experience', 'team_expertise', 'employee_count']
    },
    '재무 현황': {
      categories: ['finance'],
      essentialKeys: ['annual_revenue', 'investment_history']
    },
    '추진 일정': {
      categories: ['plan'],
      essentialKeys: ['development_timeline', 'milestones']
    },
    '기대 효과': {
      categories: ['achievement', 'plan'],
      essentialKeys: ['expected_outcomes', 'social_impact']
    }
  }

  // 인터뷰 질문 템플릿
  const interviewQuestionTemplates: Record<string, { question: string; priority: number }[]> = {
    company_info: [
      { question: '회사가 해결하고자 하는 핵심 문제(Pain Point)는 무엇인가요?', priority: 1 },
      { question: '주요 제품/서비스를 한 문장으로 설명해주세요.', priority: 1 },
      { question: '타 경쟁사 대비 우리만의 차별점은 무엇인가요?', priority: 1 },
    ],
    technology: [
      { question: '핵심 기술의 원리를 간단히 설명해주세요.', priority: 1 },
      { question: '보유 특허나 지식재산권이 있나요? (있다면 내용)', priority: 2 },
      { question: '기술 개발 현황은 어느 단계인가요? (아이디어/프로토타입/MVP/상용화)', priority: 1 },
    ],
    market: [
      { question: '목표 고객(타겟 시장)은 누구인가요?', priority: 1 },
      { question: '시장 규모는 대략 어느 정도로 추정하나요?', priority: 2 },
      { question: '주요 경쟁사는 어디인가요?', priority: 2 },
    ],
    team: [
      { question: '대표자의 관련 경력/경험을 알려주세요.', priority: 1 },
      { question: '핵심 팀원들의 전문성은 무엇인가요?', priority: 2 },
    ],
    finance: [
      { question: '현재 매출이 있나요? (있다면 규모)', priority: 2 },
      { question: '투자 유치 이력이 있나요?', priority: 3 },
    ],
    plan: [
      { question: '향후 1년간 주요 목표는 무엇인가요?', priority: 1 },
      { question: '수익 모델은 무엇인가요?', priority: 1 },
    ],
    achievement: [
      { question: '지금까지의 주요 성과가 있나요? (고객 수, 수상, 인증 등)', priority: 2 },
    ]
  }

  // 각 섹션별 데이터 충족도 계산
  for (const section of templateSections) {
    const requirements = sectionDataRequirements[section.title] || { categories: ['company_info'], essentialKeys: [] }
    const relevantFacts = facts?.filter(f => requirements.categories.includes(f.category as FactCategory)) || []
    const missingData: string[] = []

    // 필수 키 체크
    for (const key of requirements.essentialKeys) {
      const hasKey = relevantFacts.some(f => f.fact_key === key && f.fact_value)
      if (!hasKey) {
        missingData.push(key)
      }
    }

    // 점수 계산 (0-100)
    const totalRequired = requirements.essentialKeys.length || 1
    const found = totalRequired - missingData.length
    const score = Math.round((found / totalRequired) * 100)

    sectionScores.push({
      sectionId: section.section_id,
      title: section.title,
      score,
      missingData
    })

    // 부족한 카테고리에 대해 질문 추가
    if (score < 50) {
      for (const category of requirements.categories) {
        const questions = interviewQuestionTemplates[category] || []
        for (const q of questions) {
          // 중복 방지
          if (!requiredQuestions.some(rq => rq.question === q.question)) {
            requiredQuestions.push({ category, ...q })
          }
        }
      }
    }
  }

  // 전체 점수 계산
  const overallScore = sectionScores.length > 0
    ? Math.round(sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length)
    : 0

  // 프로필 데이터로 보정
  if (profile?.business_description) overallScore + 10
  if (profile?.main_products) overallScore + 10
  if (profile?.core_technologies) overallScore + 10

  // 충족 여부 (50% 이상이면 충족)
  const sufficient = overallScore >= 50

  // 우선순위로 정렬
  requiredQuestions.sort((a, b) => a.priority - b.priority)

  return {
    sufficient,
    overallScore: Math.min(overallScore, 100),
    sectionScores,
    requiredQuestions: requiredQuestions.slice(0, 15) // 최대 15개 질문
  }
}

/**
 * 인터뷰 모드: AI가 맞춤형 질문 생성 (기본)
 */
export async function generateInterviewQuestions(
  companyId: string,
  planId: string,
  templateSections: TemplateSection[]
): Promise<PlanQuestion[]> {
  const supabase = createAdminClient()

  // 데이터 충족도 체크
  const sufficiency = await checkDataSufficiency(companyId, templateSections)

  if (sufficiency.sufficient) {
    return [] // 데이터 충분하면 질문 불필요
  }

  // AI로 맞춤형 질문 생성 (Gemini 2.5 Flash)
  const model = getGeminiModel()
  const aiResult = await model.generateContent(`당신은 정부지원사업 사업계획서 컨설턴트입니다.

다음 상황에서 사업계획서 작성을 위해 사용자에게 물어볼 핵심 질문들을 생성해주세요.

[현재 데이터 충족도]
전체 점수: ${sufficiency.overallScore}%

[섹션별 부족 현황]
${sufficiency.sectionScores.map(s => `- ${s.title}: ${s.score}% (부족: ${s.missingData.join(', ') || '없음'})`).join('\n')}

[작성해야 할 섹션]
${templateSections.map(s => `- ${s.title}: ${s.guidelines || '일반 작성'}`).join('\n')}

질문 생성 원칙:
1. 사용자가 쉽게 답할 수 있는 구체적인 질문
2. 답변을 바로 사업계획서에 활용할 수 있어야 함
3. 정량적 데이터를 얻을 수 있는 질문 포함
4. 우선순위: 사업 개요 > 기술 > 시장 > 팀 > 재무

JSON 형식으로 응답:
[
  {
    "question": "질문 내용",
    "category": "company_info|technology|market|team|finance|plan|achievement",
    "fact_key": "저장할 팩트카드 키",
    "priority": 1,
    "hint": "답변 예시나 힌트"
  }
]

최대 10개의 핵심 질문만 생성하세요.`)

  const responseText = aiResult.response.text() || ''
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)

  if (!jsonMatch) {
    // AI 생성 실패 시 기본 질문 사용
    const defaultQuestions = sufficiency.requiredQuestions.slice(0, 10)
    const questions = defaultQuestions.map((q, i) => ({
      plan_id: planId,
      question_text: q.question,
      question_type: 'text' as const,
      context: `[${q.category}] 이 정보는 사업계획서 작성에 필수입니다.`,
      priority: q.priority as 1 | 2 | 3 | 4 | 5,
      is_required: q.priority === 1,
      status: 'pending' as const
    }))

    const { data: insertedQuestions } = await supabase
      .from('plan_questions')
      .insert(questions)
      .select()

    return insertedQuestions as PlanQuestion[]
  }

  const aiQuestions = JSON.parse(jsonMatch[0])

  // 질문 저장
  const questionsToInsert = aiQuestions.map((q: any) => ({
    plan_id: planId,
    question_text: q.question,
    question_type: 'text',
    context: q.hint ? `힌트: ${q.hint}` : `[${q.category}] 사업계획서 작성에 필요한 정보입니다.`,
    priority: Math.min(q.priority || 2, 5),
    is_required: (q.priority || 2) <= 2,
    status: 'pending'
  }))

  const { data: insertedQuestions } = await supabase
    .from('plan_questions')
    .insert(questionsToInsert)
    .select()

  // 플랜 상태 업데이트 - 인터뷰 모드로 전환
  await supabase
    .from('business_plans')
    .update({
      pipeline_stage: 0,
      pipeline_status: 'collecting'
    })
    .eq('id', planId)

  return insertedQuestions as PlanQuestion[]
}

// =====================================================
// 🆕 양식 기반 완벽한 인터뷰 시스템
// =====================================================

/**
 * 양식 기반 섹션별 질문 생성
 * 각 섹션을 완벽하게 채우기 위한 맞춤형 질문 생성
 */
export async function generateTemplateDrivenQuestions(
  planId: string,
  options?: {
    skipExistingData?: boolean  // 기존 데이터가 있는 섹션 스킵
    maxQuestionsPerSection?: number  // 섹션당 최대 질문 수
  }
): Promise<{
  success: boolean
  template: BusinessPlanTemplate | null
  questionsBySection: {
    sectionId: string
    sectionTitle: string
    questions: PlanQuestion[]
    guidelines?: string
    evaluationWeight?: number
  }[]
  totalQuestions: number
}> {
  const supabase = await createClientForApi()
  const maxPerSection = options?.maxQuestionsPerSection || 5

  console.log('[generateTemplateDrivenQuestions] Starting for planId:', planId)

  // 플랜 조회 (조인 없이)
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    console.error('[generateTemplateDrivenQuestions] Plan query error:', planError)
    return { success: false, template: null, questionsBySection: [], totalQuestions: 0 }
  }

  console.log('[generateTemplateDrivenQuestions] Plan found:', plan.id, 'program_id:', plan.program_id)

  // 프로그램 정보 별도 조회
  let program = null
  if (plan.program_id) {
    const { data: programData } = await supabase
      .from('government_programs')
      .select('title, organization, content')
      .eq('id', plan.program_id)
      .single()
    program = programData
  }

  // 템플릿 조회 (있는 경우)
  let template: BusinessPlanTemplate | null = null
  if (plan.template_id) {
    const { data: templateData } = await supabase
      .from('business_plan_templates')
      .select('*')
      .eq('id', plan.template_id)
      .single()
    template = templateData as BusinessPlanTemplate | null
  }

  // 템플릿이 없으면 공고문에서 파싱 시도
  if (!template && plan.program_id) {
    console.log('[generateTemplateDrivenQuestions] No template, trying to parse from announcement')
    try {
      template = await parseAnnouncementTemplate(plan.program_id)
      // 플랜에 템플릿 연결
      if (template?.id) {
        await supabase
          .from('business_plans')
          .update({ template_id: template.id })
          .eq('id', planId)
      }
    } catch (parseError) {
      console.error('[generateTemplateDrivenQuestions] Template parse error:', parseError)
    }
  }

  // plan에 program 정보 추가
  ; (plan as any).program = program

  if (!template) {
    // 기본 템플릿 사용
    const defaultTpl = getDefaultTemplate()
    template = {
      id: 'default',
      template_name: '기본 사업계획서 양식',
      template_version: '1.0',
      sections: defaultTpl.sections as TemplateSection[],
      evaluation_criteria: defaultTpl.evaluation_criteria,
      required_attachments: defaultTpl.required_attachments,
      writing_guidelines: defaultTpl.writing_guidelines,
      formatting_rules: defaultTpl.formatting_rules,
      parsing_status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as BusinessPlanTemplate
  }

  const sections = (template.sections || []) as TemplateSection[]
  const questionsBySection: {
    sectionId: string
    sectionTitle: string
    questions: PlanQuestion[]
    guidelines?: string
    evaluationWeight?: number
  }[] = []

  // 기존 팩트카드 조회 (스킵 옵션용)
  const { data: existingFacts } = await supabase
    .from('company_fact_cards')
    .select('*')
    .eq('company_id', plan.company_id)

  // 각 섹션별로 AI에게 질문 생성 요청
  for (const section of sections) {
    // 해당 섹션에 필요한 정보가 있는지 체크
    if (options?.skipExistingData) {
      // TODO: 섹션별 데이터 충족도 체크
    }

    let sectionQuestions: any[] = []

    // AI로 해당 섹션을 완벽하게 채우기 위한 질문 생성 (Gemini 2.5 Flash)
    try {
      const model = getGeminiModel()
      const aiResult = await model.generateContent(`당신은 정부지원사업 사업계획서 전문 컨설턴트입니다.

다음 사업계획서 섹션을 **완벽하게 채우기 위해** 사용자에게 물어볼 질문을 생성해주세요.

===== 섹션 정보 =====
제목: ${section.title}
가이드라인: ${section.guidelines || '(명시된 가이드라인 없음)'}
최대 글자 수: ${section.max_chars || 3000}자
평가 배점: ${section.evaluation_weight || 10}점
${section.subsections ? `하위 섹션: ${section.subsections.map(s => s.title).join(', ')}` : ''}

===== 공고 정보 =====
사업명: ${(plan as any).program?.title || plan.title}
주관기관: ${(plan as any).program?.organization || ''}

===== 질문 생성 원칙 =====
1. 이 섹션을 완벽하게 작성할 수 있는 정보를 수집하는 질문
2. 평가위원이 좋은 점수를 줄 수 있는 구체적인 내용을 얻을 수 있는 질문
3. 정량적 데이터(숫자, 통계, 기간 등)를 얻는 질문 필수 포함
4. 사용자가 쉽게 답할 수 있는 구체적인 질문
5. 답변을 조합하면 이 섹션 전체 내용이 완성되어야 함

===== 출력 형식 =====
JSON 배열로 응답:
[
  {
    "question": "구체적인 질문 내용",
    "purpose": "이 질문이 필요한 이유 (간단히)",
    "expectedContent": "이 답변이 섹션에서 어떻게 사용되는지",
    "questionType": "text|number|list|choice",
    "isRequired": true,
    "hint": "답변 예시 또는 팁",
    "dataType": "정량|정성|구조화"
  }
]

${maxPerSection}개 이내의 핵심 질문만 생성하세요. 중복 없이 섹션 전체를 커버해야 합니다.`)

      const responseText = aiResult.response.text() || ''
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/)

      if (jsonMatch) {
        try {
          sectionQuestions = JSON.parse(jsonMatch[0])
        } catch {
          sectionQuestions = []
        }
      }
    } catch (aiError) {
      console.warn(`[generateTemplateDrivenQuestions] AI question generation failed for section "${section.title}":`, aiError)
      // AI 실패 시 기본 질문 사용
      sectionQuestions = []
    }

    // 질문이 없으면 기본 질문 생성 (AI 실패 또는 빈 응답 시)
    if (sectionQuestions.length === 0) {
      sectionQuestions = getDefaultQuestionsForSection(section)
      console.log(`[generateTemplateDrivenQuestions] Using default questions for section "${section.title}":`, sectionQuestions.length)
    }

    console.log(`[generateTemplateDrivenQuestions] Section "${section.title}" has ${sectionQuestions.length} questions`)

    // 질문 DB 저장
    const questionsToInsert = sectionQuestions.map((q: any, idx: number) => ({
      plan_id: planId,
      section_id: section.section_id,
      question_text: q.question,
      question_type: q.questionType || 'text',
      context: JSON.stringify({
        purpose: q.purpose,
        expectedContent: q.expectedContent,
        hint: q.hint,
        dataType: q.dataType,
        sectionTitle: section.title,
        sectionGuidelines: section.guidelines
      }),
      priority: (idx + 1) as 1 | 2 | 3 | 4 | 5,
      is_required: q.isRequired !== false,
      status: 'pending' as const
    }))

    console.log(`[generateTemplateDrivenQuestions] Attempting to insert ${questionsToInsert.length} questions for section "${section.title}"`)

    // DB 저장 시도 (테이블이 없어도 계속 진행)
    let savedQuestions: PlanQuestion[] = []
    try {
      const { data: insertedQuestions, error: insertError } = await supabase
        .from('plan_questions')
        .insert(questionsToInsert)
        .select()

      if (insertError) {
        console.warn(`[generateTemplateDrivenQuestions] Insert error for section "${section.title}":`, insertError.message)
        // DB 저장 실패 시 메모리에서 직접 질문 생성
        savedQuestions = questionsToInsert.map((q: any, idx: number) => ({
          id: `temp-${section.section_id}-${idx}`,
          plan_id: planId,
          section_id: q.section_id,
          question_text: q.question_text,
          question_type: q.question_type,
          context: q.context,
          priority: q.priority,
          is_required: q.is_required,
          status: q.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) as PlanQuestion[]
      } else {
        savedQuestions = (insertedQuestions || []) as PlanQuestion[]
        console.log(`[generateTemplateDrivenQuestions] Successfully inserted ${savedQuestions.length} questions for section "${section.title}"`)
      }
    } catch (dbError) {
      console.warn(`[generateTemplateDrivenQuestions] DB error for section "${section.title}":`, dbError)
      // 예외 발생 시에도 메모리에서 질문 생성
      savedQuestions = questionsToInsert.map((q: any, idx: number) => ({
        id: `temp-${section.section_id}-${idx}`,
        plan_id: planId,
        section_id: q.section_id,
        question_text: q.question_text,
        question_type: q.question_type,
        context: q.context,
        priority: q.priority,
        is_required: q.is_required,
        status: q.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as PlanQuestion[]
    }

    questionsBySection.push({
      sectionId: section.section_id,
      sectionTitle: section.title,
      questions: savedQuestions,
      guidelines: section.guidelines,
      evaluationWeight: section.evaluation_weight
    })
  }

  // 플랜 상태 업데이트
  await supabase
    .from('business_plans')
    .update({
      pipeline_stage: 0,
      pipeline_status: 'collecting'
    })
    .eq('id', planId)

  const totalQuestions = questionsBySection.reduce((sum, s) => sum + s.questions.length, 0)

  return {
    success: true,
    template,
    questionsBySection,
    totalQuestions
  }
}

/**
 * 섹션별 답변을 받아 해당 섹션 콘텐츠 직접 생성
 * placeholder 없이 완벽한 내용 생성
 */
export async function generateSectionFromAnswers(
  planId: string,
  sectionId: string,
  answers: { questionId: string; answer: string }[]
): Promise<{
  success: boolean
  section: BusinessPlanSection | null
  charCount: number
  qualityScore: number
}> {
  const supabase = await createClientForApi()

  console.log('[generateSectionFromAnswers] Starting for planId:', planId, 'sectionId:', sectionId)

  // 플랜 조회 (조인 없이)
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    console.error('[generateSectionFromAnswers] Plan not found:', planError)
    return { success: false, section: null, charCount: 0, qualityScore: 0 }
  }

  // 프로그램 정보 별도 조회
  let program: { title: string; organization: string } | null = null
  if (plan.program_id) {
    const { data: programData } = await supabase
      .from('government_programs')
      .select('title, organization')
      .eq('id', plan.program_id)
      .single()
    program = programData
  }

  // 템플릿 조회 (있는 경우)
  let template: BusinessPlanTemplate | null = null
  if (plan.template_id) {
    const { data: templateData } = await supabase
      .from('business_plan_templates')
      .select('*')
      .eq('id', plan.template_id)
      .single()
    template = templateData as BusinessPlanTemplate | null
  }

  // 템플릿이 없으면 기본 템플릿 사용
  if (!template) {
    const defaultTpl = getDefaultTemplate()
    template = {
      id: 'default',
      template_name: '기본 사업계획서 양식',
      template_version: '1.0',
      sections: defaultTpl.sections as TemplateSection[],
      evaluation_criteria: defaultTpl.evaluation_criteria,
      required_attachments: defaultTpl.required_attachments,
      writing_guidelines: defaultTpl.writing_guidelines,
      formatting_rules: defaultTpl.formatting_rules,
      parsing_status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as BusinessPlanTemplate
  }

  // 질문 및 답변 정보 조회
  const questionIds = answers.map(a => a.questionId)
  const { data: questions } = await supabase
    .from('plan_questions')
    .select('*')
    .in('id', questionIds)

  console.log('[generateSectionFromAnswers] Found questions:', questions?.length || 0)

  // 템플릿에서 해당 섹션 정보 찾기
  const templateSections = (template.sections || []) as TemplateSection[]
  const targetSection = templateSections.find(s => s.section_id === sectionId)

  if (!targetSection) {
    return { success: false, section: null, charCount: 0, qualityScore: 0 }
  }

  // 질문-답변 쌍 구성
  const qaList = answers.map(a => {
    const q = questions?.find(q => q.id === a.questionId)
    let context = {}
    try {
      context = q?.context ? JSON.parse(q.context) : {}
    } catch { }
    return {
      question: q?.question_text || '',
      answer: a.answer,
      purpose: (context as any).purpose || '',
      expectedContent: (context as any).expectedContent || ''
    }
  })

  // AI로 섹션 콘텐츠 생성 (Gemini 2.5 Flash)
  let content = ''
  try {
    const model = getGeminiModel()
    const generateResult = await model.generateContent(`당신은 성공한 유니콘 스타트업의 CSO(최고전략책임자)이자 정부지원사업 심사위원장입니다.
단순히 글을 쓰는 것이 아니라, **"심사위원을 설득하여 자금을 따내는 것"**이 유일한 목표입니다.

[작성 프로세스]
1. **건조한 팩트를 "매력적인 기회"로 재해석**: 사용자의 답변이 "AI 기술 사용"이라면, 당신은 "독자적인 AI 알고리즘을 통한 99%의 처리 정확도 확보 및 특허 출원"으로 확장해야 합니다.
2. **약점 방어**: 정보가 부족한 부분은 "현재 R&D 진행 중" 또는 "2분기 내 PoC 완료 예정"과 같이 구체적인 마일스톤으로 포장하여 신뢰를 주십시오.
3. **스타일 변환**: 구어체나 평범한 문장을 비즈니스 전문 용어(BM, PMF, CAGR, KPI 등)와 섞어 전문성을 극대화하십시오.

[절대 원칙]
- **No Fluff**: 의미 없는 미사여구(획기적인, 대단한, 엄청난)를 빼고 팩트와 수치로 승부하십시오.
- **Answer the 'So What?'**: 기능 설명에 그치지 말고, 그 기능이 고객에게 어떤 비용 절감이나 매출 증대를 가져오는지(Benefit)를 반드시 연결하십시오.
- **Clean Formatting**: 가독성을 위해 불렛포인트, 굵은 글씨, 명확한 단락 구분을 사용하십시오.

다음 인터뷰 데이터를 기반으로 "${targetSection.title}" 섹션을 전략적으로 기술해주십시오.

[섹션 목표]
${targetSection.guidelines || '심사위원이 이 사업의 성공 가능성을 확신하도록 설득'}
- 배점: ${targetSection.evaluation_weight || 10}점 (고배점 항목이므로 각별히 신경 쓸 것)

[사업 개요]
- 프로젝트명: ${program?.title || plan.title}
- 주관기관: ${program?.organization || '정부처'}

[인터뷰 답변 (Raw Data)]
${qaList.map((qa, i) => `
Q: ${qa.question}
A: ${qa.answer}
(의도: ${qa.purpose})
`).join('\n')}

[작성 지침]
위 답변들은 소재일 뿐입니다. 이 소재들을 연결하여 **하나의 완결된, 논리적이고 강력한 비즈니스 내러티브**를 완성하십시오.
답변이 너무 짧거나 성의가 없다면, 심사위원이 좋아할 만한 **업계 표준 전략이나 예상 기대효과를 가미하여 내용을 풍성하게 증폭**시키십시오.
(단, 거짓말은 하지 말고 '계획', '전략', '예상'이라는 표현을 활용하여 합리적인 추론임을 나타내십시오.)

섹션 제목은 제외하고 본문만 출력하십시오.`)

    content = generateResult.response.text()?.trim() || ''
    console.log('[generateSectionFromAnswers] AI generated content length:', content.length)
  } catch (aiError) {
    console.error('[generateSectionFromAnswers] AI generation failed:', aiError)
    // AI 실패 시 답변들을 조합하여 기본 콘텐츠 생성
    content = qaList.map(qa => `${qa.answer}`).join('\n\n')
    console.log('[generateSectionFromAnswers] Using fallback content from answers')
  }

  const charCount = content.length

  // 품질 점수 계산 (간단한 휴리스틱)
  let qualityScore = 50
  if (charCount >= (targetSection.max_chars || 3000) * 0.3) qualityScore += 15
  if (charCount >= (targetSection.max_chars || 3000) * 0.6) qualityScore += 15
  if (!content.includes('{{')) qualityScore += 10  // placeholder 없음
  if (content.match(/\d+/g)?.length || 0 >= 3) qualityScore += 10  // 수치 포함

  // 섹션 저장/업데이트 (테이블이 없어도 진행)
  let savedSection: BusinessPlanSection

  // 기본값으로 메모리 섹션 생성
  const memorySection: BusinessPlanSection = {
    id: `temp-section-${sectionId}`,
    plan_id: planId,
    section_key: sectionId,
    section_title: targetSection.title,
    section_order: targetSection.order || 0,
    content,
    ai_generated: true,
    char_count: charCount,
    max_char_limit: targetSection.max_chars,
    has_placeholders: false,
    placeholders: [],
    validation_status: charCount > 0 ? 'valid' : 'warning',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as BusinessPlanSection

  savedSection = memorySection

  try {
    const { data: existingSection, error: selectError } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)
      .eq('section_key', sectionId)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = "no rows found" - 이건 정상, 다른 에러는 로그
      console.warn('[generateSectionFromAnswers] Section select error:', selectError.message)
    }

    if (existingSection) {
      // 업데이트
      const { data, error: updateError } = await supabase
        .from('business_plan_sections')
        .update({
          content,
          ai_generated: true,
          char_count: charCount,
          has_placeholders: false,
          placeholders: [],
          validation_status: charCount > 0 ? 'valid' : 'warning',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSection.id)
        .select()
        .single()

      if (data && !updateError) {
        savedSection = data as BusinessPlanSection
        console.log('[generateSectionFromAnswers] Section updated in DB')
      }
    } else {
      // 새로 생성
      const { data, error: insertError } = await supabase
        .from('business_plan_sections')
        .insert({
          plan_id: planId,
          section_key: sectionId,
          section_title: targetSection.title,
          section_order: targetSection.order,
          content,
          ai_generated: true,
          char_count: charCount,
          max_char_limit: targetSection.max_chars,
          has_placeholders: false,
          placeholders: [],
          validation_status: charCount > 0 ? 'valid' : 'warning'
        })
        .select()
        .single()

      if (data && !insertError) {
        savedSection = data as BusinessPlanSection
        console.log('[generateSectionFromAnswers] Section inserted to DB')
      } else if (insertError) {
        console.warn('[generateSectionFromAnswers] Section insert error:', insertError.message)
      }
    }
  } catch (sectionError) {
    console.warn('[generateSectionFromAnswers] Section DB operation failed, using memory section')
  }

  console.log('[generateSectionFromAnswers] Final section title:', savedSection.section_title)

  // 질문 상태 업데이트
  try {
    for (const answer of answers) {
      await supabase
        .from('plan_questions')
        .update({
          answer: answer.answer,
          answered_at: new Date().toISOString(),
          status: 'answered'
        })
        .eq('id', answer.questionId)
    }
    console.log('[generateSectionFromAnswers] Question statuses updated')
  } catch (questionError) {
    console.warn('[generateSectionFromAnswers] Question status update failed:', questionError)
  }

  // 답변을 팩트카드로도 저장 (재사용 위해) - 실패해도 무시
  try {
    await processInterviewAnswers(plan.company_id, planId, answers)
  } catch (factError) {
    console.warn('[generateSectionFromAnswers] Fact card save failed:', factError)
  }

  return {
    success: true,
    section: savedSection,
    charCount,
    qualityScore: Math.min(qualityScore, 100)
  }
}

/**
 * 전체 양식 기반 인터뷰 완료 후 모든 섹션 일괄 생성
 */
export async function generateAllSectionsFromInterview(
  planId: string
): Promise<{
  success: boolean
  sections: BusinessPlanSection[]
  completionPercentage: number
  pendingQuestions: number
}> {
  console.log('[generateAllSections] Function called with planId:', planId)
  const supabase = await createClientForApi()

  // 플랜 정보 조회
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  console.log('[generateAllSections] Plan query result:', plan ? 'found' : 'not found', 'error:', planError)

  // 템플릿 별도 조회
  let template = null
  if (plan?.template_id) {
    const { data: templateData } = await supabase
      .from('business_plan_templates')
      .select('*')
      .eq('id', plan.template_id)
      .single()
    template = templateData
  }

  if (!plan) {
    console.log('[generateAllSections] Plan not found, returning early')
    return { success: false, sections: [], completionPercentage: 0, pendingQuestions: 0 }
  }

  // 모든 질문 조회
  const { data: allQuestions, error: questionsError } = await supabase
    .from('plan_questions')
    .select('*')
    .eq('plan_id', planId)

  console.log('[generateAllSections] Plan:', planId)
  console.log('[generateAllSections] Questions count:', allQuestions?.length || 0)
  console.log('[generateAllSections] Questions error:', questionsError)

  // 미답변 질문 체크
  const pendingQuestions = (allQuestions || []).filter(q => q.status === 'pending')
  console.log('[generateAllSections] Pending questions:', pendingQuestions.length)

  if (pendingQuestions.length > 0) {
    console.log('[generateAllSections] Returning early due to pending questions')
    return {
      success: false,
      sections: [],
      completionPercentage: 0,
      pendingQuestions: pendingQuestions.length
    }
  }

  // 섹션별로 답변 그룹화
  const templateSections = (template?.sections || []) as TemplateSection[]
  const generatedSections: BusinessPlanSection[] = []

  for (const section of templateSections) {
    const sectionQuestions = (allQuestions || []).filter(q => q.section_id === section.section_id)

    if (sectionQuestions.length > 0) {
      const answers = sectionQuestions.map(q => ({
        questionId: q.id,
        answer: q.answer || ''
      }))

      const result = await generateSectionFromAnswers(planId, section.section_id, answers)
      if (result.success && result.section) {
        generatedSections.push(result.section)
      }
    }
  }

  // 완성도 계산
  const completionPercentage = templateSections.length > 0
    ? Math.round((generatedSections.length / templateSections.length) * 100)
    : 0

  // 플랜 상태 업데이트 (status만 업데이트)
  await supabase
    .from('business_plans')
    .update({
      status: completionPercentage >= 80 ? 'validating' : 'generating'
    })
    .eq('id', planId)

  return {
    success: true,
    sections: generatedSections,
    completionPercentage,
    pendingQuestions: 0
  }
}

/**
 * 인터뷰 답변을 팩트카드로 변환
 */
export async function processInterviewAnswers(
  companyId: string,
  planId: string,
  answers: { questionId: string; answer: string }[]
): Promise<CompanyFactCard[]> {
  const supabase = createAdminClient()

  // 질문 조회
  const questionIds = answers.map(a => a.questionId)
  const { data: questions } = await supabase
    .from('plan_questions')
    .select('*')
    .in('id', questionIds)

  if (!questions || questions.length === 0) return []

  // AI로 답변에서 팩트 추출
  const answersWithQuestions = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId)
    return { question: q?.question_text || '', answer: a.answer, context: q?.context || '' }
  })

  const model = getGeminiModel()
  const extractResult = await model.generateContent(`다음 질문-답변 쌍에서 사업계획서에 활용할 팩트카드를 추출해주세요.

질문과 답변:
${answersWithQuestions.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}

각 답변에서 핵심 팩트를 추출하여 JSON 배열로 반환:
[
  {
    "category": "company_info|technology|market|team|finance|plan|achievement|product",
    "fact_key": "팩트 키 (영문, snake_case)",
    "fact_value": "추출된 팩트 값",
    "fact_type": "text|number|date|list",
    "confidence_score": 0.9
  }
]

원래 답변을 최대한 보존하되, 사업계획서에 바로 쓸 수 있도록 정리해주세요.`)

  const responseText = extractResult.response.text() || ''
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)

  if (!jsonMatch) return []

  const extractedFacts = JSON.parse(jsonMatch[0])

  // 팩트카드 저장
  const factsToInsert = extractedFacts.map((f: any) => ({
    company_id: companyId,
    category: f.category,
    fact_key: f.fact_key,
    fact_value: f.fact_value,
    fact_type: f.fact_type || 'text',
    source: 'interview',
    confidence_score: f.confidence_score || 0.85,
    is_verified: true,
    verified_at: new Date().toISOString()
  }))

  const { data: insertedFacts } = await supabase
    .from('company_fact_cards')
    .upsert(factsToInsert, {
      onConflict: 'company_id,category,fact_key,version'
    })
    .select()

  // 질문 상태 업데이트
  for (const answer of answers) {
    await supabase
      .from('plan_questions')
      .update({
        answer: answer.answer,
        answered_at: new Date().toISOString(),
        status: 'answered'
      })
      .eq('id', answer.questionId)
  }

  // 데이터 충족도 재확인
  const { data: plan } = await supabase
    .from('business_plans')
    .select('template_id')
    .eq('id', planId)
    .single()

  const templateSections = (plan?.template?.sections || []) as TemplateSection[]
  const newSufficiency = await checkDataSufficiency(companyId, templateSections)

  // 충분하면 다음 단계로
  if (newSufficiency.sufficient) {
    await supabase
      .from('business_plans')
      .update({
        pipeline_stage: 2,
        pipeline_status: 'extracting'
      })
      .eq('id', planId)
  }

  return insertedFacts as CompanyFactCard[]
}

// =====================================================
// Stage 1: 공고문 양식 파싱
// =====================================================

export async function parseAnnouncementTemplate(
  programId: string,
  documentUrl?: string
): Promise<BusinessPlanTemplate> {
  const supabase = createAdminClient()

  // 로그 시작
  const logId = await startStageLog(programId, 1, '공고문 양식 파싱')

  try {
    // 1. 먼저 첨부파일에서 양식 파싱 시도 (PDF 다운로드 → 텍스트 추출 → AI 구조화)
    console.log('[parseAnnouncementTemplate] Trying attachment parsing first...')
    try {
      const { getOrParseTemplate } = await import('./attachment-parser')
      const attachmentResult = await getOrParseTemplate(programId)

      if (attachmentResult.success && attachmentResult.template) {
        console.log('[parseAnnouncementTemplate] Successfully parsed from attachment!')
        await completeStageLog(logId, 'completed', {
          source: 'attachment',
          sections_count: attachmentResult.template.sections?.length || 0
        })

        // DB에서 전체 템플릿 조회하여 반환
        const { data: fullTemplate } = await supabase
          .from('business_plan_templates')
          .select('*')
          .eq('id', attachmentResult.templateId)
          .single()

        if (fullTemplate) {
          return fullTemplate as BusinessPlanTemplate
        }
      }
    } catch (attachmentError) {
      console.log('[parseAnnouncementTemplate] Attachment parsing failed, falling back to text parsing:', attachmentError)
    }

    // 2. 첨부파일 파싱 실패 시 공고문 텍스트 기반 파싱
    console.log('[parseAnnouncementTemplate] Falling back to text-based parsing...')

    // 공고문 정보 조회
    const { data: program } = await supabase
      .from('government_programs')
      .select('*')
      .eq('id', programId)
      .single()

    if (!program) {
      throw new Error('프로그램을 찾을 수 없습니다')
    }

    // AI로 공고문 구조 파싱 (Gemini 2.5 Flash)
    const model = getGeminiModel()
    const parseResult = await model.generateContent(`다음 정부지원사업 공고문을 분석하여 사업계획서 작성 양식을 추출해주세요.

공고명: ${program.title}
주관기관: ${program.organization}
공고내용:
${program.content || '(상세 내용 없음)'}

다음 JSON 형식으로 응답해주세요:
{
  "sections": [
    {
      "section_id": "1",
      "title": "섹션 제목",
      "required": true,
      "max_chars": 3000,
      "guidelines": "작성 가이드라인",
      "order": 1,
      "evaluation_weight": 20
    }
  ],
  "evaluation_criteria": [
    {
      "criterion": "평가항목명",
      "weight": 30,
      "description": "평가 기준 설명",
      "max_score": 30
    }
  ],
  "required_attachments": [
    {
      "name": "첨부서류명",
      "format": ["pdf", "hwp"],
      "required": true,
      "description": "서류 설명"
    }
  ],
  "writing_guidelines": {
    "general": "전반적인 작성 요령",
    "tone": "문체/어조 가이드"
  },
  "formatting_rules": {
    "font_family": "맑은 고딕",
    "font_size": 11,
    "line_spacing": 1.5,
    "page_limit": 20
  }
}

공고문에 명시된 정보가 없는 경우 일반적인 정부지원사업 양식을 기준으로 추정해주세요.`)

    const responseText = parseResult.response.text() || ''

    // JSON 추출
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultTemplate()

    // 템플릿 저장
    // NOTE: DB에 formatting_rules, required_attachments 컬럼이 없을 수 있음
    // 현재 DB 스키마에 맞게 필드 조정
    // program_id에 unique constraint가 없으므로 upsert 대신 check-then-insert/update 사용
    const templateData = {
      program_id: programId,
      name: `${program.title} 양식`,  // DB 컬럼명은 'name'
      section_structure: parsedData.sections || [],  // DB 컬럼명은 'section_structure'
      sections: parsedData.sections || [],
      evaluation_criteria: parsedData.evaluation_criteria || [],
      writing_guidelines: parsedData.writing_guidelines || {},
      parsing_status: 'completed'
    }

    // 기존 템플릿 확인
    const { data: existingTemplate } = await supabase
      .from('business_plan_templates')
      .select('id')
      .eq('program_id', programId)
      .single()

    let template: any = null
    let error: any = null

    if (existingTemplate) {
      // 업데이트
      const result = await supabase
        .from('business_plan_templates')
        .update(templateData)
        .eq('id', existingTemplate.id)
        .select()
        .single()
      template = result.data
      error = result.error
    } else {
      // 새로 생성
      const result = await supabase
        .from('business_plan_templates')
        .insert(templateData)
        .select()
        .single()
      template = result.data
      error = result.error
    }

    if (error) throw error

    // 로그 완료
    await completeStageLog(logId, 'completed', {
      sections_count: parsedData.sections?.length || 0,
      tokens_used: parseResult.usage?.input_tokens + parseResult.usage?.output_tokens
    })

    return template as BusinessPlanTemplate
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// 기본 템플릿 (파싱 실패 시)
function getDefaultTemplate() {
  return {
    sections: [
      { section_id: '1', title: '사업 개요', required: true, max_chars: 2000, order: 1, evaluation_weight: 15 },
      { section_id: '2', title: '기술 현황 및 개발 계획', required: true, max_chars: 5000, order: 2, evaluation_weight: 25 },
      { section_id: '3', title: '사업화 전략', required: true, max_chars: 3000, order: 3, evaluation_weight: 20 },
      { section_id: '4', title: '시장 분석', required: true, max_chars: 2500, order: 4, evaluation_weight: 15 },
      { section_id: '5', title: '추진 일정 및 예산', required: true, max_chars: 2000, order: 5, evaluation_weight: 15 },
      { section_id: '6', title: '기대 효과', required: true, max_chars: 1500, order: 6, evaluation_weight: 10 }
    ],
    evaluation_criteria: [
      { criterion: '기술성', weight: 30, description: '기술의 혁신성 및 완성도' },
      { criterion: '시장성', weight: 25, description: '시장 규모 및 성장 가능성' },
      { criterion: '사업성', weight: 25, description: '사업화 가능성 및 수익 모델' },
      { criterion: '역량', weight: 20, description: '수행 조직의 역량 및 경험' }
    ],
    required_attachments: [
      { name: '사업자등록증', format: ['pdf'], required: true },
      { name: '재무제표', format: ['pdf', 'xlsx'], required: true }
    ],
    writing_guidelines: {
      general: '구체적인 수치와 근거를 포함하여 작성',
      tone: '객관적이고 전문적인 문체 사용'
    },
    formatting_rules: {
      font_family: '맑은 고딕',
      font_size: 11,
      line_spacing: 1.5,
      page_limit: 30
    }
  }
}

// 섹션별 기본 질문 생성 (AI 실패 시 사용)
function getDefaultQuestionsForSection(section: TemplateSection): any[] {
  // 섹션 제목에 따른 맞춤형 기본 질문
  const sectionQuestionMap: Record<string, any[]> = {
    '사업 개요': [
      { question: '개발하려는 제품/서비스를 한 문장으로 설명해주세요.', purpose: '핵심 아이템 파악', questionType: 'text', isRequired: true, hint: '예: AI 기반 고객 상담 자동화 솔루션' },
      { question: '해결하려는 문제(Pain Point)는 무엇인가요?', purpose: '시장 니즈 파악', questionType: 'text', isRequired: true, hint: '고객이 겪는 구체적인 불편함이나 문제점' },
      { question: '경쟁사 대비 차별점은 무엇인가요?', purpose: '경쟁 우위 파악', questionType: 'text', isRequired: true, hint: '기술, 가격, 서비스 등의 차별화 요소' }
    ],
    '기술 현황 및 개발 계획': [
      { question: '핵심 기술의 원리를 간단히 설명해주세요.', purpose: '기술 역량 파악', questionType: 'text', isRequired: true, hint: '기술의 작동 원리와 특징' },
      { question: '현재 개발 단계는 어디인가요?', purpose: '개발 진척도 파악', questionType: 'text', isRequired: true, hint: '아이디어/연구/프로토타입/MVP/상용화 등' },
      { question: '보유 특허나 지식재산권이 있나요?', purpose: 'IP 현황 파악', questionType: 'text', isRequired: false, hint: '출원/등록 특허 명칭, 개수 등' }
    ],
    '사업화 전략': [
      { question: '주요 타겟 고객은 누구인가요?', purpose: '고객 세분화', questionType: 'text', isRequired: true, hint: '구체적인 고객군 (B2B/B2C, 산업군, 연령대 등)' },
      { question: '수익 모델은 무엇인가요?', purpose: '비즈니스 모델 파악', questionType: 'text', isRequired: true, hint: '구독료, 판매수익, 광고, 수수료 등' },
      { question: '판매/마케팅 전략은 어떻게 되나요?', purpose: '시장 진입 전략', questionType: 'text', isRequired: true, hint: '온라인 마케팅, 영업, 파트너십 등' }
    ],
    '시장 분석': [
      { question: '목표 시장의 규모는 어느 정도인가요?', purpose: '시장 규모 파악', questionType: 'text', isRequired: true, hint: '전체 시장(TAM), 유효 시장(SAM), 목표 시장(SOM)' },
      { question: '주요 경쟁사는 누구인가요?', purpose: '경쟁 환경 분석', questionType: 'text', isRequired: true, hint: '직접/간접 경쟁사 3~5개' },
      { question: '시장 성장 트렌드는 어떠한가요?', purpose: '시장 전망 파악', questionType: 'text', isRequired: false, hint: '연평균 성장률, 향후 전망 등' }
    ],
    '추진 일정 및 예산': [
      { question: '향후 1년간 주요 마일스톤은 무엇인가요?', purpose: '실행 계획 파악', questionType: 'text', isRequired: true, hint: '분기별 또는 월별 주요 목표' },
      { question: '필요한 총 예산은 얼마인가요?', purpose: '예산 규모 파악', questionType: 'number', isRequired: true, hint: '단위: 원' },
      { question: '예산 항목별 배분은 어떻게 되나요?', purpose: '예산 계획 파악', questionType: 'text', isRequired: true, hint: '인건비, 재료비, 외주비 등' }
    ],
    '기대 효과': [
      { question: '사업 성공 시 예상 매출은 얼마인가요?', purpose: '경제적 효과 파악', questionType: 'text', isRequired: true, hint: '3년 또는 5년 후 예상 매출' },
      { question: '고용 창출 효과는 어느 정도인가요?', purpose: '일자리 창출 효과', questionType: 'number', isRequired: false, hint: '향후 채용 예정 인원' },
      { question: '기대하는 사회적 효과는 무엇인가요?', purpose: '사회적 가치 파악', questionType: 'text', isRequired: false, hint: '환경, 복지, 기술 발전 등' }
    ],
    '팀 구성': [
      { question: '대표자의 관련 경력은 어떻게 되나요?', purpose: '대표 역량 파악', questionType: 'text', isRequired: true, hint: '관련 분야 경력, 학력, 수상 등' },
      { question: '핵심 팀원 구성은 어떻게 되나요?', purpose: '팀 역량 파악', questionType: 'text', isRequired: true, hint: '주요 직책별 인원과 전문성' },
      { question: '현재 전체 직원 수는 몇 명인가요?', purpose: '조직 규모 파악', questionType: 'number', isRequired: true, hint: '정규직/계약직 포함' }
    ],
    '재무 현황': [
      { question: '최근 연매출은 얼마인가요?', purpose: '재무 현황 파악', questionType: 'number', isRequired: true, hint: '작년 기준 매출액 (원)' },
      { question: '투자 유치 이력이 있나요?', purpose: '투자 이력 파악', questionType: 'text', isRequired: false, hint: '투자 라운드, 금액, 투자사 등' }
    ]
  }

  // 매칭되는 질문 찾기
  const matchedQuestions = sectionQuestionMap[section.title]
  if (matchedQuestions) {
    return matchedQuestions.map(q => ({
      ...q,
      expectedContent: `${section.title} 섹션 작성에 활용`,
      dataType: q.questionType === 'number' ? '정량' : '정성'
    }))
  }

  // 매칭되는 질문이 없으면 기본 질문 1개 생성
  return [
    {
      question: `"${section.title}" 섹션에 들어갈 내용을 자유롭게 설명해주세요.`,
      purpose: '섹션 기본 내용 수집',
      expectedContent: '전체 섹션 내용',
      questionType: 'text',
      isRequired: true,
      hint: section.guidelines || '구체적이고 상세하게 작성해주세요',
      dataType: '정성'
    }
  ]
}

// =====================================================
// Stage 2: 회사 데이터 수집
// =====================================================

export async function collectCompanyData(
  companyId: string,
  planId: string
): Promise<CompanyFactCard[]> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 2, '회사 데이터 수집')

  try {
    // 기존 팩트카드 조회
    const { data: existingFacts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_verified', true)

    // 회사 기본 정보 조회
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    // 직원 정보 조회
    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')

    // 프로필 정보 조회
    const { data: profile } = await supabase
      .from('company_support_profiles')
      .select('*')
      .eq('company_id', companyId)
      .single()

    // 지식베이스 조회
    const { data: knowledge } = await supabase
      .from('company_knowledge_base')
      .select('*')
      .eq('company_id', companyId)

    // 새로운 팩트카드 생성
    const newFacts: Partial<CompanyFactCard>[] = []

    // 회사 기본 정보 팩트
    if (company) {
      newFacts.push(
        { category: 'company_info', fact_key: 'company_name', fact_value: company.name, fact_type: 'text' },
        { category: 'company_info', fact_key: 'business_number', fact_value: company.business_number, fact_type: 'text' },
        { category: 'company_info', fact_key: 'address', fact_value: company.address, fact_type: 'text' },
        { category: 'company_info', fact_key: 'industry', fact_value: company.industry, fact_type: 'text' },
        { category: 'company_info', fact_key: 'founded_date', fact_value: company.founded_date, fact_type: 'date' },
        { category: 'company_info', fact_key: 'employee_count', fact_value: String(employees?.length || 0), fact_type: 'number' }
      )
    }

    // 프로필 정보 팩트
    if (profile) {
      if (profile.business_description) {
        newFacts.push({
          category: 'company_info',
          fact_key: 'business_description',
          fact_value: profile.business_description,
          fact_type: 'text'
        })
      }
      if (profile.main_products) {
        newFacts.push({
          category: 'product',
          fact_key: 'main_products',
          fact_value: profile.main_products,
          fact_type: 'text'
        })
      }
      if (profile.core_technologies) {
        newFacts.push({
          category: 'technology',
          fact_key: 'core_technologies',
          fact_value: profile.core_technologies,
          fact_type: 'text'
        })
      }
    }

    // 팩트카드 저장
    const factsToInsert = newFacts
      .filter(f => f.fact_value && f.fact_value !== 'null' && f.fact_value !== 'undefined')
      .map(f => ({
        ...f,
        company_id: companyId,
        source: 'system',
        is_verified: true,
        verified_at: new Date().toISOString()
      }))

    if (factsToInsert.length > 0) {
      await supabase
        .from('company_fact_cards')
        .upsert(factsToInsert, {
          onConflict: 'company_id,category,fact_key,version'
        })
    }

    // 전체 팩트카드 조회
    const { data: allFacts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', companyId)

    await completeStageLog(logId, 'completed', {
      facts_collected: allFacts?.length || 0,
      new_facts: factsToInsert.length
    })

    return allFacts as CompanyFactCard[]
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 3: 팩트카드 추출 (AI 기반)
// =====================================================

export async function extractFactCards(
  companyId: string,
  planId: string,
  documents?: { id: string; content: string }[]
): Promise<CompanyFactCard[]> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 3, '팩트카드 추출')

  try {
    // 기존 데이터 조회
    const { data: existingFacts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', companyId)

    // 문서가 있으면 AI로 팩트 추출 (Gemini 2.5 Flash)
    if (documents && documents.length > 0) {
      const model = getGeminiModel()
      for (const doc of documents) {
        const extractResult = await model.generateContent(`다음 회사 문서에서 사업계획서 작성에 활용할 수 있는 핵심 팩트를 추출해주세요.

문서 내용:
${doc.content}

다음 카테고리별로 팩트를 JSON 배열로 추출해주세요:
- company_info: 기업 기본 정보
- technology: 기술 현황, R&D
- team: 팀 구성, 인력
- finance: 재무 정보
- market: 시장 분석, 경쟁사
- product: 제품/서비스
- achievement: 성과, 실적
- intellectual_property: 특허, 지식재산권
- certification: 인증, 허가

형식:
[
  {
    "category": "technology",
    "fact_key": "core_tech",
    "fact_value": "AI 기반 자연어 처리 기술",
    "fact_type": "text",
    "confidence_score": 0.9
  }
]`)

        const responseText = extractResult.response.text() || ''

        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const extractedFacts = JSON.parse(jsonMatch[0])

          // 팩트카드 저장
          const factsToInsert = extractedFacts.map((f: any) => ({
            company_id: companyId,
            category: f.category,
            fact_key: f.fact_key,
            fact_value: f.fact_value,
            fact_type: f.fact_type || 'text',
            source: 'document',
            source_document_id: doc.id,
            confidence_score: f.confidence_score || 0.8,
            is_verified: false
          }))

          if (factsToInsert.length > 0) {
            await supabase.from('company_fact_cards').insert(factsToInsert)
          }
        }
      }
    }

    // 전체 팩트카드 반환
    const { data: allFacts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', companyId)
      .order('category')

    await completeStageLog(logId, 'completed', {
      total_facts: allFacts?.length || 0
    })

    return allFacts as CompanyFactCard[]
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 4: 섹션-팩트 매핑
// =====================================================

export async function mapFactsToSections(
  planId: string,
  templateId: string
): Promise<void> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 4, '섹션-팩트 매핑')

  try {
    // 플랜 정보 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select('*, template_id')
      .eq('id', planId)
      .single()

    if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

    // 템플릿 별도 조회
    let template: any = null
    if (plan.template_id) {
      const { data: templateData } = await supabase
        .from('business_plan_templates')
        .select('*')
        .eq('id', plan.template_id)
        .single()
      template = templateData
    }

    // 팩트카드 조회
    const { data: facts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', plan.company_id)

    // 템플릿 섹션
    const sections = (template?.sections || []) as TemplateSection[]

    console.log(`[mapFactsToSections] 템플릿 섹션 ${sections.length}개, 팩트카드 ${facts?.length || 0}개`)

    // 각 섹션에 대해 생성 및 팩트 매핑
    for (const section of sections) {
      // 1. 먼저 섹션 생성/조회 (팩트 유무와 관계없이)
      const { data: planSection, error: sectionError } = await supabase
        .from('business_plan_sections')
        .upsert({
          plan_id: planId,
          section_key: section.section_id,
          section_title: section.title,
          section_order: section.order,
          max_char_limit: section.max_chars
        }, {
          onConflict: 'plan_id,section_key'
        })
        .select()
        .single()

      if (sectionError) {
        console.error(`[mapFactsToSections] 섹션 생성 오류 (${section.title}):`, sectionError)
        continue
      }

      console.log(`[mapFactsToSections] 섹션 생성됨: ${section.title} (ID: ${planSection?.id})`)

      // 2. 팩트가 있으면 AI 매핑 수행 (Gemini 2.5 Flash)
      if (facts && facts.length > 0 && planSection) {
        const model = getGeminiModel()
        try {
          const mappingResult = await model.generateContent(`다음 사업계획서 섹션과 팩트카드 간의 관련도를 분석해주세요.

섹션:
- 제목: ${section.title}
- 가이드라인: ${section.guidelines || '없음'}

팩트카드:
${facts.map((f, i) => `${i + 1}. [${f.category}] ${f.fact_key}: ${f.fact_value}`).join('\n')}

각 팩트의 관련도 점수(0.0~1.0)를 JSON 배열로 반환해주세요:
[
  { "fact_index": 1, "relevance_score": 0.8 },
  ...
]

관련도가 0.3 이상인 팩트만 포함해주세요.`)

          const responseText = mappingResult.response.text() || ''
          const jsonMatch = responseText.match(/\[[\s\S]*\]/)

          if (jsonMatch) {
            const mappings = JSON.parse(jsonMatch[0])

            // 매핑 저장
            for (const mapping of mappings) {
              const fact = facts[mapping.fact_index - 1]
              if (fact) {
                await supabase.from('section_fact_mappings').upsert({
                  section_id: planSection.id,
                  fact_id: fact.id,
                  relevance_score: mapping.relevance_score,
                  mapping_type: 'auto'
                }, {
                  onConflict: 'section_id,fact_id'
                })
              }
            }
          }
        } catch (mappingError) {
          console.error(`[mapFactsToSections] 팩트 매핑 오류 (${section.title}):`, mappingError)
          // 매핑 실패해도 계속 진행
        }
      }
    }

    await completeStageLog(logId, 'completed', {
      sections_mapped: sections.length
    })
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 5: 섹션별 초안 생성
// =====================================================

export async function generateSectionDrafts(
  planId: string
): Promise<BusinessPlanSection[]> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 5, '섹션별 초안 생성')

  try {
    // 플랜 및 섹션 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select(`
        *,
        template_id,
        program:government_programs(title, organization)
      `)
      .eq('id', planId)
      .single()

    if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

    // 템플릿 별도 조회
    let template: any = null
    if (plan.template_id) {
      const { data: templateData } = await supabase
        .from('business_plan_templates')
        .select('*')
        .eq('id', plan.template_id)
        .single()
      template = templateData
    }

    const { data: sections } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)
      .order('section_order')

    let totalTokens = 0
    const generatedSections: BusinessPlanSection[] = []

    for (const section of sections || []) {
      // 해당 섹션의 매핑된 팩트 조회
      const { data: mappings } = await supabase
        .from('section_fact_mappings')
        .select('*, fact:company_fact_cards(*)')
        .eq('section_id', section.id)
        .gte('relevance_score', 0.3)
        .order('relevance_score', { ascending: false })

      const relevantFacts = mappings?.map(m => m.fact).filter(Boolean) || []

      // AI로 콘텐츠 생성 (Gemini 2.5 Flash)
      const model = getGeminiModel()
      const generateResult = await model.generateContent(`당신은 최고 수준의 Business Strategy Consultant입니다.
단순히 빈칸을 채우는 것이 아니라, **"투자자가 당장이라도 미팅하고 싶게 만드는 매력적인 사업계획"**을 설계해야 합니다.

[Writing Strategy]
1. **Logic Flow**: 모든 섹션은 "Why Now?"(시장 기회) -> "Why Us?"(차별점) -> "How?"(실행 계획)의 논리적 구조를 가져야 합니다.
2. **Validation**: 주장을 할 때는 항상 근거(시장 규모, 경쟁사 대비 우위, 기술적 장벽)를 제시하십시오. 근거 팩트가 없다면 "합리적인 시장 추정치"를 가설로 제시하십시오.
3. **Professionalism**: 짧은 문장보다는 논리적 연결이 확실한 복문을 사용하고, "시장 진입 장벽", "네트워크 효과", "유닛 이코노믹스" 등 투자자가 선호하는 용어를 적재적소에 배치하십시오.

[Critical Guidelines]
- 빈약한 내용은 용납되지 않습니다. 팩트가 1개라면, 그 팩트가 가진 함의(Implication)와 파급 효과(Impact)를 서술하여 내용을 3배로 확장하십시오.
- "~할 것 같습니다"라는 추측성 표현을 금지합니다. "~할 전략임", "~추정됨 (근거: CAGR 5% 적용 시)"와 같이 작성하십시오.
- 문단을 적절히 나누고, 가독성을 위해 불렛 포인트를 사용하십시오.

다음 팩트들을 재료로 삼아 "${section.section_title}" 섹션을 작성해주십시오.

[Target Section]
- Title: ${section.section_title}
- Goal: ${(template?.sections as TemplateSection[])?.find(s => s.section_id === section.section_key)?.guidelines || '해당 항목의 핵심 경쟁력을 증명'}
- Constraints: Max ${section.max_char_limit || 2000} chars

[Context]
- Project: ${plan.program?.title || plan.title}
- Agency: ${plan.program?.organization || ''}

[Available Facts (Ingredients)]
${relevantFacts.map(f => `- ${f.category} > ${f.fact_key}: ${f.fact_value}`).join('\n') || '(주의: 직접적인 팩트 없음. 해당 산업의 Best Practice와 일반적인 성공 방정식을 적용하여 논리적으로 창작할 것)'}

[Execution Order]
1. 먼저 이 섹션에서 평가위원이 가장 중요하게 볼 포인트가 무엇인지 판단하십시오.
2. 주어진 팩트를 그 포인트에 맞춰 재배치하십시오.
3. 팩트가 부족한 부분은 "업계 표준 성장률"이나 "일반적인 수익 모델" 등을 차용하여 논리적 구멍을 메우십시오.
4. 제목을 제외한 본문만 전문적으로 출력하십시오.`)

      const content = generateResult.response.text() || ''

      // Gemini는 usage 정보를 다르게 제공하므로 대략적 토큰 추정
      totalTokens += Math.ceil(content.length / 4)

      // 플레이스홀더 추출
      const placeholders: { placeholder_id: string; text: string; question: string }[] = []
      const placeholderRegex = /\{\{미확정:\s*([^}]+)\}\}/g
      let match
      while ((match = placeholderRegex.exec(content)) !== null) {
        placeholders.push({
          placeholder_id: `ph_${Date.now()}_${placeholders.length}`,
          text: match[0],
          question: match[1]
        })
      }

      // 섹션 업데이트
      const { data: updatedSection } = await supabase
        .from('business_plan_sections')
        .update({
          content: content,
          ai_generated: true,
          source_facts: relevantFacts.map(f => f.id),
          char_count: content.length,
          has_placeholders: placeholders.length > 0,
          placeholders: placeholders
        })
        .eq('id', section.id)
        .select()
        .single()

      if (updatedSection) {
        generatedSections.push(updatedSection as BusinessPlanSection)
      }

      // 매핑 업데이트 (사용됨 표시)
      if (mappings) {
        await supabase
          .from('section_fact_mappings')
          .update({ used_in_generation: true })
          .in('id', mappings.map(m => m.id))
      }
    }

    // 플랜 진행 상태 업데이트
    await supabase
      .from('business_plans')
      .update({
        pipeline_stage: 5,
        pipeline_status: 'generating',
        total_tokens_used: (plan.total_tokens_used || 0) + totalTokens
      })
      .eq('id', planId)

    await completeStageLog(logId, 'completed', {
      sections_generated: generatedSections.length,
      tokens_used: totalTokens
    })

    return generatedSections
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 6: 자동 검증
// =====================================================

export async function validateSections(
  planId: string
): Promise<{ section_id: string; status: string; messages: ValidationMessage[] }[]> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 6, '자동 검증')

  try {
    const { data: plan } = await supabase
      .from('business_plans')
      .select('*, template_id')
      .eq('id', planId)
      .single()

    const { data: sections } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)

    const validationResults: { section_id: string; status: string; messages: ValidationMessage[] }[] = []
    let totalCompletion = 0

    for (const section of sections || []) {
      const messages: ValidationMessage[] = []
      let status: 'valid' | 'warning' | 'invalid' = 'valid'

      // 글자 수 검증
      if (section.max_char_limit) {
        if (section.char_count > section.max_char_limit) {
          messages.push({
            type: 'error',
            message: `글자 수 초과: ${section.char_count}자 (제한: ${section.max_char_limit}자)`,
            field: 'char_count'
          })
          status = 'invalid'
        } else if (section.char_count > section.max_char_limit * 0.9) {
          messages.push({
            type: 'warning',
            message: `글자 수 제한에 근접: ${section.char_count}자 (제한: ${section.max_char_limit}자)`,
            field: 'char_count'
          })
          if (status === 'valid') status = 'warning'
        }
      }

      // 최소 글자 수 검증
      const minChars = 200
      if (section.char_count < minChars) {
        messages.push({
          type: 'warning',
          message: `내용이 너무 짧습니다: ${section.char_count}자 (권장: ${minChars}자 이상)`,
          field: 'char_count'
        })
        if (status === 'valid') status = 'warning'
      }

      // 플레이스홀더 검증
      if (section.has_placeholders) {
        messages.push({
          type: 'warning',
          message: `미확정 정보 ${section.placeholders?.length || 0}개가 있습니다`,
          field: 'placeholders'
        })
        if (status === 'valid') status = 'warning'
      }

      // 빈 섹션 검증
      if (!section.content || section.content.trim().length === 0) {
        messages.push({
          type: 'error',
          message: '섹션 내용이 비어있습니다',
          field: 'content'
        })
        status = 'invalid'
      }

      // 섹션 완성도 계산
      let sectionCompletion = 0
      if (section.content && section.char_count > minChars) {
        sectionCompletion = 50
        if (!section.has_placeholders) sectionCompletion += 30
        if (status === 'valid') sectionCompletion += 20
      }
      totalCompletion += sectionCompletion

      // 검증 결과 저장
      await supabase
        .from('business_plan_sections')
        .update({
          validation_status: status,
          validation_messages: messages
        })
        .eq('id', section.id)

      validationResults.push({
        section_id: section.id,
        status,
        messages
      })
    }

    // 전체 완성도 계산
    const avgCompletion = sections && sections.length > 0
      ? Math.round(totalCompletion / sections.length)
      : 0

    await supabase
      .from('business_plans')
      .update({
        pipeline_stage: 6,
        pipeline_status: 'validating',
        completion_percentage: avgCompletion
      })
      .eq('id', planId)

    await completeStageLog(logId, 'completed', {
      sections_validated: validationResults.length,
      valid_count: validationResults.filter(r => r.status === 'valid').length,
      warning_count: validationResults.filter(r => r.status === 'warning').length,
      invalid_count: validationResults.filter(r => r.status === 'invalid').length
    })

    return validationResults
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 7: 미확정 정보 질문 생성
// =====================================================

export async function generateQuestions(
  planId: string
): Promise<PlanQuestion[]> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 7, '미확정 정보 질문 생성')

  try {
    const { data: sections } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)
      .eq('has_placeholders', true)

    const questions: Partial<PlanQuestion>[] = []

    for (const section of sections || []) {
      for (const placeholder of section.placeholders || []) {
        questions.push({
          plan_id: planId,
          section_id: section.id,
          question_text: `[${section.section_title}] ${placeholder.question}`,
          question_type: 'text',
          context: `이 정보는 "${section.section_title}" 섹션 작성에 필요합니다.`,
          placeholder_id: placeholder.placeholder_id,
          priority: 2,
          is_required: true,
          status: 'pending'
        })
      }
    }

    if (questions.length > 0) {
      const { data: insertedQuestions } = await supabase
        .from('plan_questions')
        .insert(questions)
        .select()

      await supabase
        .from('business_plans')
        .update({
          pipeline_stage: 7,
          pipeline_status: 'reviewing'
        })
        .eq('id', planId)

      await completeStageLog(logId, 'completed', {
        questions_generated: insertedQuestions?.length || 0
      })

      return insertedQuestions as PlanQuestion[]
    }

    await completeStageLog(logId, 'skipped', { reason: '미확정 정보 없음' })
    return []
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

// =====================================================
// Stage 8: 최종 문서 생성
// =====================================================

export async function generateFinalDocument(
  planId: string,
  format: 'pdf' | 'hwp' | 'docx' = 'pdf'
): Promise<{ url: string; format: string }> {
  const supabase = createAdminClient()

  const logId = await startStageLog(planId, 8, '최종 문서 생성')

  try {
    const { data: plan } = await supabase
      .from('business_plans')
      .select(`
        *,
        template_id,
        program:government_programs(title, organization)
      `)
      .eq('id', planId)
      .single()

    // 템플릿 별도 조회
    let template: any = null
    if (plan?.template_id) {
      const { data: templateData } = await supabase
        .from('business_plan_templates')
        .select('*')
        .eq('id', plan.template_id)
        .single()
      template = templateData
    }

    const { data: sections } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)
      .order('section_order')

    // HTML 문서 생성
    const htmlContent = generateDocumentHtml(plan, sections || [], template)

    // 실제 구현에서는 PDF/HWP 변환 서비스 호출
    // 여기서는 HTML을 저장하고 URL 반환

    // Supabase Storage에 저장
    const fileName = `business-plans/${planId}/${Date.now()}.html`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, htmlContent, {
        contentType: 'text/html',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    await supabase
      .from('business_plans')
      .update({
        pipeline_stage: 8,
        pipeline_status: 'completed',
        completion_percentage: 100
      })
      .eq('id', planId)

    await completeStageLog(logId, 'completed', {
      format,
      file_path: fileName
    })

    return {
      url: urlData.publicUrl,
      format: 'html' // 실제로는 변환된 format
    }
  } catch (error) {
    await completeStageLog(logId, 'failed', { error: String(error) })
    throw error
  }
}

function generateDocumentHtml(plan: any, sections: BusinessPlanSection[], template: any): string {
  const formatting = template?.formatting_rules || {}

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${plan.title}</title>
  <style>
    body {
      font-family: ${formatting.font_family || '맑은 고딕'}, sans-serif;
      font-size: ${formatting.font_size || 11}pt;
      line-height: ${formatting.line_spacing || 1.5};
      margin: 2cm;
      color: #333;
    }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 2em; }
    h2 { font-size: 14pt; margin-top: 1.5em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
    p { text-align: justify; margin: 0.5em 0; }
    .section { margin-bottom: 2em; }
    .placeholder { background: #fff3cd; padding: 2px 4px; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>${plan.title}</h1>
  ${sections.map(section => `
    <div class="section">
      <h2>${section.section_title}</h2>
      <div>${(section.content || '').replace(/\n/g, '<br>').replace(/\{\{미확정:[^}]+\}\}/g, '<span class="placeholder">$&</span>')}</div>
    </div>
  `).join('')}
</body>
</html>
  `.trim()
}

// =====================================================
// 유틸리티 함수
// =====================================================

async function startStageLog(
  planId: string,
  stage: number,
  stageName: string
): Promise<string> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('pipeline_execution_logs')
    .insert({
      plan_id: planId,
      stage,
      stage_name: stageName,
      status: 'started',
      started_at: new Date().toISOString()
    })
    .select()
    .single()

  return data?.id || ''
}

async function completeStageLog(
  logId: string,
  status: 'completed' | 'failed' | 'skipped',
  outputData?: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const now = new Date()

  const { data: log } = await supabase
    .from('pipeline_execution_logs')
    .select('started_at')
    .eq('id', logId)
    .single()

  const startTime = log?.started_at ? new Date(log.started_at) : now
  const durationMs = now.getTime() - startTime.getTime()

  await supabase
    .from('pipeline_execution_logs')
    .update({
      status,
      completed_at: now.toISOString(),
      duration_ms: durationMs,
      output_data: outputData,
      error_message: status === 'failed' ? String(outputData?.error) : null
    })
    .eq('id', logId)
}

// =====================================================
// 파이프라인 실행 (전체)
// =====================================================

export async function runPipeline(
  planId: string,
  stages?: PipelineStage[],
  options?: {
    skip_success_patterns?: boolean
    force_regenerate?: boolean
    skip_interview?: boolean  // 인터뷰 모드 스킵 옵션
  }
): Promise<PipelineProgress & { needsInterview?: boolean; interviewQuestions?: PlanQuestion[] }> {
  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('business_plans')
    .select(`
      *,
      template_id
    `)
    .eq('id', planId)
    .single()

  if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

  // 템플릿 별도 조회
  let template: any = null
  if (plan.template_id) {
    const { data: templateData } = await supabase
      .from('business_plan_templates')
      .select('*')
      .eq('id', plan.template_id)
      .single()
    template = templateData
  }

  // ============================================
  // Stage 0: 데이터 충족도 체크 (인터뷰 모드)
  // ============================================
  if (!options?.skip_interview) {
    const templateSections = (template?.sections || getDefaultTemplate().sections) as TemplateSection[]
    const sufficiency = await checkDataSufficiency(plan.company_id, templateSections)

    console.log(`[Pipeline] 데이터 충족도: ${sufficiency.overallScore}% (충족: ${sufficiency.sufficient})`)

    // 데이터 부족 → 인터뷰 모드 진입
    if (!sufficiency.sufficient) {
      console.log(`[Pipeline] 인터뷰 모드 진입 - ${sufficiency.requiredQuestions.length}개 질문 필요`)

      // 인터뷰 질문 생성
      const interviewQuestions = await generateInterviewQuestions(
        plan.company_id,
        planId,
        templateSections
      )

      return {
        plan_id: planId,
        current_stage: 0,
        stage_name: '인터뷰 모드 (데이터 수집)',
        status: 'collecting',
        completion_percentage: sufficiency.overallScore,
        stages_completed: [],
        stages_pending: [1, 2, 3, 4, 5, 6, 7, 8] as PipelineStage[],
        estimated_remaining_seconds: 0,
        total_tokens_used: plan.total_tokens_used || 0,
        total_cost: plan.generation_cost || 0,
        // 인터뷰 모드 추가 정보
        needsInterview: true,
        interviewQuestions
      }
    }
  }

  // ============================================
  // 기존 파이프라인 실행 (데이터 충분한 경우)
  // ============================================
  const stagesToRun = stages || [1, 2, 3, 4, 5, 6, 7, 8] as PipelineStage[]
  const completedStages: PipelineStage[] = []
  let totalTokens = plan.total_tokens_used || 0

  for (const stage of stagesToRun) {
    try {
      switch (stage) {
        case 1:
          if (plan.program_id) {
            const parsedTemplate = await parseAnnouncementTemplate(plan.program_id)
            // 템플릿 ID를 plan에 연결
            if (parsedTemplate?.id) {
              await supabase
                .from('business_plans')
                .update({ template_id: parsedTemplate.id })
                .eq('id', planId)
                // 로컬 plan 변수도 업데이트 (Stage 4에서 사용)
                ; (plan as any).template_id = parsedTemplate.id
              template = parsedTemplate
              console.log(`[Pipeline] Stage 1: 템플릿 연결 완료 (template_id: ${parsedTemplate.id})`)
            }
          }
          break
        case 2:
          await collectCompanyData(plan.company_id, planId)
          break
        case 3:
          await extractFactCards(plan.company_id, planId)
          break
        case 4:
          // plan.template_id 또는 template 변수에서 템플릿 ID 확인
          const templateId = (plan as any).template_id || template?.id
          if (templateId) {
            await mapFactsToSections(planId, templateId)
          } else {
            console.warn('[Pipeline] Stage 4 스킵: 템플릿이 없습니다')
          }
          break
        case 5:
          await generateSectionDrafts(planId)
          break
        case 6:
          await validateSections(planId)
          break
        case 7:
          await generateQuestions(planId)
          break
        case 8:
          await generateFinalDocument(planId)
          break
      }
      completedStages.push(stage)
    } catch (error) {
      console.error(`Stage ${stage} failed:`, error)
      break
    }
  }

  const { data: updatedPlan } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  return {
    plan_id: planId,
    current_stage: updatedPlan?.pipeline_stage || 0,
    stage_name: PIPELINE_STAGES[updatedPlan?.pipeline_stage || 0]?.name || '',
    status: updatedPlan?.pipeline_status || 'draft',
    completion_percentage: updatedPlan?.completion_percentage || 0,
    stages_completed: completedStages,
    stages_pending: stagesToRun.filter(s => !completedStages.includes(s)),
    estimated_remaining_seconds: 0,
    total_tokens_used: updatedPlan?.total_tokens_used || 0,
    total_cost: updatedPlan?.generation_cost || 0,
    needsInterview: false
  }
}
