import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { generateWorkflow, generateWorkflowFromTemplate } from '@/lib/langchain/workflow-generator'
import type { GenerateWorkflowInput, WorkflowTemplateTask } from '@/types/database'

interface ProjectData {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  deadline: string | null
}

// POST: Generate workflow for a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let userId: string
    if (isDevMode()) {
      userId = DEV_USER.id
    } else {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
      }
      userId = data.user.id
    }

    const body: GenerateWorkflowInput & { clear_existing?: boolean } = await request.json()

    // Get project info
    const { data: projectData, error: projectError } = await adminClient
      .from('projects')
      .select('id, name, description, start_date, end_date, deadline')
      .eq('id', projectId)
      .single()

    const project = projectData as ProjectData | null

    if (projectError || !project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 })
    }

    let tasks: WorkflowTemplateTask[] = []
    let summary = ''
    let estimatedTotalHours = 0

    // Option 1: Use existing template
    if (body.template_id) {
      const { data: template, error: templateError } = await adminClient
        .from('workflow_templates')
        .select('*')
        .eq('id', body.template_id)
        .single()

      if (templateError || !template) {
        return NextResponse.json({ error: '워크플로우 템플릿을 찾을 수 없습니다' }, { status: 404 })
      }

      tasks = generateWorkflowFromTemplate(template, project.start_date)
      summary = `"${template.name}" 템플릿을 기반으로 워크플로우가 생성되었습니다.`
      estimatedTotalHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
    }
    // Option 2: Generate with AI
    else {
      const result = await generateWorkflow({
        projectName: project.name,
        projectDescription: project.description || '',
        projectType: body.project_type || 'general',
        deadline: project.deadline || project.end_date,
        teamSize: 3, // TODO: Get from project members
        customInstructions: body.custom_prompt,
      })

      tasks = result.tasks
      summary = result.summary
      estimatedTotalHours = result.estimatedTotalHours
    }

    // Clear existing tasks if requested
    if (body.clear_existing) {
      await adminClient
        .from('project_tasks')
        .delete()
        .eq('project_id', projectId)
    }

    // Create position to ID mapping for dependency resolution
    const positionToId: Record<number, string> = {}

    // Insert tasks into database
    const createdTasks: Array<{ id: string; [key: string]: unknown }> = []
    for (const task of tasks) {
      // Resolve dependencies from position to actual IDs
      const dependsOn: string[] = (task.depends_on || [])
        .map(pos => positionToId[pos])
        .filter((id): id is string => id !== undefined)

      const { data: createdTask, error: insertError } = await adminClient
        .from('project_tasks')
        .insert({
          project_id: projectId,
          title: task.title,
          description: task.description,
          status: 'TODO',
          priority: task.priority || 'MEDIUM',
          position: task.position,
          depends_on: dependsOn,
          estimated_hours: task.estimated_hours,
          tags: task.tags || [],
          category: task.category,
          created_by: userId,
        } as Record<string, unknown>)
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create task:', insertError)
        continue
      }

      // Store position to ID mapping
      const taskData = createdTask as { id: string; [key: string]: unknown }
      positionToId[task.position] = taskData.id
      createdTasks.push(taskData)
    }

    // Update project with workflow info
    await adminClient
      .from('projects')
      .update({
        workflow_config: {
          generated_at: new Date().toISOString(),
          template_id: body.template_id,
          summary,
          estimated_total_hours: estimatedTotalHours,
        },
        workflow_template_id: body.template_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    return NextResponse.json({
      tasks: createdTasks,
      summary,
      estimatedTotalHours,
      tasksCreated: createdTasks.length,
    }, { status: 201 })
  } catch (error) {
    console.error('Workflow generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
