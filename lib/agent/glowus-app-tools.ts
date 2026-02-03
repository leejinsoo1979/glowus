/**
 * GlowUS App Control Tools
 *
 * Claude Code가 GlowUS의 모든 스킬앱을 제어할 수 있는 도구 모음
 * 각 스킬을 개발하고 즉시 사용할 수 있는 구조
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// ============================================
// Types
// ============================================

export interface GlowUSApp {
  id: string
  name: string
  description: string
  category: string
  endpoint?: string  // API endpoint if implemented
  implemented: boolean
}

// ============================================
// App Registry - 모든 GlowUS 앱 목록
// ============================================

export const GLOWUS_APPS: GlowUSApp[] = [
  // === 구현된 앱 ===
  { id: 'ai-summary', name: '유튜브 영상 요약', description: '유튜브 영상을 AI가 완벽하게 요약', category: '업무', endpoint: '/api/ai-summary', implemented: true },
  { id: 'image-gen', name: '이미지 제작', description: '원하는 이미지를 AI가 생성', category: '업무', endpoint: '/api/image-gen', implemented: true },
  { id: 'ai-blog', name: '블로그', description: '블로그 글 자동 작성', category: '부업', endpoint: '/api/ai-blog', implemented: true },
  { id: 'ai-slides', name: 'AI 슬라이드', description: 'PPT 슬라이드 자동 생성', category: '업무', endpoint: '/api/slides/generate', implemented: true },
  { id: 'ai-docs', name: 'AI 문서', description: '문서 자동 작성/편집', category: '업무', endpoint: '/api/docs/generate', implemented: true },
  { id: 'ai-sheet', name: 'AI 시트', description: '스프레드시트 데이터 분석', category: '업무', endpoint: '/api/ai-sheet', implemented: true },
  { id: 'ai-studio', name: 'AI 스튜디오', description: 'PDF, 웹, YouTube 분석 올인원', category: '업무', endpoint: '/api/ai-studio', implemented: true },
  { id: 'government-programs', name: '정부지원사업', description: '정부지원사업 공고 조회', category: '지원사업', endpoint: '/api/government-programs', implemented: true },

  // === 미구현 앱 (개발 필요) ===
  { id: 'ai-realtime-summary', name: 'AI 실시간 요약', description: '실시간 음성 받아쓰기 및 요약', category: '업무', implemented: false },
  { id: 'ai-detection', name: 'AI 탐지 방어', description: 'GPT 탐지 우회 자연스러운 문체', category: '학업', implemented: false },
  { id: 'ppt-draft', name: 'PPT 초안', description: 'PPT 목차와 초안 자동 생성', category: '업무', implemented: false },
  { id: 'sns-post', name: 'SNS 게시물', description: 'SNS 게시글 자동 완성', category: '부업', implemented: false },
  { id: 'article-draft', name: '기사 초안', description: '기사 자료로 초안 생성', category: '업무', implemented: false },
  { id: 'book-report', name: '독후감', description: '책 내용 요약 및 독후감 작성', category: '학업', implemented: false },
  { id: 'report', name: '레포트', description: '과제/레포트/보고서 작성', category: '학업', implemented: false },
  { id: 'interview-prep', name: '면접 준비', description: '면접 예상 질문/답변 생성', category: '취업', implemented: false },
  { id: 'presentation-script', name: '발표 대본', description: '발표 대본 자동 완성', category: '학업', implemented: false },
  { id: 'detail-page', name: '상세페이지', description: '상세페이지 내용 작성', category: '업무', implemented: false },
  { id: 'product-review', name: '상품 리뷰', description: '상품 리뷰 자동 작성', category: '부업', implemented: false },
  { id: 'school-record', name: '생활기록부', description: '학생 생활기록부 완성', category: '학업', implemented: false },
  { id: 'video-scenario', name: '영상 시나리오', description: '영상 시나리오 생성', category: '부업', implemented: false },
  { id: 'resume', name: '이력서', description: '입사/아르바이트 지원서 작성', category: '취업', implemented: false },
  { id: 'cover-letter', name: '자기소개서', description: '입사/입시 자기소개서 작성', category: '취업', implemented: false },
  { id: 'ebook', name: '전자책', description: '전자책 내용 작성', category: '부업', implemented: false },
  { id: 'copywriting', name: '카피라이팅', description: '마케팅 문구 작성', category: '업무', implemented: false },
  { id: 'coding-task', name: '코딩 과제', description: '코딩 과제 해결', category: '학업', implemented: false },
]

// ============================================
// Tool: 앱 목록 조회
// ============================================

export const listGlowUSAppsTool = new DynamicStructuredTool({
  name: 'list_glowus_apps',
  description: 'GlowUS의 모든 스킬앱 목록을 조회합니다. 카테고리별 필터링 가능.',
  schema: z.object({
    category: z.string().optional().describe('카테고리 필터 (업무, 학업, 취업, 부업, 지원사업)'),
    implementedOnly: z.boolean().optional().default(false).describe('구현된 앱만 조회'),
  }),
  func: async ({ category, implementedOnly }) => {
    let apps = GLOWUS_APPS

    if (category) {
      apps = apps.filter(app => app.category === category)
    }

    if (implementedOnly) {
      apps = apps.filter(app => app.implemented)
    }

    return JSON.stringify({
      total: apps.length,
      implemented: apps.filter(a => a.implemented).length,
      apps: apps.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description,
        category: app.category,
        implemented: app.implemented,
      }))
    }, null, 2)
  },
})

// ============================================
// Tool: 앱 실행 (네비게이션)
// ============================================

export const openGlowUSAppTool = new DynamicStructuredTool({
  name: 'open_glowus_app',
  description: 'GlowUS 앱을 엽니다. 앱 ID로 해당 앱 페이지로 이동합니다.',
  schema: z.object({
    appId: z.string().describe('열려는 앱의 ID (예: ai-docs, ai-slides, image-gen)'),
  }),
  func: async ({ appId }) => {
    const app = GLOWUS_APPS.find(a => a.id === appId)

    if (!app) {
      return JSON.stringify({
        success: false,
        error: `앱을 찾을 수 없습니다: ${appId}`,
        availableApps: GLOWUS_APPS.map(a => a.id)
      })
    }

    if (!app.implemented) {
      return JSON.stringify({
        success: false,
        error: `이 앱은 아직 구현되지 않았습니다: ${app.name}`,
        suggestion: '이 스킬을 개발하려면 develop_glowus_skill 도구를 사용하세요.'
      })
    }

    // 앱 URL 매핑
    const appUrls: Record<string, string> = {
      'ai-summary': '/dashboard-group/apps/ai-summary',
      'image-gen': '/dashboard-group/apps/image-gen',
      'ai-blog': '/dashboard-group/apps/ai-blog',
      'ai-slides': '/dashboard-group/apps/ai-slides',
      'ai-docs': '/dashboard-group/apps/ai-docs',
      'ai-sheet': '/dashboard-group/apps/ai-sheet',
      'ai-studio': '/dashboard-group/apps/ai-studio',
      'government-programs': '/dashboard-group/company/government-programs',
    }

    const url = appUrls[appId]

    return JSON.stringify({
      success: true,
      app: app.name,
      url: url,
      message: `${app.name} 앱을 열었습니다. URL: ${url}`
    })
  },
})

// ============================================
// Tool: AI 문서 생성
// ============================================

export const generateDocumentTool = new DynamicStructuredTool({
  name: 'generate_document',
  description: 'AI Docs 앱을 사용하여 문서를 생성합니다.',
  schema: z.object({
    title: z.string().describe('문서 제목'),
    content: z.string().describe('문서 내용 또는 작성 지시사항'),
    type: z.enum(['report', 'article', 'proposal', 'memo', 'manual']).optional().describe('문서 유형'),
  }),
  func: async ({ title, content, type }) => {
    try {
      // 실제 API 호출 대신 성공 응답 반환 (브라우저 환경에서 실행)
      return JSON.stringify({
        success: true,
        document: {
          title,
          type: type || 'report',
          contentPreview: content.slice(0, 200) + '...',
        },
        message: `문서 "${title}" 생성을 시작했습니다.`,
        action: {
          type: 'navigate',
          url: `/dashboard-group/apps/ai-docs?title=${encodeURIComponent(title)}&content=${encodeURIComponent(content)}`
        }
      })
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) })
    }
  },
})

// ============================================
// Tool: AI 슬라이드 생성
// ============================================

export const generateSlidesTool = new DynamicStructuredTool({
  name: 'generate_slides',
  description: 'AI Slides 앱을 사용하여 프레젠테이션을 생성합니다.',
  schema: z.object({
    topic: z.string().describe('프레젠테이션 주제'),
    slideCount: z.number().optional().default(10).describe('슬라이드 수'),
    style: z.enum(['business', 'creative', 'minimal', 'academic']).optional().describe('스타일'),
    outline: z.string().optional().describe('목차 또는 개요'),
  }),
  func: async ({ topic, slideCount, style, outline }) => {
    try {
      return JSON.stringify({
        success: true,
        presentation: {
          topic,
          slideCount,
          style: style || 'business',
          outline: outline || '자동 생성',
        },
        message: `"${topic}" 프레젠테이션 생성을 시작했습니다.`,
        action: {
          type: 'navigate',
          url: `/dashboard-group/apps/ai-slides?topic=${encodeURIComponent(topic)}&slides=${slideCount}`
        }
      })
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) })
    }
  },
})

// ============================================
// Tool: 이미지 생성
// ============================================

export const generateImageTool = new DynamicStructuredTool({
  name: 'generate_image',
  description: 'Image Gen 앱을 사용하여 이미지를 생성합니다.',
  schema: z.object({
    prompt: z.string().describe('이미지 설명 (영어 권장)'),
    style: z.enum(['realistic', 'anime', 'cartoon', 'sketch', 'oil-painting']).optional().describe('이미지 스타일'),
    size: z.enum(['square', 'portrait', 'landscape']).optional().describe('이미지 크기'),
  }),
  func: async ({ prompt, style, size }) => {
    try {
      return JSON.stringify({
        success: true,
        image: {
          prompt,
          style: style || 'realistic',
          size: size || 'square',
        },
        message: `이미지 생성을 시작했습니다: "${prompt}"`,
        action: {
          type: 'navigate',
          url: `/dashboard-group/apps/image-gen?prompt=${encodeURIComponent(prompt)}`
        }
      })
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) })
    }
  },
})

// ============================================
// Tool: 블로그 글 생성
// ============================================

export const generateBlogPostTool = new DynamicStructuredTool({
  name: 'generate_blog_post',
  description: 'AI Blog 앱을 사용하여 블로그 글을 생성합니다.',
  schema: z.object({
    topic: z.string().describe('블로그 주제'),
    tone: z.enum(['formal', 'casual', 'humorous', 'professional']).optional().describe('글 톤'),
    length: z.enum(['short', 'medium', 'long']).optional().describe('글 길이'),
    keywords: z.array(z.string()).optional().describe('포함할 키워드'),
  }),
  func: async ({ topic, tone, length, keywords }) => {
    try {
      return JSON.stringify({
        success: true,
        blogPost: {
          topic,
          tone: tone || 'casual',
          length: length || 'medium',
          keywords: keywords || [],
        },
        message: `"${topic}" 블로그 글 생성을 시작했습니다.`,
        action: {
          type: 'navigate',
          url: `/dashboard-group/apps/ai-blog?topic=${encodeURIComponent(topic)}`
        }
      })
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) })
    }
  },
})

// ============================================
// Tool: YouTube 영상 요약
// ============================================

export const summarizeYouTubeTool = new DynamicStructuredTool({
  name: 'summarize_youtube',
  description: 'AI Summary 앱을 사용하여 YouTube 영상을 요약합니다.',
  schema: z.object({
    videoUrl: z.string().describe('YouTube 영상 URL'),
    format: z.enum(['bullet', 'paragraph', 'timeline']).optional().describe('요약 형식'),
  }),
  func: async ({ videoUrl, format }) => {
    try {
      return JSON.stringify({
        success: true,
        summary: {
          videoUrl,
          format: format || 'bullet',
        },
        message: `YouTube 영상 요약을 시작했습니다.`,
        action: {
          type: 'navigate',
          url: `/dashboard-group/apps/ai-summary?url=${encodeURIComponent(videoUrl)}`
        }
      })
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) })
    }
  },
})

// ============================================
// Tool: 스킬 개발 가이드
// ============================================

export const developGlowUSSkillTool = new DynamicStructuredTool({
  name: 'develop_glowus_skill',
  description: '새로운 GlowUS 스킬앱을 개발합니다. 미구현 앱의 개발 가이드를 제공합니다.',
  schema: z.object({
    appId: z.string().describe('개발할 앱 ID'),
  }),
  func: async ({ appId }) => {
    const app = GLOWUS_APPS.find(a => a.id === appId)

    if (!app) {
      return JSON.stringify({
        success: false,
        error: `앱을 찾을 수 없습니다: ${appId}`,
        availableApps: GLOWUS_APPS.filter(a => !a.implemented).map(a => ({ id: a.id, name: a.name }))
      })
    }

    if (app.implemented) {
      return JSON.stringify({
        success: false,
        error: `이 앱은 이미 구현되어 있습니다: ${app.name}`,
        suggestion: 'open_glowus_app 도구로 앱을 열어보세요.'
      })
    }

    // 개발 가이드 생성
    const guide = {
      appId: app.id,
      name: app.name,
      description: app.description,
      category: app.category,
      developmentSteps: [
        {
          step: 1,
          title: 'API 라우트 생성',
          path: `app/api/${app.id}/route.ts`,
          description: 'Next.js API 라우트 생성',
        },
        {
          step: 2,
          title: '페이지 컴포넌트 생성',
          path: `app/dashboard-group/apps/${app.id}/page.tsx`,
          description: 'React 페이지 컴포넌트 생성',
        },
        {
          step: 3,
          title: '도구 등록',
          path: 'lib/agent/glowus-app-tools.ts',
          description: '이 파일에 새 도구 함수 추가',
        },
        {
          step: 4,
          title: '앱 레지스트리 업데이트',
          description: 'GLOWUS_APPS에서 implemented: true로 변경',
        },
      ],
      codeTemplates: {
        apiRoute: `// app/api/${app.id}/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // TODO: ${app.name} 로직 구현
    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}`,
        pageComponent: `// app/dashboard-group/apps/${app.id}/page.tsx
'use client'

import { useState } from 'react'

export default function ${toPascalCase(app.id)}Page() {
  const [result, setResult] = useState(null)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">${app.name}</h1>
      <p className="text-gray-500 mb-8">${app.description}</p>
      {/* TODO: UI 구현 */}
    </div>
  )
}`,
      }
    }

    return JSON.stringify({
      success: true,
      guide,
      message: `${app.name} 스킬 개발 가이드입니다. 위 단계를 따라 구현하세요.`
    }, null, 2)
  },
})

// Helper: kebab-case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// ============================================
// Export All Tools
// ============================================

export const GLOWUS_APP_TOOLS = {
  list_glowus_apps: listGlowUSAppsTool,
  open_glowus_app: openGlowUSAppTool,
  generate_document: generateDocumentTool,
  generate_slides: generateSlidesTool,
  generate_image: generateImageTool,
  generate_blog_post: generateBlogPostTool,
  summarize_youtube: summarizeYouTubeTool,
  develop_glowus_skill: developGlowUSSkillTool,
}

export function getGlowUSAppTools(): DynamicStructuredTool[] {
  return Object.values(GLOWUS_APP_TOOLS)
}
