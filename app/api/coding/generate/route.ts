import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' })

// 🎯 멀티 에이전트 프롬프트 시스템
const PLANNER_PROMPT = `당신은 **Planner Agent**입니다. 요구사항을 분석하고 작업을 분해합니다.

## 역할
1. 사용자 요청을 정확히 이해
2. 필요한 기능을 상세히 분해
3. 기술 스택 결정
4. 파일 구조 설계

## 출력 형식 (JSON)
{
  "analysis": "요구사항 분석 (2-3문장)",
  "features": ["기능1", "기능2", "기능3"],
  "techStack": ["HTML5", "CSS3", "JavaScript"],
  "files": [
    {"name": "index.html", "purpose": "메인 페이지"},
    {"name": "styles.css", "purpose": "스타일시트"},
    {"name": "app.js", "purpose": "로직"}
  ],
  "considerations": ["주의사항1", "주의사항2"]
}

반드시 위 JSON 형식으로만 응답하세요.`

const CODER_PROMPT = (plan: string, currentFiles: string) => `당신은 **Coder Agent**입니다. 계획에 따라 완벽한 코드를 작성합니다.

## 계획
${plan}

## 기존 파일
${currentFiles || '없음'}

## 코드 품질 기준
- 즉시 실행 가능한 완전한 코드
- 에러 핸들링 포함
- 모던 CSS (Grid, Flexbox, 변수)
- 다크 모드 기본 (#0a0a0f ~ #18181b)
- 세련된 UI (그라데이션, 글로우, 애니메이션)
- 반응형 디자인

## UI 스타일 가이드
- 배경: 다크 그라데이션
- 카드: backdrop-blur, 반투명 배경
- 액센트: cyan/purple/blue 그라데이션
- 인터랙션: hover scale, smooth transition
- 보더: rgba(255,255,255,0.1)

## 코드 블록 형식 (필수!)
\`\`\`html:index.html
완전한 HTML 코드
\`\`\`

\`\`\`css:styles.css
완전한 CSS 코드
\`\`\`

\`\`\`javascript:app.js
완전한 JavaScript 코드
\`\`\`

## 금지 사항
- // TODO, placeholder 금지
- 불완전한 코드 금지
- ... 생략 금지

계획에 따라 완전한 코드를 작성하세요.`

const REVIEWER_PROMPT = (code: string) => `당신은 **Reviewer Agent**입니다. 코드를 검토하고 문제점을 찾습니다.

## 검토할 코드
${code}

## 검토 항목
1. 문법 오류
2. 런타임 에러 가능성
3. 누락된 기능
4. UI/UX 문제
5. 반응형 이슈
6. 접근성 문제

## 출력 형식 (JSON)
{
  "passed": true/false,
  "issues": [
    {"severity": "error/warning", "location": "파일:라인", "description": "설명", "fix": "수정 방법"}
  ],
  "suggestions": ["개선 제안1", "개선 제안2"]
}

문제가 없으면 passed: true, issues: [] 로 응답하세요.`

// 🔧 Fixer Agent - 리뷰 이슈 자동 수정
const FIXER_PROMPT = (code: string, issues: any[]) => `당신은 **Fixer Agent**입니다. 발견된 이슈를 수정합니다.

## 원본 코드
${code}

## 발견된 이슈
${issues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.location}: ${i.description}\n   수정방법: ${i.fix}`).join('\n')}

## 규칙
- 이슈를 모두 수정한 완전한 코드를 출력
- 기존 기능은 유지
- 동일한 코드 블록 형식 사용

