/**
 * Workflow Builder Tools - AI가 노드 기반 워크플로우를 생성/실행하는 도구
 * n8n/Make 스타일의 비주얼 워크플로우를 AI가 직접 조작
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { Node, Edge } from 'reactflow'
import type { NodeData } from '@/lib/workflow/types'

// 노드 타입 정의
const nodeTypeSchema = z.enum([
  // Input
  'trigger', 'webhook', 'schedule', 'input',
  // AI
  'ai', 'openai',
  // Data
  'json', 'text', 'math', 'date', 'array', 'set',
  // Process
  'process', 'code',
  // Control
  'conditional', 'switch', 'loop', 'delay', 'wait', 'error', 'merge', 'split',
  // Integration
  'http', 'database', 'supabase', 'googleSheets', 'file', 'slack', 'discord', 'telegram', 'email', 'notification',
  // Output
  'output', 'webhookResponse'
])

// 워크플로우 노드 스키마
const workflowNodeSchema = z.object({
  id: z.string().describe('노드 고유 ID (예: trigger-1, ai-2)'),
  type: nodeTypeSchema.describe('노드 타입'),
  label: z.string().describe('노드 표시 이름'),
  config: z.record(z.any()).optional().describe('노드 설정 (타입별 상이)'),
})

// 워크플로우 연결 스키마
const workflowEdgeSchema = z.object({
  source: z.string().describe('시작 노드 ID'),
  target: z.string().describe('도착 노드 ID'),
  label: z.string().optional().describe('연결 라벨 (조건 분기용)'),
})

/**
 * 워크플로우 빌드 도구 - AI가 노드 기반 워크플로우 생성
 */
export const buildWorkflowTool = new DynamicStructuredTool({
  name: 'build_workflow',
  description: `🔧 워크플로우 빌드 - n8n/Make 스타일의 노드 기반 워크플로우 생성

사용 가능한 노드 (32개):
━━━━━━━━━━━━━━━━━━━━━━
📥 입력: trigger, webhook, schedule, input
🤖 AI: ai (GPT/Claude), openai (GPT/DALL-E/Whisper)
📊 데이터: json, text, math, date, array, set
⚙️ 처리: process (필터/정렬), code (JavaScript)
🔀 제어: conditional (IF), switch, loop, delay, wait, error, merge, split
🔌 통합: http, database, supabase, googleSheets, file, slack, discord, telegram, email, notification
📤 출력: output, webhookResponse

노드 설정 예시:
- ai: { aiModel: "gpt-4o-mini", aiPrompt: "{{input}}", aiTemperature: 0.7 }
- http: { httpMethod: "GET", httpUrl: "https://api.example.com", httpHeaders: "{}" }
- code: { code: "return input.value * 2", codeLanguage: "javascript" }
- conditional: { condition: "data.status == 'active'", trueLabel: "Yes", falseLabel: "No" }
- delay: { delayMs: 1000, delayUnit: "ms" }
- slack: { notificationTarget: "#channel", notificationMessage: "Hello!" }

예시 요청:
- "HTTP로 데이터 가져와서 AI로 분석하고 Slack으로 보내는 워크플로우"
- "매일 9시에 DB 조회해서 이메일 보내는 자동화"`,

  schema: z.object({
    name: z.string().describe('워크플로우 이름'),
    description: z.string().optional().describe('워크플로우 설명'),
    nodes: z.array(workflowNodeSchema).describe('노드 목록'),
    edges: z.array(workflowEdgeSchema).describe('노드 연결 목록'),
  }),

  func: async ({ name, description, nodes, edges }) => {
    try {
      // ReactFlow 노드 형식으로 변환
      const rfNodes: Node<NodeData>[] = nodes.map((node, index) => ({
        id: node.id,
        type: node.type,
        position: { x: 300, y: 100 + index * 150 },
        data: {
          label: node.label,
          description: getNodeDescription(node.type),
          ...node.config,
        },
      }))

      // ReactFlow 엣지 형식으로 변환
      const rfEdges: Edge[] = edges.map((edge, index) => ({
        id: `e${index + 1}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: true,
      }))

      // 워크플로우 정의 객체
      const workflow = {
        name,
        description,
        nodes: rfNodes,
        edges: rfEdges,
        createdAt: new Date().toISOString(),
      }

      return JSON.stringify({
        success: true,
        workflow,
        nodeCount: rfNodes.length,
        message: `워크플로우 "${name}"이(가) 생성되었습니다. ${rfNodes.length}개 노드, ${rfEdges.length}개 연결.`,
        hint: 'run_workflow 도구로 실행하거나, UI에서 편집할 수 있습니다.',
      })
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      })
    }
  },
})

/**
 * 워크플로우 실행 도구 - 생성된 워크플로우 즉시 실행
 */
export const runWorkflowTool = new DynamicStructuredTool({
  name: 'run_workflow',
  description: `▶️ 워크플로우 실행 - 노드 기반 워크플로우를 SSE 스트리밍으로 실행

기능:
- build_workflow로 생성한 워크플로우 실행
- 각 노드 실시간 실행 상태 추적
- 입력 데이터 전달

예시:
- "방금 만든 워크플로우 실행해줘"
- "입력값 { "query": "AI 뉴스" }로 실행"`,

  schema: z.object({
    nodes: z.array(z.any()).describe('실행할 노드 목록 (build_workflow 결과)'),
    edges: z.array(z.any()).describe('노드 연결 목록'),
    inputs: z.record(z.any()).optional().describe('워크플로우 입력 데이터'),
  }),

  func: async ({ nodes, edges, inputs }) => {
    try {
      // SSE API 호출
      const response = await fetch('http://localhost:3000/api/workflow/execute/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, inputs: inputs || {} }),
      })

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`)
      }

      // SSE 스트림 읽기
      const reader = response.body?.getReader()
      if (!reader) throw new Error('스트림을 읽을 수 없습니다')

      const decoder = new TextDecoder()
      const events: any[] = []
      let finalResult: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              events.push(event)

              if (event.type === 'workflow_completed') {
                finalResult = event.data
              } else if (event.type === 'workflow_failed') {
                throw new Error(event.data.error)
              }
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }
      }

      // 실행 요약
      const nodeResults = events
        .filter(e => e.type === 'node_completed')
        .map(e => ({
          nodeId: e.nodeId,
          result: e.data.result,
          duration: e.data.duration,
        }))

      return JSON.stringify({
        success: true,
        executionId: events[0]?.executionId,
        stepsExecuted: finalResult?.stepsExecuted || nodeResults.length,
        outputs: finalResult?.outputs,
        nodeResults,
        message: `워크플로우 실행 완료. ${nodeResults.length}개 노드 실행됨.`,
      })
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      })
    }
  },
})

