/**
 * Jarvis Browser Automation
 * 스크립트 기반 브라우저 자동화 + AI 폴백
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ============================================
// Types
// ============================================

export interface BrowserScript {
  id: string
  userId: string | null
  siteDomain: string
  siteName: string | null
  actionName: string
  actionDescription: string | null
  triggerKeywords: string[]
  scriptType: 'playwright' | 'puppeteer' | 'applescript'
  scriptCode: string
  variables: ScriptVariable[]
  successCount: number
  failCount: number
  isActive: boolean
  isPublic: boolean
}

export interface ScriptVariable {
  name: string
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  default?: any
  description?: string
}

export interface BrowserTaskResult {
  success: boolean
  message?: string
  error?: string
  usedScript?: boolean
  scriptId?: string
  tokensUsed?: number
  executionTimeMs?: number
}

// ============================================
// 스크립트 매칭
// ============================================

/**
 * 사용자 요청에서 도메인과 작업을 추출
 */
export function extractDomainAndAction(instruction: string): {
  domain: string | null
  keywords: string[]
} {
  const lowerInstruction = instruction.toLowerCase()

  // 도메인 매핑
  const domainMap: Record<string, string[]> = {
    'coupang.com': ['쿠팡', 'coupang'],
    'naver.com': ['네이버', 'naver'],
    'google.com': ['구글', 'google'],
    'youtube.com': ['유튜브', 'youtube'],
    'gmarket.com': ['지마켓', 'gmarket'],
    '11st.co.kr': ['11번가', '11st'],
    'amazon.com': ['아마존', 'amazon'],
    'netflix.com': ['넷플릭스', 'netflix'],
  }

  let domain: string | null = null
  for (const [d, keywords] of Object.entries(domainMap)) {
    if (keywords.some(k => lowerInstruction.includes(k))) {
      domain = d
      break
    }
  }

  // 키워드 추출
  const keywords = lowerInstruction.split(/\s+/).filter(w => w.length > 1)

  return { domain, keywords }
}

/**
 * 저장된 스크립트 찾기
 */