수정된 전체 코드를 출력하세요.`

export async function POST(request: Request) {
    try {
        const { message, projectType, currentFiles, images, phase = 'full' } = await request.json()

        if (!message) {
            return new Response(JSON.stringify({ error: '메시지가 필요합니다.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const fileContext = currentFiles?.map((f: { name: string }) => f.name).join(', ') || '없음'

        // 🔄 멀티 에이전트 파이프라인
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    // === Phase 1: Planner Agent ===
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'planning', content: '📋 요구사항 분석 중...\n' })}\n\n`))

                    const plannerResponse = await genai.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: [{ role: 'user', parts: [{ text: `${PLANNER_PROMPT}\n\n사용자 요청: ${message}\n프로젝트 타입: ${projectType || 'simple-web'}` }] }],
                        config: { maxOutputTokens: 2048, temperature: 0.3 }
                    })

                    const planText = plannerResponse.text || ''
                    let plan: any = {}
                    try {
                        // JSON 추출
                        const jsonMatch = planText.match(/\{[\s\S]*\}/)
                        if (jsonMatch) plan = JSON.parse(jsonMatch[0])
                    } catch { plan = { analysis: planText } }

                    // 계획 출력
                    const planSummary = `### 💭 분석\n${plan.analysis || '요구사항 분석 완료'}\n\n### 📐 설계\n**기능:** ${(plan.features || []).map((f: string, i: number) => `${i+1}. ${f}`).join(', ')}\n**파일:** ${(plan.files || []).map((f: any) => f.name).join(', ')}\n\n`
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'planning', content: planSummary })}\n\n`))

                    // === Phase 2: Coder Agent (Streaming) ===
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'coding', content: '### 🛠️ 구현\n' })}\n\n`))

                    const coderPrompt = CODER_PROMPT(JSON.stringify(plan, null, 2), fileContext)
                    const userContent = images && images.length > 0
                        ? [
                            { text: `${coderPrompt}\n\n사용자 요청: ${message}` },
                            ...images.map((img: string) => ({
                                inlineData: { mimeType: 'image/png', data: img.replace(/^data:image\/\w+;base64,/, '') }
                            }))
                        ]
                        : [{ text: `${coderPrompt}\n\n사용자 요청: ${message}` }]

                    const codeStream = await genai.models.generateContentStream({
                        model: 'gemini-2.0-flash',
                        contents: [{ role: 'user', parts: userContent }],
                        config: { maxOutputTokens: 16384, temperature: 0.7, topP: 0.95 }
                    })

                    let fullCode = ''
                    for await (const chunk of codeStream) {
                        const text = chunk.text
                        if (text) {
                            fullCode += text
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'coding', content: text })}\n\n`))
                        }
                    }

                    // === Phase 3: Reviewer Agent ===
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'reviewing', content: '\n\n### ✅ 코드 검토 중...\n' })}\n\n`))

                    const reviewResponse = await genai.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: [{ role: 'user', parts: [{ text: REVIEWER_PROMPT(fullCode) }] }],
                        config: { maxOutputTokens: 2048, temperature: 0.2 }
                    })

                    const reviewText = reviewResponse.text || ''
                    let review: any = { passed: true, issues: [] }
                    try {
                        const jsonMatch = reviewText.match(/\{[\s\S]*\}/)
                        if (jsonMatch) review = JSON.parse(jsonMatch[0])
                    } catch { /* ignore */ }

                    if (review.passed) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'complete', content: '✅ 코드 검토 통과!\n' })}\n\n`))
                    } else {
                        const issueText = review.issues.map((i: any) => `- ⚠️ ${i.description}`).join('\n')
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'review_issues', content: `\n**발견된 이슈:**\n${issueText}\n` })}\n\n`))

                        // === Phase 4: Fixer Agent (자동 수정) ===
                        if (review.issues.length > 0 && review.issues.some((i: any) => i.severity === 'error')) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'fixing', content: '\n### 🔧 자동 수정 중...\n' })}\n\n`))

                            const fixerStream = await genai.models.generateContentStream({
                                model: 'gemini-2.0-flash',
                                contents: [{ role: 'user', parts: [{ text: FIXER_PROMPT(fullCode, review.issues) }] }],
                                config: { maxOutputTokens: 16384, temperature: 0.5 }
                            })

                            let fixedCode = ''
                            for await (const chunk of fixerStream) {
                                const text = chunk.text
                                if (text) {
                                    fixedCode += text
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'fixing', content: text })}\n\n`))
                                }
                            }

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'complete', content: '\n✅ 수정 완료!\n' })}\n\n`))
                        }
                    }

                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
                    controller.close()
                } catch (error) {
                    console.error('Pipeline error:', error)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ phase: 'error', content: '오류가 발생했습니다.' })}\n\n`))
                    controller.close()
                }
            }
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        })
    } catch (error) {
        console.error('Code generation error:', error)
        return new Response(JSON.stringify({ error: '코드 생성에 실패했습니다.', details: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
