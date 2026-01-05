// @ts-nocheck
// =====================================================
// 사업계획서 자동생성 파이프라인 서비스
// =====================================================

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
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

// Anthropic 클라이언트
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// =====================================================
// Stage 1: 공고문 양식 파싱
// =====================================================

export async function parseAnnouncementTemplate(
  programId: string,
  documentUrl?: string
): Promise<BusinessPlanTemplate> {
  const supabase = await createClient()

  // 로그 시작
  const logId = await startStageLog(programId, 1, '공고문 양식 파싱')

  try {
    // 공고문 정보 조회
    const { data: program } = await supabase
      .from('government_programs')
      .select('*')
      .eq('id', programId)
      .single()

    if (!program) {
      throw new Error('프로그램을 찾을 수 없습니다')
    }

    // AI로 공고문 구조 파싱
    const parseResult = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `다음 정부지원사업 공고문을 분석하여 사업계획서 작성 양식을 추출해주세요.

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

공고문에 명시된 정보가 없는 경우 일반적인 정부지원사업 양식을 기준으로 추정해주세요.`
        }
      ]
    })

    const responseText = parseResult.content[0].type === 'text'
      ? parseResult.content[0].text
      : ''

    // JSON 추출
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultTemplate()

    // 템플릿 저장
    const { data: template, error } = await supabase
      .from('business_plan_templates')
      .upsert({
        program_id: programId,
        template_name: `${program.title} 양식`,
        template_version: '1.0',
        source_document_url: documentUrl,
        sections: parsedData.sections || [],
        evaluation_criteria: parsedData.evaluation_criteria || [],
        required_attachments: parsedData.required_attachments || [],
        writing_guidelines: parsedData.writing_guidelines || {},
        formatting_rules: parsedData.formatting_rules || {},
        parsing_status: 'completed'
      }, {
        onConflict: 'program_id'
      })
      .select()
      .single()

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

// =====================================================
// Stage 2: 회사 데이터 수집
// =====================================================