/**
 * 워크플로우 템플릿 생성 도구 - 자주 사용하는 패턴
 */
export const getWorkflowTemplateTool = new DynamicStructuredTool({
  name: 'get_workflow_template',
  description: `📋 워크플로우 템플릿 - 자주 사용하는 워크플로우 패턴 가져오기

사용 가능한 템플릿:
- api_to_slack: API 호출 → Slack 알림
- ai_analysis: 데이터 → AI 분석 → 결과 출력
- data_pipeline: 입력 → 변환 → 필터 → 출력
- scheduled_report: 스케줄 → DB 조회 → 이메일 발송
- webhook_handler: 웹훅 수신 → 처리 → 응답`,

  schema: z.object({
    template: z.enum([
      'api_to_slack',
      'ai_analysis',
      'data_pipeline',
      'scheduled_report',
      'webhook_handler',
    ]).describe('템플릿 이름'),
  }),

  func: async ({ template }) => {
    const templates: Record<string, any> = {
      api_to_slack: {
        name: 'API → Slack 알림',
        nodes: [
          { id: 'trigger-1', type: 'trigger', label: '시작', config: {} },
          { id: 'http-1', type: 'http', label: 'API 호출', config: { httpMethod: 'GET', httpUrl: 'https://api.example.com/data' } },
          { id: 'slack-1', type: 'slack', label: 'Slack 알림', config: { notificationTarget: '#general', notificationMessage: '{{http-1.data}}' } },
          { id: 'output-1', type: 'output', label: '완료', config: {} },
        ],
        edges: [
          { source: 'trigger-1', target: 'http-1' },
          { source: 'http-1', target: 'slack-1' },
          { source: 'slack-1', target: 'output-1' },
        ],
      },
      ai_analysis: {
        name: 'AI 데이터 분석',
        nodes: [
          { id: 'trigger-1', type: 'trigger', label: '시작', config: {} },
          { id: 'input-1', type: 'input', label: '데이터 입력', config: { dataSource: 'manual', sampleData: '{"text": "분석할 내용"}' } },
          { id: 'ai-1', type: 'ai', label: 'AI 분석', config: { aiModel: 'gpt-4o-mini', aiPrompt: '다음 내용을 분석해주세요:\n{{input}}', aiTemperature: 0.7 } },
          { id: 'output-1', type: 'output', label: '결과', config: {} },
        ],
        edges: [
          { source: 'trigger-1', target: 'input-1' },
          { source: 'input-1', target: 'ai-1' },
          { source: 'ai-1', target: 'output-1' },
        ],
      },
      data_pipeline: {
        name: '데이터 파이프라인',
        nodes: [
          { id: 'trigger-1', type: 'trigger', label: '시작', config: {} },
          { id: 'http-1', type: 'http', label: '데이터 가져오기', config: { httpMethod: 'GET', httpUrl: 'https://api.example.com/items' } },
          { id: 'json-1', type: 'json', label: 'JSON 파싱', config: { jsonOperation: 'get', jsonPath: '$.data' } },
          { id: 'process-1', type: 'process', label: '필터링', config: { processType: 'filter' } },
          { id: 'output-1', type: 'output', label: '결과', config: {} },
        ],
        edges: [
          { source: 'trigger-1', target: 'http-1' },
          { source: 'http-1', target: 'json-1' },
          { source: 'json-1', target: 'process-1' },
          { source: 'process-1', target: 'output-1' },
        ],
      },
      scheduled_report: {
        name: '예약 리포트',
        nodes: [
          { id: 'schedule-1', type: 'schedule', label: '매일 9시', config: { scheduleType: 'cron', scheduleCron: '0 9 * * *' } },
          { id: 'supabase-1', type: 'supabase', label: 'DB 조회', config: { supabaseOperation: 'select', supabaseTable: 'reports' } },
          { id: 'ai-1', type: 'ai', label: '요약 생성', config: { aiModel: 'gpt-4o-mini', aiPrompt: '다음 데이터를 요약해주세요:\n{{input}}' } },
          { id: 'email-1', type: 'email', label: '이메일 발송', config: { notificationTarget: 'team@example.com', notificationMessage: '{{ai-1.content}}' } },
          { id: 'output-1', type: 'output', label: '완료', config: {} },
        ],
        edges: [
          { source: 'schedule-1', target: 'supabase-1' },
          { source: 'supabase-1', target: 'ai-1' },
          { source: 'ai-1', target: 'email-1' },
          { source: 'email-1', target: 'output-1' },
        ],
      },
      webhook_handler: {
        name: '웹훅 핸들러',
        nodes: [
          { id: 'webhook-1', type: 'webhook', label: '웹훅 수신', config: { httpMethod: 'POST' } },
          { id: 'code-1', type: 'code', label: '데이터 처리', config: { code: 'const data = input;\nreturn { processed: true, ...data };', codeLanguage: 'javascript' } },
          { id: 'conditional-1', type: 'conditional', label: '성공 여부', config: { condition: 'processed == true', trueLabel: 'Yes', falseLabel: 'No' } },
          { id: 'webhookResponse-1', type: 'webhookResponse', label: '응답', config: { webhookStatusCode: 200, webhookResponse: '{"success": true}' } },
        ],
        edges: [
          { source: 'webhook-1', target: 'code-1' },
          { source: 'code-1', target: 'conditional-1' },
          { source: 'conditional-1', target: 'webhookResponse-1', label: 'Yes' },
        ],
      },
    }

    const selectedTemplate = templates[template]
    if (!selectedTemplate) {
      return JSON.stringify({ success: false, error: '템플릿을 찾을 수 없습니다' })
    }

    return JSON.stringify({
      success: true,
      template: selectedTemplate,
      message: `"${selectedTemplate.name}" 템플릿을 가져왔습니다. build_workflow나 run_workflow로 사용하세요.`,
    })
  },
})

