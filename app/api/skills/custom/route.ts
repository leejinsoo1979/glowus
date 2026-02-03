/**
 * Custom Skills CRUD API
 * Claude Code CLI가 직접 스킬을 생성/조회/수정/삭제할 수 있는 API
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

export const runtime = 'nodejs'

interface CustomSkill {
  name: string
  content: string
  category?: string
  description?: string
  keywords?: string[]
  createdAt?: string
  updatedAt?: string
}

// 스킬 폴더 경로
function getSkillsDir(projectPath: string): string {
  return path.join(projectPath, '.claude', 'skills')
}

// 스킬 파일 경로
function getSkillPath(projectPath: string, skillName: string): string {
  const safeName = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return path.join(getSkillsDir(projectPath), `${safeName}.md`)
}

// 스킬 파일 파싱
function parseSkillFile(content: string, name: string): CustomSkill {
  const lines = content.split('\n')
  let category: string | undefined
  let description: string | undefined
  const keywords: string[] = []

  // 메타데이터 추출
  for (const line of lines) {
    if (line.startsWith('# ')) continue
    if (line.startsWith('## 카테고리') || line.startsWith('## Category')) {
      const idx = lines.indexOf(line)
      if (lines[idx + 1]) category = lines[idx + 1].trim()
    }
    if (line.startsWith('## 목적') || line.startsWith('## Purpose')) {
      const idx = lines.indexOf(line)
      if (lines[idx + 1]) description = lines[idx + 1].trim()
    }
    if (line.startsWith('## 키워드') || line.startsWith('## Keywords')) {
      const idx = lines.indexOf(line)
      if (lines[idx + 1]) {
        keywords.push(...lines[idx + 1].split(',').map(k => k.trim()))
      }
    }
  }

  return { name, content, category, description, keywords }
}

// 스킬 마크다운 생성
function generateSkillMarkdown(skill: Partial<CustomSkill>): string {
  const sections: string[] = []

  sections.push(`# ${skill.name || 'Untitled Skill'}`)
  sections.push('')

  if (skill.category) {
    sections.push('## 카테고리')
    sections.push(skill.category)
    sections.push('')
  }

  if (skill.description) {
    sections.push('## 목적')
    sections.push(skill.description)
    sections.push('')
  }

  if (skill.keywords?.length) {
    sections.push('## 키워드')
    sections.push(skill.keywords.join(', '))
    sections.push('')
  }

  if (skill.content && !skill.content.startsWith('#')) {
    sections.push('## 지침')
    sections.push(skill.content)
  } else if (skill.content) {
    // 이미 마크다운 형식이면 그대로 사용
    return skill.content
  }

  return sections.join('\n')
}

/**
 * GET /api/skills/custom
 * 모든 커스텀 스킬 조회
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectPath = searchParams.get('projectPath') || process.cwd()
  const skillName = searchParams.get('name')

  try {
    const skillsDir = getSkillsDir(projectPath)

    // 폴더 존재 확인
    try {
      await fs.access(skillsDir)
    } catch {
      // 폴더 없으면 빈 배열 반환
      return NextResponse.json({ success: true, skills: [] })
    }

    // 특정 스킬 조회
    if (skillName) {
      const skillPath = getSkillPath(projectPath, skillName)
      try {
        const content = await fs.readFile(skillPath, 'utf-8')
        const stat = await fs.stat(skillPath)
        const skill = parseSkillFile(content, skillName)
        skill.createdAt = stat.birthtime.toISOString()
        skill.updatedAt = stat.mtime.toISOString()
        return NextResponse.json({ success: true, skill })
      } catch {
        return NextResponse.json({ success: false, error: `Skill '${skillName}' not found` }, { status: 404 })
      }
    }

    // 모든 스킬 조회
    const files = await fs.readdir(skillsDir)
    const skills: CustomSkill[] = []

    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const filePath = path.join(skillsDir, file)
      const content = await fs.readFile(filePath, 'utf-8')
      const stat = await fs.stat(filePath)
      const name = file.replace('.md', '')
      const skill = parseSkillFile(content, name)
      skill.createdAt = stat.birthtime.toISOString()
      skill.updatedAt = stat.mtime.toISOString()
      skills.push(skill)
    }

    return NextResponse.json({ success: true, skills, count: skills.length })

  } catch (error) {
    console.error('[Skills API] GET error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/skills/custom
 * 새 스킬 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, content, category, description, keywords, projectPath = process.cwd() } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Skill name is required' }, { status: 400 })
    }

    const skillsDir = getSkillsDir(projectPath)
    const skillPath = getSkillPath(projectPath, name)

    // 폴더 생성
    await fs.mkdir(skillsDir, { recursive: true })

    // 이미 존재하는지 확인
    try {
      await fs.access(skillPath)
      return NextResponse.json({ success: false, error: `Skill '${name}' already exists. Use PUT to update.` }, { status: 409 })
    } catch {
      // 존재하지 않음 - 계속 진행
    }

    // 마크다운 생성
    const markdown = generateSkillMarkdown({ name, content, category, description, keywords })

    // 파일 저장
    await fs.writeFile(skillPath, markdown, 'utf-8')

    return NextResponse.json({
      success: true,
      message: `Skill '${name}' created`,
      path: skillPath,
      skill: { name, content: markdown, category, description, keywords }
    })

  } catch (error) {
    console.error('[Skills API] POST error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * PUT /api/skills/custom
 * 스킬 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, content, category, description, keywords, projectPath = process.cwd() } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Skill name is required' }, { status: 400 })
    }

    const skillPath = getSkillPath(projectPath, name)

    // 존재 확인
    try {
      await fs.access(skillPath)
    } catch {
      return NextResponse.json({ success: false, error: `Skill '${name}' not found` }, { status: 404 })
    }

    // 기존 내용 읽기 (병합용)
    const existingContent = await fs.readFile(skillPath, 'utf-8')
    const existingSkill = parseSkillFile(existingContent, name)

    // 새 내용 병합
    const updatedSkill: Partial<CustomSkill> = {
      name,
      content: content ?? existingSkill.content,
      category: category ?? existingSkill.category,
      description: description ?? existingSkill.description,
      keywords: keywords ?? existingSkill.keywords,
    }

    // 마크다운 생성
    const markdown = content?.startsWith('#') ? content : generateSkillMarkdown(updatedSkill)

    // 파일 저장
    await fs.writeFile(skillPath, markdown, 'utf-8')

    return NextResponse.json({
      success: true,
      message: `Skill '${name}' updated`,
      path: skillPath,
      skill: updatedSkill
    })

  } catch (error) {
    console.error('[Skills API] PUT error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * DELETE /api/skills/custom
 * 스킬 삭제
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const projectPath = searchParams.get('projectPath') || process.cwd()

  if (!name) {
    return NextResponse.json({ success: false, error: 'Skill name is required' }, { status: 400 })
  }

  try {
    const skillPath = getSkillPath(projectPath, name)

    // 존재 확인
    try {
      await fs.access(skillPath)
    } catch {
      return NextResponse.json({ success: false, error: `Skill '${name}' not found` }, { status: 404 })
    }

    // 파일 삭제
    await fs.unlink(skillPath)

    return NextResponse.json({
      success: true,
      message: `Skill '${name}' deleted`,
      path: skillPath
    })

  } catch (error) {
    console.error('[Skills API] DELETE error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