export async function collectCompanyData(
  companyId: string,
  planId: string
): Promise<CompanyFactCard[]> {
  const supabase = await createClient()

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
  const supabase = await createClient()

  const logId = await startStageLog(planId, 3, '팩트카드 추출')

  try {
    // 기존 데이터 조회
    const { data: existingFacts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', companyId)

    // 문서가 있으면 AI로 팩트 추출
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const extractResult = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: `다음 회사 문서에서 사업계획서 작성에 활용할 수 있는 핵심 팩트를 추출해주세요.

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
]`
            }
          ]
        })

        const responseText = extractResult.content[0].type === 'text'
          ? extractResult.content[0].text
          : ''

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
  const supabase = await createClient()

  const logId = await startStageLog(planId, 4, '섹션-팩트 매핑')

  try {
    // 플랜 정보 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select('*, template:business_plan_templates(*)')
      .eq('id', planId)
      .single()

    if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

    // 팩트카드 조회
    const { data: facts } = await supabase
      .from('company_fact_cards')
      .select('*')
      .eq('company_id', plan.company_id)

    // 템플릿 섹션
    const sections = (plan.template?.sections || []) as TemplateSection[]

    // 각 섹션에 대해 관련 팩트 매핑
    for (const section of sections) {
      // AI로 관련도 분석
      const mappingResult = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `다음 사업계획서 섹션과 팩트카드 간의 관련도를 분석해주세요.

섹션:
- 제목: ${section.title}
- 가이드라인: ${section.guidelines || '없음'}

팩트카드:
${facts?.map((f, i) => `${i + 1}. [${f.category}] ${f.fact_key}: ${f.fact_value}`).join('\n')}

각 팩트의 관련도 점수(0.0~1.0)를 JSON 배열로 반환해주세요:
[
  { "fact_index": 1, "relevance_score": 0.8 },
  ...
]

관련도가 0.3 이상인 팩트만 포함해주세요.`
          }
        ]
      })

      const responseText = mappingResult.content[0].type === 'text'
        ? mappingResult.content[0].text
        : ''

      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch && facts) {
        const mappings = JSON.parse(jsonMatch[0])

        // 섹션 생성/조회
        const { data: planSection } = await supabase
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

        // 매핑 저장
        for (const mapping of mappings) {
          const fact = facts[mapping.fact_index - 1]
          if (fact && planSection) {
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
  const supabase = await createClient()

  const logId = await startStageLog(planId, 5, '섹션별 초안 생성')

  try {
    // 플랜 및 섹션 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select(`
        *,
        template:business_plan_templates(*),
        program:government_programs(title, organization)
      `)
      .eq('id', planId)
      .single()

    if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

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

      // AI로 콘텐츠 생성
      const generateResult = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `당신은 정부지원사업 사업계획서 전문 작성자입니다.

다음 정보를 바탕으로 "${section.section_title}" 섹션을 작성해주세요.

[공고 정보]
- 사업명: ${plan.program?.title || plan.title}
- 주관기관: ${plan.program?.organization || ''}

[작성 가이드라인]
${(plan.template?.sections as TemplateSection[])?.find(s => s.section_id === section.section_key)?.guidelines || '구체적이고 명확하게 작성'}

[글자 수 제한]
최대 ${section.max_char_limit || 3000}자

[활용 가능한 회사 정보]
${relevantFacts.map(f => `- ${f.fact_key}: ${f.fact_value}`).join('\n') || '(정보 없음)'}

[작성 요령]
1. 구체적인 수치와 데이터를 활용하세요
2. 평가위원 관점에서 설득력 있게 작성하세요
3. 누락된 정보는 {{미확정: 설명}}으로 표시하세요
4. 전문적이고 객관적인 문체를 사용하세요

섹션 내용만 작성해주세요 (제목 제외):`
          }
        ]
      })

      const content = generateResult.content[0].type === 'text'
        ? generateResult.content[0].text
        : ''

      totalTokens += (generateResult.usage?.input_tokens || 0) + (generateResult.usage?.output_tokens || 0)

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
  const supabase = await createClient()

  const logId = await startStageLog(planId, 6, '자동 검증')

  try {
    const { data: plan } = await supabase
      .from('business_plans')
      .select('*, template:business_plan_templates(*)')
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
  const supabase = await createClient()

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
  const supabase = await createClient()

  const logId = await startStageLog(planId, 8, '최종 문서 생성')

  try {
    const { data: plan } = await supabase
      .from('business_plans')
      .select(`
        *,
        template:business_plan_templates(*),
        program:government_programs(title, organization)
      `)
      .eq('id', planId)
      .single()

    const { data: sections } = await supabase
      .from('business_plan_sections')
      .select('*')
      .eq('plan_id', planId)
      .order('section_order')

    // HTML 문서 생성
    const htmlContent = generateDocumentHtml(plan, sections || [])

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

function generateDocumentHtml(plan: any, sections: BusinessPlanSection[]): string {
  const template = plan.template
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
  const supabase = await createClient()

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
  const supabase = await createClient()

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
  }
): Promise<PipelineProgress> {
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (!plan) throw new Error('사업계획서를 찾을 수 없습니다')

  const stagesToRun = stages || [1, 2, 3, 4, 5, 6, 7, 8] as PipelineStage[]
  const completedStages: PipelineStage[] = []
  let totalTokens = plan.total_tokens_used || 0

  for (const stage of stagesToRun) {
    try {
      switch (stage) {
        case 1:
          if (plan.program_id) {
            await parseAnnouncementTemplate(plan.program_id)
          }
          break
        case 2:
          await collectCompanyData(plan.company_id, planId)
          break
        case 3:
          await extractFactCards(plan.company_id, planId)
          break
        case 4:
          if (plan.template_id) {
            await mapFactsToSections(planId, plan.template_id)
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
    total_cost: updatedPlan?.generation_cost || 0
  }
}
