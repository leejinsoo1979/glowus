/**
 * Stagehand Browser Automation Service
 *
 * AI-native browser automation using natural language commands.
 * Supports: act, extract, observe, agent mode
 */

// Dynamic import to avoid SSR issues
let StagehandClass: any = null

async function getStagehandClass() {
  if (!StagehandClass) {
    const module = await import('@browserbasehq/stagehand')
    StagehandClass = module.Stagehand || module.default?.Stagehand || module.default
  }
  return StagehandClass
}

// Type definition for Stagehand instance
type Stagehand = any

// Singleton instance
let stagehandInstance: Stagehand | null = null
let isInitializing = false

export interface StagehandConfig {
  headless?: boolean
  model?: string
  verbose?: boolean
}

export interface ActResult {
  success: boolean
  message: string
  screenshot?: string
}

export interface ExtractResult {
  success: boolean
  data: any
  screenshot?: string
}

export interface ObserveResult {
  success: boolean
  elements: Array<{
    description: string
    selector: string
    action?: string
  }>
}

export interface AgentResult {
  success: boolean
  result: string
  steps: Array<{
    action: string
    result: string
  }>
  screenshot?: string
}

/**
 * Initialize Stagehand instance (singleton)
 */
export async function initStagehand(config: StagehandConfig = {}): Promise<Stagehand> {
  if (stagehandInstance) {
    return stagehandInstance
  }

  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (stagehandInstance) return stagehandInstance
  }

  isInitializing = true

  try {
    console.log('[Stagehand] Initializing...')

    // Dynamic import to get Stagehand class
    const Stagehand = await getStagehandClass()

    if (!Stagehand) {
      throw new Error('Failed to load Stagehand class')
    }

    stagehandInstance = new Stagehand({
      env: 'LOCAL',
      enableCaching: true,
      headless: config.headless ?? false, // 기본값: 브라우저 보이기
      verbose: config.verbose ?? 1,
      // OpenAI 또는 Anthropic 모델 사용
      modelName: config.model || 'gpt-4o',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      },
    })

    await stagehandInstance.init()
    console.log('[Stagehand] ✅ Initialized successfully')

    return stagehandInstance
  } catch (error) {
    console.error('[Stagehand] ❌ Initialization failed:', error)
    stagehandInstance = null
    throw error
  } finally {
    isInitializing = false
  }
}

/**
 * Get current Stagehand instance
 */
export function getStagehand(): Stagehand | null {
  return stagehandInstance
}

/**
 * Close Stagehand instance
 */
export async function closeStagehand(): Promise<void> {
  if (stagehandInstance) {
    await stagehandInstance.close()
    stagehandInstance = null
    console.log('[Stagehand] Closed')
  }
}

/**
 * Navigate to a URL
 */
export async function navigate(url: string): Promise<{ success: boolean; url: string; title: string }> {
  const stagehand = await initStagehand()
  const page = stagehand.context.pages()[0]

  await page.goto(url, { waitUntil: 'domcontentloaded' })

  return {
    success: true,
    url: page.url(),
    title: await page.title(),
  }
}

/**
 * Perform an action using natural language
 */
export async function act(instruction: string): Promise<ActResult> {
  const stagehand = await initStagehand()

  try {
    console.log('[Stagehand] Act:', instruction)
    await stagehand.act(instruction)

    // Capture screenshot after action
    const page = stagehand.context.pages()[0]
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })
    const base64 = screenshot.toString('base64')

    return {
      success: true,
      message: `완료: ${instruction}`,
      screenshot: `data:image/jpeg;base64,${base64}`,
    }
  } catch (error: any) {
    console.error('[Stagehand] Act failed:', error)
    return {
      success: false,
      message: `실패: ${error.message}`,
    }
  }
}

/**
 * Extract structured data from the page
 */
