/**
 * Workflow Tools - Super Agent용 워크플로우 도구들
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { WorkflowEngine, createWorkflowEngine } from '@/lib/workflow/workflow-engine'
import type { WorkflowDefinition, WorkflowStep, WorkflowCondition } from '@/lib/workflow/workflow-types'

// 도구 실행기 (실제 구현에서는 에이전트의 도구들과 연결)
const createToolExecutor = (companyId?: string, agentId?: string) => {
  return async (toolName: string, params: Record<string, any>) => {
    // API를 통해 도구 실행
    const response = await fetch('/api/workflow/execute-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, params, companyId, agentId }),
    })
    return response.json()
  }
}

/**
 * 워크플로우 생성 도구
 */
export const createWorkflowTool = new DynamicStructuredTool({
  name: 'create_workflow',
  description: `📋 워크플로우 생성 - 다단계 자동화 작업 정의

기능:
- 여러 단계로 구성된 자동화 워크플로우 생성
- 단계 간 데이터 전달 및 조건부 분기 설정
- 루프(반복) 처리 지원

예시:
- "월말 정산 워크플로우 만들어줘" → 거래조회 → 집계 → 보고서 생성
- "신입사원 온보딩 프로세스" → 계정생성 → 장비요청 → 교육등록`,

  schema: z.object({
    name: z.string().describe('워크플로우 이름'),
    description: z.string().optional().describe('워크플로우 설명'),
    stepsJson: z.string().describe('워크플로우 단계들 (JSON 문자열). 각 단계는 {id, name, tool, inputs?, nextStepId?} 형태'),
    category: z.enum(['hr', 'finance', 'project', 'report', 'notification', 'custom']).optional(),
  }),

  func: async ({ name, description, stepsJson, category }) => {
    const supabase: any = createAdminClient()

    // JSON 문자열에서 단계 파싱
    let steps: any[]
    try {
      steps = JSON.parse(stepsJson)
    } catch {
      return JSON.stringify({ success: false, error: 'steps JSON 파싱 실패' })
    }

    // 단계 변환
    const workflowSteps: WorkflowStep[] = steps.map((s: any, idx: number) => ({
      id: s.id,
      name: s.name,
      action: { type: 'tool' as const, tool: s.tool },
      inputs: s.inputs,
      inputMappings: s.inputFromPrevious?.map((m: any) => ({
        from: `${m.stepId}.result.${m.field}`,
        to: m.as,
      })),
      loop: s.loop ? {
        type: s.loop.type,
        source: s.loop.source,
        count: s.loop.count,
      } : undefined,
      nextStepId: s.nextStepId !== undefined ? s.nextStepId : (steps[idx + 1]?.id || null),
    }))

    const workflowDef = {
      name,
      description,
      version: '1.0.0',
      steps: workflowSteps,
      start_step_id: steps[0]?.id,
      category: category || 'custom',
      is_active: true,
    }

    const { data, error } = await (supabase as any)
      .from('workflow_definitions')
      .insert(workflowDef)
      .select()
      .single()

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      workflow: data,
      message: `워크플로우 "${name}"이(가) 생성되었습니다. ${steps.length}개의 단계로 구성됩니다.`,
    })
  },
})

/**
 * 워크플로우 실행 도구
 */
