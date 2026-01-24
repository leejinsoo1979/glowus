/**
 * AI-Powered Scriptwriter
 * NotebookLM 스타일 - LLM 기반 자연스러운 대화 생성
 *
 * 기존 템플릿 방식 X → Gemini/GPT로 실제 대화 생성
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  ContentOutline,
  PipelineConfig,
  ScriptDraft,
  ScriptTurn,
  ScriptSegment,
  ScriptSafety,
  StylePreset,
  BanterLevel,
  Speaker
} from '../core/types'
import { detectForbiddenSlang } from './interjection-library'

// ============================================================================
// AI Provider Interface
// ============================================================================

interface AIProvider {
  generateScript(prompt: string, systemPrompt: string): Promise<string>
}

// ============================================================================
// Prompt Templates
// ============================================================================

const SYSTEM_PROMPTS: Record<StylePreset, string> = {
  FRIENDLY: `당신은 한국어 팟캐스트 대본 작가입니다. 두 명의 진행자(A, B)가 나누는 자연스러운 대화를 작성합니다.

## 진행자 캐릭터
- **Host A (민수)**: 주제 전문가. 차분하고 친절하게 설명. 예시와 비유를 잘 사용.
- **Host B (유진)**: 호기심 많은 청취자 대변인. 질문하고, 리액션하고, 요약.

## 대화 스타일 규칙
1. 실제 친구끼리 대화하듯 자연스럽게
2. 교과서 같은 설명 X, 일상 대화처럼
3. "~해요", "~거든요", "~죠" 등 구어체 사용
4. 중간중간 맞장구: "아~", "오", "그렇구나", "헐"
5. 한 턴에 1-3문장 (너무 길면 X)
6. 정보 전달과 재미 균형

## 금지 표현
- "레전드", "킹받", "ㅋㅋㅋ", "개쩌", "핵꿀잼" 등 인터넷 슬랭
- 너무 격식체 ("~입니다", "~하겠습니다")
- 반복적인 추임새

## 출력 형식
각 턴을 다음 형식으로 작성:
[A] 대사 내용
[B] 대사 내용
...`,

  NEWS: `당신은 뉴스/시사 팟캐스트 대본 작가입니다. 두 명의 앵커(A, B)가 진행하는 정보 중심 대화를 작성합니다.

## 진행자 캐릭터
- **Host A**: 메인 앵커. 핵심 정보를 전달하고 분석 제공.
- **Host B**: 서브 앵커. 보충 질문하고, 시청자 관점에서 정리.

## 대화 스타일 규칙
1. 정확하고 신뢰감 있는 톤
2. 은어/슬랭 사용 X
3. 간결하고 명확한 문장
4. 적절한 속도감
5. 팩트 중심, 감정 과잉 X

## 출력 형식
[A] 대사 내용
[B] 대사 내용
...`,

  DEEPDIVE: `당신은 심층 분석 팟캐스트 대본 작가입니다. 전문가(A)와 진행자(B)가 깊이 있는 대화를 나눕니다.

## 진행자 캐릭터
- **Host A (전문가)**: 해당 분야 전문가. 깊이 있는 설명, 배경 지식, 인사이트 제공.
- **Host B (진행자)**: 청취자 입장에서 질문. 복잡한 내용 쉽게 풀어달라고 요청.

## 대화 스타일 규칙
1. 심층적이지만 이해하기 쉽게
2. A가 설명 → B가 확인/질문 → A가 보충
3. 비유와 실제 사례 풍부하게
4. 청취자가 따라올 수 있는 속도

## 출력 형식
[A] 대사 내용
[B] 대사 내용
...`
}

const BANTER_INSTRUCTIONS: Record<BanterLevel, string> = {
  0: '대화는 정보 전달 중심으로, 리액션과 유머는 최소화하세요.',
  1: '가끔 가벼운 리액션을 넣되, 전체적으로 진지한 톤을 유지하세요.',
  2: '적절한 리액션과 유머를 섞어 친근한 분위기를 만드세요.',
  3: '활발한 대화와 유머러스한 주고받기로 재미있게 만드세요. 단, 과하지 않게.'
}

// ============================================================================
// AI Scriptwriter Class
// ============================================================================

export class AIScriptwriter {
  private aiProvider: AIProvider

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider
  }

  /**
   * LLM 기반 대본 생성
   */
  async generateDraft(
    outline: ContentOutline,
    config: PipelineConfig
  ): Promise<ScriptDraft> {
    const systemPrompt = this.buildSystemPrompt(config)
    const userPrompt = this.buildUserPrompt(outline, config)

    // AI로 대본 생성
    const rawScript = await this.aiProvider.generateScript(userPrompt, systemPrompt)

    // 파싱
    const turns = this.parseScript(rawScript)

    // 세그먼트 빌드
    const segments = this.buildSegments(turns, outline)

    // 안전성 검사
    const safety = this.checkSafety(turns)

    return {
      id: uuidv4(),
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      preset: config.preset,
      banterLevel: config.banterLevel,
      targetDurationSec: config.targetDurationSec,
      turns,
      segments,
      safety,
      outline: outline.keyFacts
    }
  }

  /**
   * 시스템 프롬프트 구성
   */
  private buildSystemPrompt(config: PipelineConfig): string {
    const basePrompt = SYSTEM_PROMPTS[config.preset]
    const banterInstruction = BANTER_INSTRUCTIONS[config.banterLevel]

    return `${basePrompt}

## 추가 지침
${banterInstruction}

목표 분량: 약 ${Math.floor(config.targetDurationSec / 60)}분 분량의 대화 (1분 ≈ 약 10-12턴)`
  }

  /**
   * 사용자 프롬프트 구성 (콘텐츠 기반)
   */
  private buildUserPrompt(outline: ContentOutline, config: PipelineConfig): string {
    const sections = outline.sections.map(s => {
      let content = `### ${s.title} (${s.type})\n`
      content += `- 핵심 포인트: ${s.keypoints.join(', ')}\n`
      if (s.examples?.length) {
        content += `- 예시: ${s.examples.join(', ')}\n`
      }
      return content
    }).join('\n')

    return `다음 내용을 바탕으로 팟캐스트 대본을 작성해주세요.

## 에피소드 제목
${outline.title}

## 구성
${sections}

## 핵심 팩트
${outline.keyFacts.join('\n')}

${outline.technicalTerms.length > 0 ? `## 전문 용어 (쉽게 설명 필요)\n${outline.technicalTerms.join(', ')}` : ''}

${outline.numbers.length > 0 ? `## 숫자/통계\n${outline.numbers.map(n => `- ${n.raw}: ${n.context || ''}`).join('\n')}` : ''}

---

위 내용을 바탕으로 자연스러운 두 사람의 대화를 작성해주세요.
오프닝부터 클로징까지 완전한 에피소드를 만들어주세요.`
  }

  /**
   * AI 생성 텍스트 → ScriptTurn[] 파싱
   */
  private parseScript(rawScript: string): ScriptTurn[] {
    const turns: ScriptTurn[] = []
    const lines = rawScript.split('\n').filter(l => l.trim())

    let index = 0
    let currentSection = 'sec_main'

    for (const line of lines) {
      // [A] 또는 [B] 패턴 매칭
      const match = line.match(/^\[([AB])\]\s*(.+)$/)
      if (match) {
        const speaker: Speaker = match[1] === 'A' ? 'HOST_A' : 'HOST_B'
        const text = match[2].trim()

        // 섹션 추론 (간단하게)
        if (index < 3) {
          currentSection = 'sec_opening'
        } else if (line.includes('마무리') || line.includes('오늘') && line.includes('정리')) {
          currentSection = 'sec_closing'
        }

        turns.push({
          id: uuidv4(),
          index: index++,
          speaker,
          rawText: text,
          sectionId: currentSection,
          intent: this.inferIntent(text, speaker),
          emphasisWords: this.extractEmphasis(text),
          pace: this.inferPace(text, speaker),
          pauseMsBefore: index === 0 ? 0 : this.inferPauseBefore(text),
          pauseMsAfter: this.inferPauseAfter(text)
        })
      }
    }

    return turns
  }

  /**
   * 인텐트 추론
   */
  private inferIntent(text: string, speaker: Speaker): ScriptTurn['intent'] {
    if (text.includes('?')) {
      return 'ask_question'
    }
    if (text.match(/^(오|아|헐|와|음)/)) {
      return 'react'
    }
    if (text.includes('예를 들') || text.includes('예로') || text.includes('처럼')) {
      return 'give_example'
    }
    if (text.includes('정리하') || text.includes('요약하') || text.includes('결국')) {
      return 'summarize'
    }
    if (text.includes('오늘') && (text.includes('주제') || text.includes('이야기'))) {
      return 'opener_hook'
    }
    if (text.includes('다음에') || text.includes('또 만나')) {
      return 'closing'
    }
    return speaker === 'HOST_A' ? 'explain_point' : 'react'
  }

  /**
   * 페이스 추론
   */
  private inferPace(text: string, speaker: Speaker): ScriptTurn['pace'] {
    // 짧은 리액션은 빠르게
    if (text.length < 15 && speaker === 'HOST_B') {
      return 'fast'
    }
    // 마무리는 천천히
    if (text.includes('다음에') || text.includes('마무리')) {
      return 'slow'
    }
    return 'normal'
  }

  /**
   * 강조 단어 추출
   */
  private extractEmphasis(text: string): string[] {
    const patterns = [
      /(?:정말|진짜|완전|특히)\s*(\S+)/g,
      /"([^"]+)"/g,
      /『([^』]+)』/g
    ]

    const words: string[] = []
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) words.push(match[1])
      }
    }

    return [...new Set(words)]
  }

  /**
   * 앞 휴지 추론
   */
  private inferPauseBefore(text: string): number {
    if (text.match(/^(음|아|오|그래서)/)) {
      return 200 + Math.random() * 150
    }
    return 100 + Math.random() * 200
  }

  /**
   * 뒤 휴지 추론
   */
  private inferPauseAfter(text: string): number {
    if (text.endsWith('?')) {
      return 300 + Math.random() * 200
    }
    if (text.endsWith('!')) {
      return 150 + Math.random() * 100
    }
    return 150 + Math.random() * 150
  }

  /**
   * 세그먼트 빌드
   */
  private buildSegments(turns: ScriptTurn[], outline: ContentOutline): ScriptSegment[] {
    // 간단하게 섹션별로 그룹핑
    const segmentMap = new Map<string, ScriptTurn[]>()

    for (const turn of turns) {
      const existing = segmentMap.get(turn.sectionId) || []
      existing.push(turn)
      segmentMap.set(turn.sectionId, existing)
    }

    const segments: ScriptSegment[] = []
    for (const [sectionId, sectionTurns] of segmentMap) {
      if (sectionTurns.length === 0) continue

      const section = outline.sections.find(s => s.id === sectionId)
      const type = section?.type || 'keypoint'

      segments.push({
        id: `seg_${sectionId}`,
        title: section?.title || sectionId,
        type,
        startTurnIndex: sectionTurns[0].index,
        endTurnIndex: sectionTurns[sectionTurns.length - 1].index,
        targetDurationSec: section?.estimatedDurationSec || 60
      })
    }

    return segments
  }

  /**
   * 안전성 검사
   */
  private checkSafety(turns: ScriptTurn[]): ScriptSafety {
    const safety: ScriptSafety = {
      sensitiveTopicsDetected: [],
      forbiddenSlangDetected: [],
      redactions: [],
      warnings: []
    }

    for (const turn of turns) {
      const slang = detectForbiddenSlang(turn.rawText)
      if (slang.length > 0) {
        safety.forbiddenSlangDetected.push(...slang)
        safety.warnings.push(`Turn ${turn.index}: 금지 슬랭 - ${slang.join(', ')}`)
      }

      // 민감 주제
      const sensitive = ['정치', '종교', '성별', '인종', '혐오']
      for (const word of sensitive) {
        if (turn.rawText.includes(word)) {
          safety.sensitiveTopicsDetected.push(word)
        }
      }
    }

    safety.forbiddenSlangDetected = [...new Set(safety.forbiddenSlangDetected)]
    safety.sensitiveTopicsDetected = [...new Set(safety.sensitiveTopicsDetected)]

    return safety
  }

  /**
   * 턴 재생성 (QA 실패 시)
   */
  async regenerateTurn(
    turn: ScriptTurn,
    reason: string,
    context: { prevTurn?: ScriptTurn; nextTurn?: ScriptTurn }
  ): Promise<ScriptTurn> {
    const prompt = this.buildRegenerationPrompt(turn, reason, context)
    const systemPrompt = `당신은 팟캐스트 대본 수정 전문가입니다. 주어진 대사를 자연스럽게 수정해주세요.

## 규칙
1. 원래 의미와 흐름 유지
2. 더 자연스러운 구어체로
3. 금지 슬랭 사용 X
4. 앞뒤 대사와 자연스럽게 연결

## 출력 형식
수정된 대사만 출력 (설명 없이)`

    const newText = await this.aiProvider.generateScript(prompt, systemPrompt)

    return {
      ...turn,
      rawText: newText.trim(),
      retryCount: (turn.retryCount || 0) + 1
    }
  }

  private buildRegenerationPrompt(
    turn: ScriptTurn,
    reason: string,
    context: { prevTurn?: ScriptTurn; nextTurn?: ScriptTurn }
  ): string {
    let prompt = `다음 대사를 수정해주세요.

## 원래 대사
"${turn.rawText}"

## 수정 이유
${reason}

`

    if (context.prevTurn) {
      prompt += `## 앞 대사\n[${context.prevTurn.speaker === 'HOST_A' ? 'A' : 'B'}] ${context.prevTurn.rawText}\n\n`
    }
    if (context.nextTurn) {
      prompt += `## 뒤 대사\n[${context.nextTurn.speaker === 'HOST_A' ? 'A' : 'B'}] ${context.nextTurn.rawText}\n\n`
    }

    prompt += `자연스럽게 수정된 대사를 작성해주세요.`

    return prompt
  }
}

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

export class GeminiScriptProvider implements AIProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateScript(prompt: string, systemPrompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] }
          ],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
}

// ============================================================================
// OpenAI Provider Implementation
// ============================================================================

export class OpenAIScriptProvider implements AIProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateScript(prompt: string, systemPrompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 8192
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAIScriptwriter(
  provider: 'gemini' | 'openai',
  apiKey: string,
  model?: string
): AIScriptwriter {
  if (provider === 'gemini') {
    return new AIScriptwriter(new GeminiScriptProvider(apiKey, model))
  } else {
    return new AIScriptwriter(new OpenAIScriptProvider(apiKey, model))
  }
}

export default AIScriptwriter