export async function findMatchingScript(
  userId: string | null,
  instruction: string
): Promise<BrowserScript | null> {
  const supabase = createAdminClient()
  const { domain, keywords } = extractDomainAndAction(instruction)

  if (!domain) return null

  // 1. 도메인으로 스크립트 조회
  let query = supabase
    .from('browser_scripts')
    .select('*')
    .eq('site_domain', domain)
    .eq('is_active', true)
    .order('success_count', { ascending: false })

  // 본인 스크립트 또는 공개 스크립트
  if (userId) {
    query = query.or(`user_id.eq.${userId},is_public.eq.true`)
  } else {
    query = query.eq('is_public', true)
  }

  const { data: scripts, error } = await query

  if (error || !scripts || scripts.length === 0) return null

  // 2. 키워드 매칭으로 가장 적합한 스크립트 찾기
  let bestMatch: any = null
  let bestScore = 0

  for (const script of scripts) {
    const triggerKeywords = script.trigger_keywords || []
    let score = 0

    for (const kw of triggerKeywords) {
      if (keywords.some(k => k.includes(kw.toLowerCase()) || kw.toLowerCase().includes(k))) {
        score++
      }
    }

    // 작업 설명도 매칭
    if (script.action_description) {
      const descWords = script.action_description.toLowerCase().split(/\s+/)
      for (const word of descWords) {
        if (keywords.includes(word)) score += 0.5
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = script
    }
  }

  if (!bestMatch || bestScore < 1) return null

  return {
    id: bestMatch.id,
    userId: bestMatch.user_id,
    siteDomain: bestMatch.site_domain,
    siteName: bestMatch.site_name,
    actionName: bestMatch.action_name,
    actionDescription: bestMatch.action_description,
    triggerKeywords: bestMatch.trigger_keywords || [],
    scriptType: bestMatch.script_type,
    scriptCode: bestMatch.script_code,
    variables: bestMatch.variables || [],
    successCount: bestMatch.success_count,
    failCount: bestMatch.fail_count,
    isActive: bestMatch.is_active,
    isPublic: bestMatch.is_public,
  }
}

/**
 * 사용자 요청에서 변수 추출
 */
export function extractVariables(
  instruction: string,
  scriptVariables: ScriptVariable[]
): Record<string, any> {
  const extracted: Record<string, any> = {}

  for (const v of scriptVariables) {
    // 기본값 설정
    if (v.default !== undefined) {
      extracted[v.name] = v.default
    }

    // 변수 추출 로직 (간단한 휴리스틱)
    if (v.name === 'productName' || v.name === 'query') {
      // "에어팟을 장바구니에 담아" → "에어팟"
      // "OOO 검색해" → "OOO"
      const patterns = [
        /(.+?)을?\s*(장바구니|카트|담|구매|검색|찾)/,
        /검색\s*[:\-]?\s*(.+)/,
        /(.+?)\s*(틀어|재생|봐)/,
      ]

      for (const pattern of patterns) {
        const match = instruction.match(pattern)
        if (match) {
          extracted[v.name] = match[1].trim()
          break
        }
      }

      // 패턴 매칭 실패시 주요 명사 추출
      if (!extracted[v.name]) {
        const words = instruction.split(/\s+/)
        const stopWords = ['에서', '을', '를', '좀', '해줘', '해', '담아', '검색', '찾아', '틀어', '재생']
        const nouns = words.filter(w => !stopWords.some(s => w.includes(s)) && w.length > 1)
        if (nouns.length > 0) {
          extracted[v.name] = nouns[0]
        }
      }
    }

    if (v.name === 'sortByPrice') {
      extracted[v.name] = instruction.includes('최저가') || instruction.includes('싼')
    }
  }

  return extracted
}

// ============================================
// 스크립트 실행
// ============================================

/**
 * Playwright로 스크립트 실행
 */
export async function executePlaywrightScript(
  scriptCode: string,
  variables: Record<string, any>
): Promise<BrowserTaskResult> {
  // 로컬 서버에서 실행
  const JARVIS_LOCAL_URL = process.env.JARVIS_LOCAL_URL || 'http://localhost:3099'
  const JARVIS_API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me'

  try {
    const response = await fetch(`${JARVIS_LOCAL_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JARVIS_API_SECRET}`,
      },
      body: JSON.stringify({
        tool: 'run_browser_script',
        args: { scriptCode, variables },
      }),
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }

    const result = await response.json()
    return {
      success: result.success,
      message: result.message,
      error: result.error,
      usedScript: true,
      executionTimeMs: result.executionTimeMs,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      usedScript: true,
    }
  }
}

// ============================================
// 실행 로그
// ============================================

/**
 * 스크립트 실행 로그 저장
 */
export async function logScriptExecution(
  userId: string | null,
  scriptId: string | null,
  siteDomain: string,
  actionName: string,
  variablesUsed: Record<string, any>,
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT',
  executionTimeMs?: number,
  errorMessage?: string,
  wasAiFallback: boolean = false,
  aiTokensUsed?: number
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('browser_script_logs').insert({
    user_id: userId,
    script_id: scriptId,
    site_domain: siteDomain,
    action_name: actionName,
    variables_used: variablesUsed,
    status,
    execution_time_ms: executionTimeMs,
    error_message: errorMessage,
    was_ai_fallback: wasAiFallback,
    ai_tokens_used: aiTokensUsed,
  })

  // 스크립트 통계 업데이트
  if (scriptId) {
    if (status === 'SUCCESS') {
      await supabase
        .from('browser_scripts')
        .update({
          success_count: supabase.rpc('increment', { row_id: scriptId, field: 'success_count' }) as any,
          last_success_at: new Date().toISOString(),
        })
        .eq('id', scriptId)
    } else {
      await supabase
        .from('browser_scripts')
        .update({
          fail_count: supabase.rpc('increment', { row_id: scriptId, field: 'fail_count' }) as any,
          last_fail_at: new Date().toISOString(),
          last_fail_reason: errorMessage,
        })
        .eq('id', scriptId)
    }
  }
}

/**
 * 스크립트 성공률 기반 활성화/비활성화
 */
