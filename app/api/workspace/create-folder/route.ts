import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const runtime = 'nodejs'

// 🔥 서버 측에서 프로젝트 워크스페이스 폴더 생성
// 웹 환경에서도 실제 폴더를 생성하여 터미널이 작동하도록 함
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { projectName, projectId } = body

    if (!projectName) {
      return NextResponse.json({ error: '프로젝트 이름이 필요합니다' }, { status: 400 })
    }

    // 워크스페이스 루트 경로 설정
    // ~/Documents/GlowUS-Projects/ 또는 서버 환경에 맞게 조정
    const homeDir = os.homedir()
    const documentsDir = path.join(homeDir, 'Documents')
    const workspaceRoot = path.join(documentsDir, 'GlowUS-Projects')

    // Documents 폴더가 없으면 홈 디렉토리 사용
    const baseDir = fs.existsSync(documentsDir) ? workspaceRoot : path.join(homeDir, 'GlowUS-Projects')

    // 워크스페이스 루트 폴더 생성
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
      console.log('[Workspace] Created workspace root:', baseDir)
    }

    // 프로젝트 이름 정리 (파일 시스템에 안전한 이름으로)
    const safeName = projectName
      .replace(/[<>:"/\\|?*]/g, '-')  // 특수문자 제거
      .replace(/\s+/g, '-')            // 공백을 하이픈으로
      .replace(/-+/g, '-')             // 연속 하이픈 제거
      .replace(/^-|-$/g, '')           // 앞뒤 하이픈 제거
      .substring(0, 100)               // 최대 100자

    // 프로젝트 폴더 경로
    let projectPath = path.join(baseDir, safeName)

    // 이미 존재하면 숫자 붙이기
    let counter = 1
    while (fs.existsSync(projectPath)) {
      projectPath = path.join(baseDir, `${safeName}-${counter}`)
      counter++
    }

    // 프로젝트 폴더 생성
    fs.mkdirSync(projectPath, { recursive: true })
    console.log('[Workspace] Created project folder:', projectPath)

    // 프로젝트 DB에 folder_path 업데이트 (projectId가 있으면)
    if (projectId) {
      const { error: updateError } = await (supabase as any)
        .from('projects')
        .update({ folder_path: projectPath })
        .eq('id', projectId)

      if (updateError) {
        console.warn('[Workspace] Failed to update project folder_path:', updateError)
      } else {
        console.log('[Workspace] Updated project folder_path in DB:', projectId, '->', projectPath)
      }
    }

    return NextResponse.json({
      success: true,
      path: projectPath,
      projectId
    })

  } catch (error) {
    console.error('[Workspace] Create folder error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '폴더 생성 실패' },
      { status: 500 }
    )
  }
}