/**
 * 노드 목록 조회 도구
 */
export const listNodeTypesTool = new DynamicStructuredTool({
  name: 'list_workflow_nodes',
  description: '📚 사용 가능한 워크플로우 노드 목록과 설정 방법 조회',

  schema: z.object({
    category: z.enum(['all', 'input', 'ai', 'data', 'process', 'control', 'integration', 'output']).optional(),
  }),

  func: async ({ category }) => {
    const nodeInfo: Record<string, any> = {
      input: {
        trigger: { desc: '워크플로우 시작점', config: {} },
        webhook: { desc: 'HTTP 웹훅 트리거', config: { httpMethod: 'POST' } },
        schedule: { desc: '예약 실행', config: { scheduleType: 'cron', scheduleCron: '0 9 * * *' } },
        input: { desc: '수동 데이터 입력', config: { dataSource: 'manual', sampleData: '{}' } },
      },
      ai: {
        ai: { desc: 'LLM 텍스트 생성', config: { aiModel: 'gpt-4o-mini', aiPrompt: '{{input}}', aiTemperature: 0.7 } },
        openai: { desc: 'OpenAI API (GPT/DALL-E/Whisper)', config: { openaiOperation: 'chat', aiModel: 'gpt-4o' } },
      },
      data: {
        json: { desc: 'JSON 파싱/변환', config: { jsonOperation: 'parse', jsonPath: '$.data' } },
        text: { desc: '문자열 처리', config: { textOperation: 'replace', textPattern: 'find', textReplacement: 'replace' } },
        math: { desc: '수학 연산', config: { mathOperation: 'sum', mathValues: '[1,2,3]' } },
        date: { desc: '날짜 처리', config: { dateOperation: 'format', dateFormat: 'YYYY-MM-DD' } },
        array: { desc: '배열 조작', config: { arrayOperation: 'filter', arrayConfig: 'item.active === true' } },
        set: { desc: '필드 값 설정', config: { setMode: 'manual', setFields: '{"key": "value"}' } },
      },
      process: {
        process: { desc: '필터/정렬/집계', config: { processType: 'transform' } },
        code: { desc: 'JavaScript 실행', config: { code: 'return input;', codeLanguage: 'javascript' } },
      },
      control: {
        conditional: { desc: 'IF 조건 분기', config: { condition: 'data.value > 0', trueLabel: 'Yes', falseLabel: 'No' } },
        switch: { desc: '다중 분기', config: { switchField: 'status', switchCases: '["a","b","c"]' } },
        loop: { desc: '반복 실행', config: { loopType: 'forEach', loopConfig: 'items' } },
        delay: { desc: '시간 대기', config: { delayMs: 1000, delayUnit: 'ms' } },
        wait: { desc: '이벤트 대기', config: { waitType: 'time', waitTimeout: 60000 } },
        error: { desc: '에러 캐치/재시도', config: { errorType: 'catch', retryCount: 3 } },
        merge: { desc: '데이터 병합', config: { mergeType: 'append' } },
        split: { desc: '데이터 분할', config: { splitType: 'items', splitSize: 10 } },
      },
      integration: {
        http: { desc: 'REST API 호출', config: { httpMethod: 'GET', httpUrl: 'https://...', httpAuth: 'none' } },
        database: { desc: 'DB 쿼리', config: { dbOperation: 'select', dbTable: 'users' } },
        supabase: { desc: 'Supabase 연동', config: { supabaseOperation: 'select', supabaseTable: 'items' } },
        googleSheets: { desc: 'Google Sheets', config: { sheetsOperation: 'read', sheetsRange: 'A1:Z100' } },
        file: { desc: '파일 읽기/쓰기', config: { fileOperation: 'read', filePath: '/data/file.json' } },
        slack: { desc: 'Slack 메시지', config: { notificationTarget: '#channel', notificationMessage: '...' } },
        discord: { desc: 'Discord 웹훅', config: { notificationMessage: '...' } },
        telegram: { desc: '텔레그램 봇', config: { notificationMessage: '...' } },
        email: { desc: '이메일 발송', config: { notificationTarget: 'user@example.com', notificationMessage: '...' } },
        notification: { desc: '멀티채널 알림', config: { notificationType: 'slack', notificationMessage: '...' } },
      },
      output: {
        output: { desc: '워크플로우 결과', config: {} },
        webhookResponse: { desc: 'HTTP 응답 반환', config: { webhookStatusCode: 200, webhookResponse: '{}' } },
      },
    }

    if (category && category !== 'all') {
      return JSON.stringify({
        success: true,
        category,
        nodes: nodeInfo[category] || {},
      })
    }

    return JSON.stringify({
      success: true,
      totalNodes: 32,
      categories: Object.keys(nodeInfo),
      nodes: nodeInfo,
    })
  },
})

