/**
 * Company Context Loader
 *
 * 에이전트가 소속 회사 정보를 인식할 수 있도록 컨텍스트 로드
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface CompanyContext {
  id: string
  name: string
  businessNumber: string
  ceoName: string
  address: string
  businessType: string
  businessCategory: string
  website: string | null
  email: string | null
  phone: string | null
  establishmentDate: string | null
  logoUrl: string | null
}

/**
 * 에이전트의 소속 회사 정보 조회
 */
export async function getAgentCompanyContext(agentId: string): Promise<CompanyContext | null> {
  const supabase = createAdminClient()

  try {
    // 에이전트와 연결된 회사 정보 조회
    const { data: agentData, error: agentError } = await supabase
      .from('deployed_agents')
      .select('company_id')
      .eq('id', agentId)
      .single()

    const agent = agentData as any
    if (agentError || !agent?.company_id) {
      console.warn('[CompanyContext] Agent has no company_id:', agentId)
      return null
    }

    // 회사 상세 정보 조회
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', agent.company_id)
      .single()

    const company = companyData as any
    if (companyError || !company) {
      console.warn('[CompanyContext] Company not found:', agent.company_id)
      return null
    }

    return {
      id: company.id,
      name: company.name,
      businessNumber: company.business_number,
      ceoName: company.ceo_name || company.representative,
      address: company.address + (company.address_detail ? ` ${company.address_detail}` : ''),
      businessType: company.business_type,
      businessCategory: company.business_category,
      website: company.website,
      email: company.email,
      phone: company.phone,
      establishmentDate: company.establishment_date,
      logoUrl: company.logo_url,
    }
  } catch (error) {
    console.error('[CompanyContext] Error loading company context:', error)
    return null
  }
}

/**
 * 회사 컨텍스트를 프롬프트용 텍스트로 변환
 */
export function formatCompanyContextForPrompt(company: CompanyContext): string {
  const parts: string[] = [
    `## 🏢 소속 회사 정보`,
    ``,
    `**회사명**: ${company.name}`,
    `**대표이사**: ${company.ceoName}`,
    `**업종**: ${company.businessType}`,
    `**업태**: ${company.businessCategory}`,
    `**주소**: ${company.address}`,
  ]

  if (company.businessNumber) {
    parts.push(`**사업자번호**: ${company.businessNumber}`)
  }

  if (company.website) {
    parts.push(`**웹사이트**: ${company.website}`)
  }

  if (company.email) {
    parts.push(`**이메일**: ${company.email}`)
  }

  if (company.phone) {
    parts.push(`**전화**: ${company.phone}`)
  }

  if (company.establishmentDate) {
    parts.push(`**설립일**: ${company.establishmentDate}`)
  }

  parts.push(``)
  parts.push(`> 이 정보는 너의 소속 회사 정보야. 사용자가 "우리 회사", "회사 정보" 등을 물어보면 이 정보를 기반으로 답변해줘.`)

  return parts.join('\n')
}

/**
 * 에이전트의 회사 컨텍스트 로드 및 포맷
 */
export async function loadAndFormatCompanyContext(agentId: string): Promise<string> {
  const company = await getAgentCompanyContext(agentId)

  if (!company) {
    return ''
  }

  return formatCompanyContextForPrompt(company)
}

export default {
  getAgentCompanyContext,
  formatCompanyContextForPrompt,
  loadAndFormatCompanyContext,
}
