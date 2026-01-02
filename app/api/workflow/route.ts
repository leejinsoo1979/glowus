/**
 * Workflow API - 워크플로우 CRUD 및 실행
 *
 * 테이블이 없는 경우 인메모리 모드로 동작합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WorkflowEngine, createWorkflowEngine } from '@/lib/workflow/workflow-engine'
import { createWorkflowToolExecutor } from '@/lib/workflow/tool-executors'
import type { WorkflowDefinition, WorkflowStep } from '@/lib/workflow/workflow-types'

// 인메모리 스토리지 (테이블이 없을 때 사용)
const inMemoryWorkflows: Map<string, any> = new Map()
const inMemoryExecutions: Map<string, any> = new Map()
let tableExists = true // 초기값 true, 첫 쿼리에서 확인

/**
 * GET - 워크플로우 목록 조회
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const includeTemplates = searchParams.get('templates') === 'true'

  try {
    // 테이블 존재 여부 확인
    const hasTable = await checkTableExists(supabase)

    if (hasTable) {
      // DB 모드
      let query = supabase
        .from('workflow_definitions')
        .select('id, name, description, category, version, is_template, is_active, created_at, updated_at')
        .eq('is_active', true)

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      const { data: workflows, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // 템플릿도 조회
      let templates: any[] = []
      if (includeTemplates) {
        const { data: templateData } = await supabase
          .from('workflow_templates')
          .select('id, name, description, category, usage_count, variables')
          .eq('is_public', true)

        templates = templateData || []
      }

      return NextResponse.json({
        success: true,
        workflows,
        templates,
        total: (workflows?.length || 0) + templates.length,
      })
    } else {
      // 인메모리 모드
      const workflows = Array.from(inMemoryWorkflows.values())
        .filter(w => w.is_active)
        .filter(w => !category || category === 'all' || w.category === category)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return NextResponse.json({
        success: true,
        workflows,
        templates: [],
        total: workflows.length,
        mode: 'in-memory',
        note: 'DB 테이블이 없어 인메모리 모드로 동작합니다.',
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - 워크플로우 생성 또는 실행
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { action } = body

  try {
    switch (action) {
      case 'create':
        return await createWorkflow(supabase, body)
      case 'execute':
        return await executeWorkflow(supabase, body)
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use "create" or "execute"' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Workflow API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * 테이블 존재 여부 확인
 */
async function checkTableExists(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('workflow_definitions')
      .select('id')
      .limit(1)

    if (error && error.message.includes('schema cache')) {
      tableExists = false
      return false
    }
    tableExists = true
    return true
  } catch {
    tableExists = false
    return false
  }
}

/**
 * 워크플로우 생성
 */
async function createWorkflow(supabase: any, body: any) {
  const { name, description, steps, category, companyId } = body

  if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json(
      { success: false, error: '워크플로우 이름과 최소 1개의 단계가 필요합니다' },
      { status: 400 }
    )
  }

  // 단계 유효성 검사 및 변환
  const workflowSteps: WorkflowStep[] = steps.map((s: any, idx: number) => ({
    id: s.id || `step_${idx + 1}`,
    name: s.name,
    action: {
      type: s.actionType || 'tool',
      tool: s.tool,
      endpoint: s.endpoint,
      method: s.method,
      delayMs: s.delayMs,
    },
    inputs: s.inputs,
    inputMappings: s.inputMappings,
    loop: s.loop,
    branches: s.branches,
    onError: s.onError || 'fail',
    retryCount: s.retryCount,
    timeoutMs: s.timeoutMs,
    nextStepId: s.nextStepId !== undefined ? s.nextStepId : (idx < steps.length - 1 ? (steps[idx + 1]?.id || `step_${idx + 2}`) : null),
  }))

  const workflowId = crypto.randomUUID()
  const now = new Date().toISOString()

  const workflowData = {
    id: workflowId,
    name,
    description,
    version: '1.0.0',
    steps: workflowSteps,
    start_step_id: workflowSteps[0].id,
    category: category || 'custom',
    company_id: companyId,
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  // 테이블 존재 여부 확인
  const hasTable = await checkTableExists(supabase)

  if (hasTable) {
    // DB에 저장
    const { data, error } = await supabase
      .from('workflow_definitions')
      .insert(workflowData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      workflow: data,
      message: `워크플로우 "${name}"이(가) 생성되었습니다.`,
    })
  } else {
    // 인메모리에 저장
    inMemoryWorkflows.set(workflowId, workflowData)

    return NextResponse.json({
      success: true,
      workflow: workflowData,
      message: `워크플로우 "${name}"이(가) 생성되었습니다. (인메모리 모드)`,
      mode: 'in-memory',
      note: 'DB 테이블이 없어 인메모리 모드로 동작합니다. 서버 재시작 시 데이터가 초기화됩니다.',
    })
  }
}

/**
 * 워크플로우 실행
 */