// 헬퍼 함수
function getNodeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    trigger: '워크플로우 시작점',
    webhook: 'HTTP 웹훅 트리거',
    schedule: '예약 실행',
    input: '데이터 입력',
    ai: 'AI 텍스트 생성',
    openai: 'OpenAI API',
    json: 'JSON 처리',
    text: '텍스트 처리',
    math: '수학 연산',
    date: '날짜 처리',
    array: '배열 조작',
    set: '필드 설정',
    process: '데이터 처리',
    code: 'JavaScript 실행',
    conditional: 'IF 조건 분기',
    switch: '다중 분기',
    loop: '반복 실행',
    delay: '시간 대기',
    wait: '이벤트 대기',
    error: '에러 처리',
    merge: '데이터 병합',
    split: '데이터 분할',
    http: 'HTTP 요청',
    database: 'DB 쿼리',
    supabase: 'Supabase',
    googleSheets: 'Google Sheets',
    file: '파일 작업',
    slack: 'Slack 메시지',
    discord: 'Discord 메시지',
    telegram: '텔레그램 메시지',
    email: '이메일 발송',
    notification: '알림 전송',
    output: '결과 출력',
    webhookResponse: '웹훅 응답',
  }
  return descriptions[type] || '워크플로우 노드'
}

// 모든 도구 내보내기
export const workflowBuilderTools = [
  buildWorkflowTool,
  runWorkflowTool,
  getWorkflowTemplateTool,
  listNodeTypesTool,
]

export default workflowBuilderTools