export const executeWorkflowTool = new DynamicStructuredTool({
  name: 'execute_workflow',
  description: `▶️ 워크플로우 실행 - 정의된 워크플로우를 실행

기능:
- 저장된 워크플로우를 입력값과 함께 실행
- 각 단계의 진행 상황 추적
- 실행 결과 반환

예시:
- "월말 정산 워크플로우 실행해줘"
- "신입사원 온보딩 시작해줘, 이름: 홍길동"`,

  schema: z.object({
    workflowId: z.string().optional().describe('워크플로우 ID'),
    workflowName: z.string().optional().describe('워크플로우 이름으로 검색'),
    inputs: z.any().optional().describe('워크플로우 입력 파라미터 (객체 형태)'),
  }),

  func: async ({ workflowId, workflowName, inputs }) => {
    const supabase: any = createAdminClient()

    // 워크플로우 조회
    let query = (supabase as any).from('workflow_definitions').select('*')

    if (workflowId) {
      query = query.eq('id', workflowId)
    } else if (workflowName) {
      query = query.ilike('name', `%${workflowName}%`)
    } else {
      return JSON.stringify({ success: false, error: '워크플로우 ID 또는 이름을 지정해주세요' })
    }

    const { data: workflowData, error: findError } = await query.single()

    if (findError || !workflowData) {
      return JSON.stringify({ success: false, error: '워크플로우를 찾을 수 없습니다' })
    }

    // 워크플로우 정의 구성
    const workflow: WorkflowDefinition = {
      id: workflowData.id,
      name: workflowData.name,
      description: workflowData.description,
      version: workflowData.version,
      steps: workflowData.steps as WorkflowStep[],
      startStepId: workflowData.start_step_id,
      createdAt: workflowData.created_at,
      updatedAt: workflowData.updated_at,
    }

    // 실행 엔진 생성
    const engine = createWorkflowEngine(createToolExecutor())

    // 실행 인스턴스 기록
    const { data: executionRecord, error: execError } = await (supabase as any)
      .from('workflow_executions')
      .insert({
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        status: 'running',
        inputs: inputs || {},
        current_step_id: workflow.startStepId,
      })
      .select()
      .single()

    if (execError) {
      return JSON.stringify({ success: false, error: execError.message })
    }

    try {
      // 워크플로우 실행
      const result = await engine.execute(workflow, { workflowId: workflow.id, inputs })

      // 결과 업데이트
      await (supabase as any)
        .from('workflow_executions')
        .update({
          status: result.status,
          outputs: result.outputs,
          step_results: result.stepResults,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionRecord.id)

      return JSON.stringify({
        success: true,
        executionId: executionRecord.id,
        status: result.status,
        outputs: result.outputs,
        stepResults: result.stepResults,
        message: `워크플로우 "${workflow.name}" 실행이 ${result.status === 'completed' ? '완료' : '실패'}되었습니다.`,
      })
    } catch (error: any) {
      // 실패 기록
      await (supabase as any)
        .from('workflow_executions')
        .update({
          status: 'failed',
          error: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionRecord.id)

      return JSON.stringify({
        success: false,
        executionId: executionRecord.id,
        error: error.message,
      })
    }
  },
})

/**
 * 워크플로우 목록 조회 도구
 */
export const listWorkflowsTool = new DynamicStructuredTool({
  name: 'list_workflows',
  description: `📋 워크플로우 목록 조회 - 저장된 워크플로우 확인

기능:
- 회사에 저장된 워크플로우 목록 조회
- 카테고리별 필터링
- 템플릿 포함/제외

예시:
- "저장된 워크플로우 보여줘"
- "재무 관련 워크플로우만 보여줘"`,

  schema: z.object({
    category: z.enum(['hr', 'finance', 'project', 'report', 'notification', 'custom', 'all']).optional(),
    includeTemplates: z.boolean().optional().describe('템플릿 포함 여부'),
  }),

  func: async ({ category, includeTemplates }) => {
    const supabase: any = createAdminClient()

    let query = supabase
      .from('workflow_definitions')
      .select('id, name, description, category, version, is_template, created_at')
      .eq('is_active', true)

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (!includeTemplates) {
      query = query.eq('is_template', false)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    // 템플릿도 조회
    let templates: any[] = []
    if (includeTemplates) {
      const { data: templateData } = await (supabase as any)
        .from('workflow_templates')
        .select('id, name, description, category, usage_count')
        .eq('is_public', true)

      templates = templateData || []
    }

    return JSON.stringify({
      success: true,
      workflows: data,
      templates,
      total: (data?.length || 0) + templates.length,
    })
  },
})

/**
 * 워크플로우 실행 이력 조회 도구
 */
export const getWorkflowHistoryTool = new DynamicStructuredTool({
  name: 'get_workflow_history',
  description: `📊 워크플로우 실행 이력 - 과거 실행 기록 조회

기능:
- 워크플로우 실행 이력 조회
- 성공/실패 필터링
- 상세 단계별 결과 확인

예시:
- "최근 워크플로우 실행 이력 보여줘"
- "실패한 워크플로우만 보여줘"`,

  schema: z.object({
    workflowId: z.string().optional().describe('특정 워크플로우 ID'),
    status: z.enum(['all', 'completed', 'failed', 'running']).optional(),
    limit: z.number().optional().describe('조회 개수 (기본: 10)'),
  }),

  func: async ({ workflowId, status, limit = 10 }) => {
    const supabase: any = createAdminClient()

    let query = supabase
      .from('workflow_executions')
      .select(`
        id,
        workflow_id,
        workflow_version,
        status,
        inputs,
        outputs,
        error,
        started_at,
        completed_at,
        workflow_definitions(name)
      `)

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      executions: data?.map((e: any) => ({
        ...e,
        workflowName: e.workflow_definitions?.name,
        duration: e.completed_at
          ? Math.round((new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()) / 1000)
          : null,
      })),
      total: data?.length || 0,
    })
  },
})

/**
 * 워크플로우 템플릿 사용 도구
 */
export const useWorkflowTemplateTool = new DynamicStructuredTool({
  name: 'use_workflow_template',
  description: `📑 워크플로우 템플릿 사용 - 미리 정의된 템플릿으로 워크플로우 생성

기능:
- 시스템 제공 템플릿 사용
- 템플릿 변수 커스터마이징
- 즉시 실행 또는 저장만

예시:
- "월말 재무 정산 템플릿 사용해줘"
- "신입사원 온보딩 템플릿으로 워크플로우 만들어줘"`,

  schema: z.object({
    templateId: z.string().optional().describe('템플릿 ID'),
    templateName: z.string().optional().describe('템플릿 이름으로 검색'),
    variables: z.any().optional().describe('템플릿 변수 값 (객체 형태)'),
    executeNow: z.boolean().optional().describe('즉시 실행 여부'),
    customName: z.string().optional().describe('커스텀 워크플로우 이름'),
  }),

  func: async ({ templateId, templateName, variables, executeNow, customName }) => {
    const supabase: any = createAdminClient()

    // 템플릿 조회
    let query = (supabase as any).from('workflow_templates').select('*')

    if (templateId) {
      query = query.eq('id', templateId)
    } else if (templateName) {
      query = query.ilike('name', `%${templateName}%`)
    } else {
      return JSON.stringify({ success: false, error: '템플릿 ID 또는 이름을 지정해주세요' })
    }

    const { data: template, error: findError } = await query.single()

    if (findError || !template) {
      return JSON.stringify({ success: false, error: '템플릿을 찾을 수 없습니다' })
    }

    // 워크플로우 정의 생성
    const workflowDef = template.workflow_definition as any
    const newWorkflow = {
      name: customName || `${template.name} (템플릿)`,
      description: template.description,
      version: '1.0.0',
      steps: workflowDef.steps,
      start_step_id: workflowDef.startStepId,
      category: template.category,
      is_template: false,
      is_active: true,
    }

    // 워크플로우 저장
    const { data: savedWorkflow, error: saveError } = await (supabase as any)
      .from('workflow_definitions')
      .insert(newWorkflow)
      .select()
      .single()

    if (saveError) {
      return JSON.stringify({ success: false, error: saveError.message })
    }

    // 템플릿 사용 횟수 증가
    await (supabase as any)
      .from('workflow_templates')
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq('id', template.id)

    // 즉시 실행
    if (executeNow) {
      const engine = createWorkflowEngine(createToolExecutor())
      const workflow: WorkflowDefinition = {
        id: savedWorkflow.id,
        name: savedWorkflow.name,
        description: savedWorkflow.description,
        version: savedWorkflow.version,
        steps: savedWorkflow.steps as WorkflowStep[],
        startStepId: savedWorkflow.start_step_id,
        createdAt: savedWorkflow.created_at,
        updatedAt: savedWorkflow.updated_at,
      }

      try {
        const result = await engine.execute(workflow, {
          workflowId: workflow.id,
          inputs: variables,
        })

        return JSON.stringify({
          success: true,
          workflow: savedWorkflow,
          execution: result,
          message: `템플릿 "${template.name}"에서 워크플로우를 생성하고 실행했습니다.`,
        })
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          workflow: savedWorkflow,
          error: error.message,
          message: '워크플로우는 생성되었으나 실행 중 오류가 발생했습니다.',
        })
      }
    }

    return JSON.stringify({
      success: true,
      workflow: savedWorkflow,
      message: `템플릿 "${template.name}"에서 워크플로우 "${savedWorkflow.name}"을(를) 생성했습니다.`,
    })
  },
})