async function executeWorkflow(supabase: any, body: any) {
  const { workflowId, inputs, context } = body

  if (!workflowId) {
    return NextResponse.json(
      { success: false, error: '워크플로우 ID가 필요합니다' },
      { status: 400 }
    )
  }

  // 테이블 존재 여부 확인
  const hasTable = await checkTableExists(supabase)

  let workflowData: any

  if (hasTable) {
    // DB에서 조회
    const { data, error: findError } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (findError || !data) {
      return NextResponse.json(
        { success: false, error: '워크플로우를 찾을 수 없습니다' },
        { status: 404 }
      )
    }
    workflowData = data
  } else {
    // 인메모리에서 조회
    workflowData = inMemoryWorkflows.get(workflowId)
    if (!workflowData) {
      return NextResponse.json(
        { success: false, error: '워크플로우를 찾을 수 없습니다 (인메모리)' },
        { status: 404 }
      )
    }
  }

  // 워크플로우 정의 구성
  const workflow: WorkflowDefinition = {
    id: workflowData.id,
    name: workflowData.name,
    description: workflowData.description,
    version: workflowData.version,
    inputSchema: workflowData.input_schema,
    steps: workflowData.steps as WorkflowStep[],
    startStepId: workflowData.start_step_id,
    category: workflowData.category,
    createdAt: workflowData.created_at,
    updatedAt: workflowData.updated_at,
  }

  // 실행 엔진 생성
  const engine = createWorkflowEngine(createWorkflowToolExecutor(context?.companyId, context?.agentId, context?.userId))

  const executionId = crypto.randomUUID()
  const now = new Date().toISOString()

  if (hasTable) {
    // DB 모드: 실행 인스턴스 생성
    const { data: executionRecord, error: execCreateError } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        status: 'running',
        inputs: inputs || {},
        current_step_id: workflow.startStepId,
        company_id: context?.companyId,
        agent_id: context?.agentId,
        user_id: context?.userId,
      })
      .select()
      .single()

    if (execCreateError) throw execCreateError

    // 이벤트 로깅 함수 (DB)
    const logEvent = async (eventType: string, stepId?: string, data?: any, error?: string) => {
      await supabase.from('workflow_execution_logs').insert({
        execution_id: executionRecord.id,
        event_type: eventType,
        step_id: stepId,
        data,
        error,
      })
    }

    // 이벤트 핸들러 등록
    engine.onEvent(async (event) => {
      await logEvent(event.type, event.stepId, event.data)

      // 실행 상태 업데이트
      if (event.stepId) {
        await supabase
          .from('workflow_executions')
          .update({ current_step_id: event.stepId })
          .eq('id', executionRecord.id)
      }
    })

    try {
      // 워크플로우 실행
      const result = await engine.execute(workflow, {
        workflowId: workflow.id,
        inputs: inputs || {},
        context,
      })

      // 결과 업데이트
      await supabase
        .from('workflow_executions')
        .update({
          status: result.status,
          outputs: result.outputs,
          step_results: result.stepResults,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionRecord.id)

      return NextResponse.json({
        success: true,
        executionId: executionRecord.id,
        workflowName: workflow.name,
        status: result.status,
        outputs: result.outputs,
        stepResults: result.stepResults,
        message: result.status === 'completed'
          ? `워크플로우 "${workflow.name}" 실행이 완료되었습니다.`
          : `워크플로우 "${workflow.name}" 실행이 실패했습니다.`,
      })
    } catch (error: any) {
      // 실패 기록
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionRecord.id)

      await logEvent('failed', undefined, undefined, error.message)

      return NextResponse.json(
        {
          success: false,
          executionId: executionRecord.id,
          error: error.message,
        },
        { status: 500 }
      )
    }
  } else {
    // 인메모리 모드: 실행
    const executionData: {
      id: string
      workflow_id: string
      workflow_version: string
      status: string
      inputs: Record<string, any>
      current_step_id: string
      step_results: Record<string, any>
      started_at: string
      logs: any[]
    } = {
      id: executionId,
      workflow_id: workflow.id,
      workflow_version: workflow.version,
      status: 'running',
      inputs: inputs || {},
      current_step_id: workflow.startStepId,
      step_results: {},
      started_at: now,
      logs: [],
    }

    inMemoryExecutions.set(executionId, executionData)

    // 이벤트 핸들러 (인메모리 로깅)
    engine.onEvent(async (event) => {
      executionData.logs.push({
        event_type: event.type,
        step_id: event.stepId,
        data: event.data,
        timestamp: new Date().toISOString(),
      })
      if (event.stepId) {
        executionData.current_step_id = event.stepId
      }
    })

    try {
      // 워크플로우 실행
      const result = await engine.execute(workflow, {
        workflowId: workflow.id,
        inputs: inputs || {},
        context,
      })

      executionData.status = result.status
      executionData.step_results = result.stepResults || {}

      return NextResponse.json({
        success: true,
        executionId,
        workflowName: workflow.name,
        status: result.status,
        outputs: result.outputs,
        stepResults: result.stepResults,
        message: result.status === 'completed'
          ? `워크플로우 "${workflow.name}" 실행이 완료되었습니다. (인메모리 모드)`
          : `워크플로우 "${workflow.name}" 실행이 실패했습니다.`,
        mode: 'in-memory',
        logs: executionData.logs,
      })
    } catch (error: any) {
      executionData.status = 'failed'

      return NextResponse.json(
        {
          success: false,
          executionId,
          error: error.message,
          mode: 'in-memory',
          logs: executionData.logs,
        },
        { status: 500 }
      )
    }
  }
}