export async function extract(instruction: string, schema?: any): Promise<ExtractResult> {
  const stagehand = await initStagehand()

  try {
    console.log('[Stagehand] Extract:', instruction)

    const data = schema
      ? await stagehand.extract({ instruction, schema })
      : await stagehand.extract(instruction)

    // Capture screenshot
    const page = stagehand.context.pages()[0]
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })
    const base64 = screenshot.toString('base64')

    return {
      success: true,
      data,
      screenshot: `data:image/jpeg;base64,${base64}`,
    }
  } catch (error: any) {
    console.error('[Stagehand] Extract failed:', error)
    return {
      success: false,
      data: null,
    }
  }
}

/**
 * Observe available actions on the page
 */
export async function observe(instruction: string): Promise<ObserveResult> {
  const stagehand = await initStagehand()

  try {
    console.log('[Stagehand] Observe:', instruction)
    const elements = await stagehand.observe(instruction)

    return {
      success: true,
      elements: elements.map((el: any) => ({
        description: el.description,
        selector: el.selector,
        action: el.action,
      })),
    }
  } catch (error: any) {
    console.error('[Stagehand] Observe failed:', error)
    return {
      success: false,
      elements: [],
    }
  }
}

/**
 * Run an autonomous agent to complete a complex task
 */
export async function runAgent(task: string, maxSteps: number = 10): Promise<AgentResult> {
  const stagehand = await initStagehand()
  const steps: Array<{ action: string; result: string }> = []

  try {
    console.log('[Stagehand] Agent task:', task)

    // Create agent with CUA (Computer Use Agent) capability
    const agent = stagehand.agent({
      modelName: 'gpt-4o', // or 'claude-sonnet-4-20250514'
      systemPrompt: `당신은 웹 브라우저를 제어하는 AI 에이전트입니다.
사용자의 요청을 수행하기 위해 브라우저를 탐색하고, 클릭하고, 입력하세요.
한국어로 응답하고, 각 단계를 명확히 설명하세요.

현재 작업: ${task}`,
    })

    const result = await agent.execute(task)

    // Capture final screenshot
    const page = stagehand.context.pages()[0]
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })
    const base64 = screenshot.toString('base64')

    return {
      success: true,
      result: typeof result === 'string' ? result : JSON.stringify(result),
      steps,
      screenshot: `data:image/jpeg;base64,${base64}`,
    }
  } catch (error: any) {
    console.error('[Stagehand] Agent failed:', error)
    return {
      success: false,
      result: `에이전트 실행 실패: ${error.message}`,
      steps,
    }
  }
}

/**
 * Execute a complex workflow with multiple steps
 */
export async function executeWorkflow(
  steps: Array<{
    type: 'navigate' | 'act' | 'extract' | 'wait'
    instruction: string
    schema?: any
  }>
): Promise<{
  success: boolean
  results: Array<{ step: number; type: string; result: any }>
  screenshot?: string
}> {
  const results: Array<{ step: number; type: string; result: any }> = []

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      console.log(`[Stagehand] Workflow step ${i + 1}/${steps.length}:`, step.type, step.instruction)

      let result: any

      switch (step.type) {
        case 'navigate':
          result = await navigate(step.instruction)
          break
        case 'act':
          result = await act(step.instruction)
          break
        case 'extract':
          result = await extract(step.instruction, step.schema)
          break
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, parseInt(step.instruction) || 1000))
          result = { success: true, message: `${step.instruction}ms 대기 완료` }
          break
      }

      results.push({ step: i + 1, type: step.type, result })

      // If any step fails, stop the workflow
      if (!result?.success) {
        return { success: false, results }
      }
    }

    // Capture final screenshot
    const stagehand = getStagehand()
    let screenshot: string | undefined

    if (stagehand) {
      const page = stagehand.context.pages()[0]
      const img = await page.screenshot({ type: 'jpeg', quality: 70 })
      screenshot = `data:image/jpeg;base64,${img.toString('base64')}`
    }

    return { success: true, results, screenshot }
  } catch (error: any) {
    console.error('[Stagehand] Workflow failed:', error)
    return { success: false, results }
  }
}

/**
 * Get current page info
 */
export async function getPageInfo(): Promise<{
  url: string
  title: string
  screenshot: string
}> {
  const stagehand = await initStagehand()
  const page = stagehand.context.pages()[0]

  const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })

  return {
    url: page.url(),
    title: await page.title(),
    screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
  }
}
