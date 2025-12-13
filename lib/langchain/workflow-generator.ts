import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import type { WorkflowTemplateTask, ProjectTaskPriority } from '@/types/database'

interface WorkflowGenerationInput {
  projectName: string
  projectDescription: string
  projectType?: string
  deadline?: string
  teamSize?: number
  customInstructions?: string
}

interface GeneratedWorkflow {
  tasks: WorkflowTemplateTask[]
  summary: string
  estimatedTotalHours: number
}

const WORKFLOW_GENERATION_PROMPT = `당신은 프로젝트 관리 전문가입니다. 주어진 프로젝트 정보를 바탕으로 최적의 워크플로우(태스크 목록)를 생성해주세요.

## 프로젝트 정보
- 이름: {projectName}
- 설명: {projectDescription}
- 타입: {projectType}
- 마감일: {deadline}
- 팀 규모: {teamSize}명
{customInstructions}

## 요구사항
1. 프로젝트를 완료하기 위한 논리적인 태스크 순서를 생성하세요
2. 각 태스크는 구체적이고 실행 가능해야 합니다
3. 태스크 간의 의존성(depends_on)을 올바르게 설정하세요
4. 예상 소요 시간(estimated_hours)을 현실적으로 산정하세요
5. 우선순위(priority)를 적절히 배분하세요

## 출력 형식 (JSON)
{{
  "tasks": [
    {{
      "title": "태스크 제목",
      "description": "상세 설명",
      "position": 1,
      "estimated_hours": 4,
      "priority": "HIGH",
      "depends_on": [],
      "category": "기획"
    }}
  ],
  "summary": "워크플로우 요약 설명",
  "estimatedTotalHours": 40
}}

## 주의사항
- position은 1부터 시작하는 순차적 번호입니다
- depends_on은 이 태스크가 시작되기 전에 완료되어야 하는 태스크의 position 배열입니다
- priority는 "LOW", "MEDIUM", "HIGH", "URGENT" 중 하나입니다
- category는 "기획", "디자인", "개발", "테스트", "배포", "마케팅", "기타" 등으로 분류하세요

JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`

export async function generateWorkflow(input: WorkflowGenerationInput): Promise<GeneratedWorkflow> {
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const prompt = PromptTemplate.fromTemplate(WORKFLOW_GENERATION_PROMPT)
  const parser = new JsonOutputParser<GeneratedWorkflow>()

  const chain = prompt.pipe(model).pipe(parser)

  const result = await chain.invoke({
    projectName: input.projectName,
    projectDescription: input.projectDescription || '설명 없음',
    projectType: input.projectType || '일반 프로젝트',
    deadline: input.deadline || '미정',
    teamSize: input.teamSize || 1,
    customInstructions: input.customInstructions
      ? `\n## 추가 지침\n${input.customInstructions}`
      : '',
  })

  // Validate and normalize the result
  const normalizedTasks: WorkflowTemplateTask[] = result.tasks.map((task, index) => ({
    title: task.title,
    description: task.description,
    position: task.position || index + 1,
    estimated_hours: task.estimated_hours || 4,
    priority: validatePriority(task.priority),
    depends_on: task.depends_on || [],
    category: task.category,
    tags: task.tags || [],
  }))

  return {
    tasks: normalizedTasks,
    summary: result.summary,
    estimatedTotalHours: result.estimatedTotalHours || normalizedTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
  }
}

function validatePriority(priority: string | undefined): ProjectTaskPriority {
  const validPriorities: ProjectTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  if (priority && validPriorities.includes(priority as ProjectTaskPriority)) {
    return priority as ProjectTaskPriority
  }
  return 'MEDIUM'
}

// Generate workflow from template
export function generateWorkflowFromTemplate(
  template: { tasks: WorkflowTemplateTask[] },
  projectStartDate?: string
): WorkflowTemplateTask[] {
  const startDate = projectStartDate ? new Date(projectStartDate) : new Date()
  let currentDate = new Date(startDate)

  return template.tasks.map(task => {
    // Calculate start date based on dependencies
    const taskStartDate = new Date(currentDate)

    // Move current date forward by estimated hours (assuming 8-hour workdays)
    const daysNeeded = Math.ceil((task.estimated_hours || 4) / 8)
    currentDate.setDate(currentDate.getDate() + daysNeeded)

    return {
      ...task,
    }
  })
}
