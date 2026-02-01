/**
 * Jarvis 도구 핸들러
 * 실제 도구 실행 로직
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

// ============================================
// GlowUS 제어 핸들러
// ============================================

export const glowusHandlers = {
  // 에이전트 목록
  async list_agents(args: { userId: string }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('deployed_agents')
      .select('id, name, description, model, created_at')
      .eq('owner_id', args.userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { agents: data }
  },

  // 에이전트 생성
  async create_agent(args: { userId: string; name: string; description?: string; model?: string }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('deployed_agents')
      .insert({
        owner_id: args.userId,
        name: args.name,
        description: args.description || '',
        model: args.model || 'gpt-4o-mini',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { agent: data, message: `에이전트 "${args.name}" 생성 완료` }
  },

  // 에이전트 삭제
  async delete_agent(args: { userId: string; agentId: string }) {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('deployed_agents')
      .delete()
      .eq('id', args.agentId)
      .eq('owner_id', args.userId)

    if (error) throw new Error(error.message)
    return { message: '에이전트 삭제 완료' }
  },

  // 스킬 목록
  async list_skills(args: { agentId: string }) {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('agent_skills')
      .select('id, name, description, enabled')
      .eq('agent_id', args.agentId)

    if (error) throw new Error(error.message)
    return { skills: data }
  },

  // 스킬 장착
  async equip_skill(args: { agentId: string; skillId: string }) {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('agent_skills')
      .update({ enabled: true })
      .eq('id', args.skillId)
      .eq('agent_id', args.agentId)

    if (error) throw new Error(error.message)
    return { message: '스킬 장착 완료' }
  },

  // 스킬 해제
  async unequip_skill(args: { agentId: string; skillId: string }) {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('agent_skills')
      .update({ enabled: false })
      .eq('id', args.skillId)
      .eq('agent_id', args.agentId)

    if (error) throw new Error(error.message)
    return { message: '스킬 해제 완료' }
  },

  // 프로젝트 목록
  async list_projects(args: { userId: string }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, status, created_at')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { projects: data }
  },

  // 프로젝트 생성
  async create_project(args: { userId: string; name: string; description?: string }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: args.userId,
        name: args.name,
        description: args.description || '',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { project: data, message: `프로젝트 "${args.name}" 생성 완료` }
  },

  // 프로젝트 삭제
  async delete_project(args: { userId: string; projectId: string }) {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', args.projectId)
      .eq('user_id', args.userId)

    if (error) throw new Error(error.message)
    return { message: '프로젝트 삭제 완료' }
  },
}

// ============================================
// PC 제어 핸들러
// ============================================

export const pcHandlers = {
  // 앱 실행 (macOS)
  async launch_app(args: { appName: string }) {
    const { stdout, stderr } = await execAsync(`open -a "${args.appName}"`)
    if (stderr) throw new Error(stderr)
    return { message: `${args.appName} 실행 완료`, output: stdout }
  },

  // 앱 종료 (macOS)
  async kill_app(args: { appName: string }) {
    const { stdout, stderr } = await execAsync(`pkill -x "${args.appName}"`)
    return { message: `${args.appName} 종료 완료`, output: stdout }
  },

  // 실행 중인 앱 목록 (macOS)
  async list_running_apps() {
    const { stdout } = await execAsync(`ps aux | grep -v grep | awk '{print $11}' | sort -u`)
    const apps = stdout.split('\n').filter(Boolean)
    return { apps }
  },

  // 시스템 명령 실행
  async execute_command(args: { command: string; cwd?: string }) {
    const options = args.cwd ? { cwd: args.cwd } : {}
    const { stdout, stderr } = await execAsync(args.command, options)
    return {
      success: true,
      stdout,
      stderr,
    }
  },

  // 시스템 정보
  async get_system_info() {
    const os = require('os')
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
      hostname: os.hostname(),
      uptime: Math.round(os.uptime() / 60) + '분',
    }
  },
}

// ============================================
// 파일 관리 핸들러
// ============================================

export const fileHandlers = {
  // 파일 읽기
  async read_file(args: { path: string }) {
    const content = await fs.readFile(args.path, 'utf-8')
    return { content, path: args.path }
  },

  // 파일 쓰기
  async write_file(args: { path: string; content: string }) {
    await fs.writeFile(args.path, args.content, 'utf-8')
    return { message: `파일 저장 완료: ${args.path}` }
  },

  // 파일 삭제
  async delete_file(args: { path: string }) {
    await fs.unlink(args.path)
    return { message: `파일 삭제 완료: ${args.path}` }
  },

  // 폴더 생성
  async create_folder(args: { path: string }) {
    await fs.mkdir(args.path, { recursive: true })
    return { message: `폴더 생성 완료: ${args.path}` }
  },

  // 폴더 삭제
  async delete_folder(args: { path: string }) {
    await fs.rm(args.path, { recursive: true })
    return { message: `폴더 삭제 완료: ${args.path}` }
  },

  // 디렉토리 목록
  async list_directory(args: { path: string }) {
    const entries = await fs.readdir(args.path, { withFileTypes: true })
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
    }))
    return { items, path: args.path }
  },

  // 파일 이동
  async move_file(args: { from: string; to: string }) {
    await fs.rename(args.from, args.to)
    return { message: `파일 이동 완료: ${args.from} → ${args.to}` }
  },

  // 파일 복사
  async copy_file(args: { from: string; to: string }) {
    await fs.copyFile(args.from, args.to)
    return { message: `파일 복사 완료: ${args.from} → ${args.to}` }
  },

  // 파일/폴더 검색
  async search_files(args: { path: string; query: string; recursive?: boolean }) {
    const results: string[] = []
    const searchDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.name.toLowerCase().includes(args.query.toLowerCase())) {
          results.push(fullPath)
        }
        if (args.recursive && entry.isDirectory()) {
          try {
            await searchDir(fullPath)
          } catch {
            // 권한 없는 폴더 스킵
          }
        }
      }
    }
    await searchDir(args.path)
    return { results, count: results.length, query: args.query }
  },

  // 파일 내용 검색 (grep)
  async search_in_files(args: { path: string; pattern: string; extension?: string }) {
    const { stdout } = await execAsync(
      `grep -r -l "${args.pattern}" "${args.path}"${args.extension ? ` --include="*${args.extension}"` : ''} 2>/dev/null || true`
    )
    const files = stdout.split('\n').filter(Boolean)
    return { files, count: files.length, pattern: args.pattern }
  },
}

// ============================================
// 통합 핸들러 맵
// ============================================

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  // GlowUS
  list_agents: glowusHandlers.list_agents,
  create_agent: glowusHandlers.create_agent,
  delete_agent: glowusHandlers.delete_agent,
  list_skills: glowusHandlers.list_skills,
  equip_skill: glowusHandlers.equip_skill,
  unequip_skill: glowusHandlers.unequip_skill,
  list_projects: glowusHandlers.list_projects,
  create_project: glowusHandlers.create_project,
  delete_project: glowusHandlers.delete_project,

  // PC
  launch_app: pcHandlers.launch_app,
  kill_app: pcHandlers.kill_app,
  list_running_apps: pcHandlers.list_running_apps,
  execute_command: pcHandlers.execute_command,
  get_system_info: pcHandlers.get_system_info,

  // 파일
  read_file: fileHandlers.read_file,
  write_file: fileHandlers.write_file,
  delete_file: fileHandlers.delete_file,
  create_folder: fileHandlers.create_folder,
  delete_folder: fileHandlers.delete_folder,
  list_directory: fileHandlers.list_directory,
  move_file: fileHandlers.move_file,
  copy_file: fileHandlers.copy_file,
  search_files: fileHandlers.search_files,
  search_in_files: fileHandlers.search_in_files,
}

// 핸들러 실행
export async function executeHandler(toolName: string, args: any): Promise<any> {
  const handler = toolHandlers[toolName]
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`)
  }
  return handler(args)
}