export async function updateScriptStatus(scriptId: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: script } = await supabase
    .from('browser_scripts')
    .select('success_count, fail_count')
    .eq('id', scriptId)
    .single()

  if (!script) return

  const total = script.success_count + script.fail_count
  if (total < 5) return // 최소 5회 실행 후 판단

  const successRate = script.success_count / total

  // 성공률 30% 미만이면 비활성화
  if (successRate < 0.3) {
    await supabase
      .from('browser_scripts')
      .update({ is_active: false })
      .eq('id', scriptId)
  }
}

// ============================================
// 스크립트 학습 (AI가 새 스크립트 생성)
// ============================================

/**
 * AI 실행 결과로 새 스크립트 저장
 */
export async function saveLearnedScript(
  userId: string,
  siteDomain: string,
  actionName: string,
  actionDescription: string,
  triggerKeywords: string[],
  scriptCode: string,
  variables: ScriptVariable[]
): Promise<string | null> {
  const supabase = createAdminClient()

  // 중복 체크
  const { data: existing } = await supabase
    .from('browser_scripts')
    .select('id')
    .eq('user_id', userId)
    .eq('site_domain', siteDomain)
    .eq('action_name', actionName)
    .single()

  if (existing) {
    // 업데이트
    await supabase
      .from('browser_scripts')
      .update({
        script_code: scriptCode,
        variables,
        version: supabase.rpc('increment', { row_id: existing.id, field: 'version' }) as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return existing.id
  }

  // 새로 생성
  const { data, error } = await supabase
    .from('browser_scripts')
    .insert({
      user_id: userId,
      site_domain: siteDomain,
      site_name: extractSiteName(siteDomain),
      action_name: actionName,
      action_description: actionDescription,
      trigger_keywords: triggerKeywords,
      script_type: 'playwright',
      script_code: scriptCode,
      variables,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[BrowserAutomation] Save script error:', error)
    return null
  }

  return data?.id
}

function extractSiteName(domain: string): string {
  const nameMap: Record<string, string> = {
    'coupang.com': '쿠팡',
    'naver.com': '네이버',
    'google.com': '구글',
    'youtube.com': '유튜브',
    'gmarket.com': '지마켓',
    '11st.co.kr': '11번가',
    'amazon.com': '아마존',
  }
  return nameMap[domain] || domain.split('.')[0]
}

// ============================================
// 메인 실행 함수 (Jarvis 라우터용)
// ============================================

/**
 * 브라우저 작업 실행 (스크립트 우선, AI 폴백)
 */
export async function executeBrowserTask(
  userId: string | null,
  instruction: string
): Promise<BrowserTaskResult> {
  const startTime = Date.now()

  // 1. 저장된 스크립트 찾기
  const script = await findMatchingScript(userId, instruction)

  if (script) {
    console.log(`[BrowserAutomation] 📜 Found script: ${script.siteDomain}/${script.actionName}`)

    // 2. 변수 추출
    const variables = extractVariables(instruction, script.variables)
    console.log(`[BrowserAutomation] 📝 Variables:`, variables)

    // 3. 필수 변수 체크
    const missingRequired = script.variables
      .filter(v => v.required && !variables[v.name])
      .map(v => v.name)

    if (missingRequired.length > 0) {
      return {
        success: false,
        error: `필수 정보 누락: ${missingRequired.join(', ')}`,
        usedScript: true,
        scriptId: script.id,
      }
    }

    // 4. 스크립트 실행
    const result = await executePlaywrightScript(script.scriptCode, variables)
    result.scriptId = script.id
    result.executionTimeMs = Date.now() - startTime

    // 5. 로그 저장
    await logScriptExecution(
      userId,
      script.id,
      script.siteDomain,
      script.actionName,
      variables,
      result.success ? 'SUCCESS' : 'FAILED',
      result.executionTimeMs,
      result.error,
      false
    )

    // 6. 스크립트 상태 업데이트
    await updateScriptStatus(script.id)

    return result
  }

  // 스크립트 없음 - AI 폴백 필요
  console.log(`[BrowserAutomation] ⚠️ No script found, AI fallback needed`)

  return {
    success: false,
    error: 'NO_SCRIPT_FOUND',
    message: '저장된 스크립트가 없습니다. AI로 실행하시겠습니까?',
    usedScript: false,
  }
}
