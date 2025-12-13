/**
 * Document Saver
 * Saves agent execution results to project_documents
 */

import { createClient } from '@supabase/supabase-js'
import type { DeployedAgent, ProjectDocumentType } from '@/types/database'
import type { ExecutionResult } from './executor'

// Extended AgentTask with optional project_id (passed from execute API)
interface AgentTaskWithProject {
  id: string
  title: string
  description?: string | null
  instructions?: string
  project_id?: string | null
}

// Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SaveDocumentOptions {
  agent: DeployedAgent
  task: AgentTaskWithProject
  result: ExecutionResult
  projectId?: string // Optional: override project from task
  existingProjectTaskId?: string // If provided, skip creating new project_task
}

/**
 * Determine document type based on task and tools used
 */
function determineDocType(task: AgentTaskWithProject, toolsUsed: string[]): ProjectDocumentType {
  const title = task.title.toLowerCase()
  const instructions = task.instructions?.toLowerCase() || ''

  // Check for specific patterns
  if (toolsUsed.includes('youtube_transcript') || title.includes('유튜브') || title.includes('youtube') || instructions.includes('youtube')) {
    return 'transcript'
  }
  if (title.includes('분석') || instructions.includes('분석')) {
    return 'analysis'
  }
  if (title.includes('요약') || instructions.includes('요약')) {
    return 'summary'
  }
  if (title.includes('리서치') || title.includes('조사') || instructions.includes('리서치') || instructions.includes('조사')) {
    return 'research'
  }
  if (title.includes('리포트') || title.includes('보고서') || instructions.includes('리포트') || instructions.includes('보고서')) {
    return 'report'
  }
  if (title.includes('회의') || instructions.includes('회의')) {
    return 'meeting_notes'
  }

  return 'deliverable'
}

/**
 * Extract source URL from sources
 */
function extractSourceUrl(sources: string[]): { url: string | null; type: string | null } {
  for (const source of sources) {
    if (source.includes('youtube.com') || source.includes('youtu.be')) {
      return { url: source, type: 'youtube' }
    }
    if (source.startsWith('http')) {
      return { url: source, type: 'web' }
    }
  }
  return { url: null, type: null }
}

/**
 * Generate a summary from the output (first 200 chars)
 */
function generateSummary(output: string): string {
  // Remove the sources section if present
  const mainContent = output.split('---')[0].trim()

  // Get first 200 characters
  const summary = mainContent.slice(0, 200)

  // Add ellipsis if truncated
  if (mainContent.length > 200) {
    return summary + '...'
  }
  return summary
}

/**
 * Save agent execution result to project_documents and create project_task
 */
export async function saveResultToDocument(options: SaveDocumentOptions): Promise<{ success: boolean; documentId?: string; projectTaskId?: string; error?: string }> {
  const { agent, task, result, projectId, existingProjectTaskId } = options

  try {
    // Get project_id from task or options
    let finalProjectId = projectId

    // If no project ID, try to get it from the task
    if (!finalProjectId && task.project_id) {
      finalProjectId = task.project_id
    }

    // If still no project ID, try to get from agent_task -> project_task link
    if (!finalProjectId) {
      const { data: agentTask } = await supabaseAdmin
        .from('agent_tasks')
        .select('project_id, task_id')
        .eq('id', task.id)
        .single()

      if (agentTask?.project_id) {
        finalProjectId = agentTask.project_id
      } else if (agentTask?.task_id) {
        // Get project from linked task
        const { data: linkedTask } = await supabaseAdmin
          .from('project_tasks')
          .select('project_id')
          .eq('id', agentTask.task_id)
          .single()

        if (linkedTask?.project_id) {
          finalProjectId = linkedTask.project_id
        }
      }
    }

    // If no project, try to get default project from team
    if (!finalProjectId && agent.team_id) {
      const { data: projects } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('team_id', agent.team_id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (projects && projects.length > 0) {
        finalProjectId = projects[0].id
      }
    }

    if (!finalProjectId) {
      console.log('No project found for document, skipping save')
      return { success: false, error: 'No project found for document' }
    }

    // Determine document type
    const docType = determineDocType(task, result.toolsUsed)

    // Extract source info
    const { url: sourceUrl, type: sourceType } = extractSourceUrl(result.sources)

    // Generate summary
    const summary = generateSummary(result.output)

    // Create project_task in DONE status (for kanban board) - only if no existing one
    let projectTaskId = existingProjectTaskId || null

    if (!existingProjectTaskId) {
      const { data: projectTask, error: taskError } = await supabaseAdmin
        .from('project_tasks')
        .insert({
          project_id: finalProjectId,
          title: task.title,
          description: task.description || task.instructions,
          status: 'DONE',
          priority: 'MEDIUM',
          assignee_type: 'agent',
          assignee_agent_id: agent.id,
          agent_result: {
            output: result.output,
            executed_at: new Date().toISOString(),
            success: result.success,
            sources: result.sources || [],
            toolsUsed: result.toolsUsed || [],
          },
          agent_executed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (taskError) {
        console.error('Failed to create project_task:', taskError)
        // Continue anyway - document is more important
      } else {
        projectTaskId = projectTask?.id
      }
    }

    // Create document
    const { data: document, error } = await supabaseAdmin
      .from('project_documents')
      .insert({
        project_id: finalProjectId,
        task_id: projectTaskId || null,
        agent_task_id: task.id,
        title: task.title,
        content: result.output,
        summary,
        doc_type: docType,
        source_url: sourceUrl,
        source_type: sourceType,
        created_by_type: 'agent',
        created_by_agent_id: agent.id,
        tags: result.toolsUsed,
        metadata: {
          tools_used: result.toolsUsed,
          sources: result.sources,
          task_instructions: task.instructions,
          execution_success: result.success,
        },
        status: 'published',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to save document:', error)
      return { success: false, error: error.message }
    }

    console.log(`📄 Document saved: ${document.id} (${docType}) for project ${finalProjectId}`)
    if (projectTaskId && !existingProjectTaskId) {
      console.log(`✅ Project task created: ${projectTaskId} (DONE)`)
    }
    return { success: true, documentId: document.id, projectTaskId: projectTaskId ?? undefined }
  } catch (error) {
    console.error('Document save error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Check if a document already exists for this task
 */
export async function documentExistsForTask(taskId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('project_documents')
    .select('id')
    .eq('agent_task_id', taskId)
    .limit(1)

  return !!(data && data.length > 0)
}