/**
 * 워크플로우 스케줄 설정 도구
 */
export const scheduleWorkflowTool = new DynamicStructuredTool({
  name: 'schedule_workflow',
  description: `⏰ 워크플로우 스케줄 설정 - 자동 실행 예약

기능:
- 일회성 또는 반복 실행 스케줄 설정
- cron 표현식 지원
- 입력값 미리 설정

예시:
- "월말 정산 매월 말일에 실행되게 해줘"
- "일일 보고 매일 오후 6시에 실행"`,

  schema: z.object({
    workflowId: z.string().describe('워크플로우 ID'),
    name: z.string().optional().describe('스케줄 이름'),
    scheduleType: z.enum(['once', 'daily', 'weekly', 'monthly', 'cron']),
    cronExpression: z.string().optional().describe('cron 표현식 (type: cron)'),
    scheduledAt: z.string().optional().describe('일회성 실행 시간 (ISO 형식)'),
    inputs: z.any().optional().describe('실행 시 입력값 (객체 형태)'),
  }),

  func: async ({ workflowId, name, scheduleType, cronExpression, scheduledAt, inputs }) => {
    const supabase: any = createAdminClient()

    // 워크플로우 확인
    const { data: workflow } = await (supabase as any)
      .from('workflow_definitions')
      .select('name')
      .eq('id', workflowId)
      .single()

    if (!workflow) {
      return JSON.stringify({ success: false, error: '워크플로우를 찾을 수 없습니다' })
    }

    // 다음 실행 시간 계산
    let nextRunAt: string | null = null
    if (scheduleType === 'once' && scheduledAt) {
      nextRunAt = scheduledAt
    } else if (scheduleType === 'daily') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      nextRunAt = tomorrow.toISOString()
    }

    const { data, error } = await (supabase as any)
      .from('workflow_schedules')
      .insert({
        workflow_id: workflowId,
        name: name || `${workflow.name} 스케줄`,
        schedule_type: scheduleType,
        cron_expression: cronExpression,
        scheduled_at: scheduleType === 'once' ? scheduledAt : null,
        inputs: inputs || {},
        is_active: true,
        next_run_at: nextRunAt,
      })
      .select()
      .single()

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      schedule: data,
      message: `워크플로우 "${workflow.name}"의 스케줄이 설정되었습니다. (${scheduleType})`,
    })
  },
})

// 모든 워크플로우 도구 내보내기
export const workflowTools = [
  createWorkflowTool,
  executeWorkflowTool,
  listWorkflowsTool,
  getWorkflowHistoryTool,
  useWorkflowTemplateTool,
  scheduleWorkflowTool,
]

export default workflowTools
