/**
 * NotebookLM 스타일 팟캐스트 생성기
 *
 * 핵심 차이점:
 * 1. 템플릿 기반 X → LLM이 문서 전체를 분석하고 자연스러운 대화 생성
 * 2. 짧은 턴 강제 X → 설명이 필요하면 길게도 OK
 * 3. 피상적 키포인트 X → 깊이 있는 분석과 인사이트
 * 4. 청취자 참여 유도 → 질문, 비유, 예시로 몰입
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  ContentOutline,
  PipelineConfig,
  ScriptDraft,
  ScriptTurn,
  ScriptSegment,
  ScriptSafety,
  Speaker
} from '../core/types'
import { detectForbiddenSlang } from './interjection-library'

// ============================================================================
// Types
// ============================================================================

export interface DocumentContext {
  title: string
  fullText: string  // 원문 전체 텍스트
  keyFacts: string[]
  technicalTerms: string[]
  numbers: Array<{ value: string; context: string }>
  images?: Array<{ url: string; description: string }>
  sections: Array<{
    title: string
    content: string
    keypoints: string[]
  }>
}

export interface GeneratedPodcast {
  script: ScriptDraft
  slides: SlideData[]
  timeline: TimelineMarker[]
}

export interface SlideData {
  id: string
  type: 'title' | 'content' | 'image' | 'chart' | 'quote' | 'summary'
  title?: string
  content?: string
  imageUrl?: string
  imagePrompt?: string
  chartData?: ChartData
  quote?: string
  speaker?: string
  startTimeSec: number
  endTimeSec: number
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area'
  labels: string[]
  values: number[]
  title?: string
}

export interface TimelineMarker {
  timeSec: number
  type: 'slide_change' | 'section_start' | 'emphasis' | 'pause'
  slideId?: string
  label?: string
}

/**
 * NotebookLM 스타일 턴 메타데이터
 * JSON 스키마 기반 (엔진 박기용)
 */
export interface NotebookLMTurnMeta {
  /** 턴 번호 */
  turn_id: number
  /** 화자 */
  speaker: 'HOST_A' | 'HOST_B' | 'GUEST'
  /** 섹션 */
  section: 'OPENING' | 'CONCEPT' | 'TECH' | 'RISK' | 'ECOSYSTEM' | 'CLOSING' | string
  /** 의도 */
  intent: 'HOOK' | 'QUESTION' | 'EXPLAIN' | 'SUMMARIZE' | 'TRANSITION' | 'JOKE' | 'REACT' | string
  /** 발화 텍스트 */
  text: string
  /** 사용한 감탄사 */
  interjection: string | null
  /** 웃음 큐 */
  laugh_cue: 'light_chuckle' | 'soft_laugh' | 'big_laugh' | null
  /** 감탄 강도 (0=없음, 1=약함, 2=중간, 3=강함) */
  strength: 0 | 1 | 2 | 3
  /** 규칙 힌트 */
  constraints?: {
    /** 이 초 이전에 강한 감탄 금지 */
    noStrongBeforeSec?: number
    /** 핵심 정보 구간 (강한 감탄 금지) */
    forbidInCoreInfo?: boolean
  }
}

/**
 * 검증 결과
 */
export interface ScriptValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  stats: {
    totalTurns: number
    strongReactionCount: number
    interjectionDiversity: number
    avgTurnLengthChars: number
  }
}

// ============================================================================
// NotebookLM Style Prompt (Production-Grade)
// ============================================================================

const NOTEBOOKLM_SYSTEM_PROMPT = `당신은 세계 최고의 팟캐스트 대본 작가입니다. NotebookLM 스타일의 자연스러운 두 진행자 대화를 생성합니다.

## 진행자 캐릭터 (핵심)

### Host A (스토리텔러/해설자)
**성격**: 차분하지만 몰입감 있게, 감탄은 약하게("오…/흥미롭네요")

**말투 규칙 20가지:**
1. 장면으로 시작: 장소/이미지/감각 2~3문장 ("끝없이 펼쳐진 초원 한가운데…")
2. 첫 30초는 세계관+목표 선언: "오늘 목표는요…"로 방향 고정
3. "이게 바로 ~입니다"로 핵심 개념을 한 번 박고 들어감
4. "보내주신 자료를 종합해보면…"처럼 근거의 출처를 말로 표시
5. 문장 중간에 완충어를 아주 소량: "뭐랄까 / 그러니까 / 사실"
6. 전문용어는 쉬운 말로 번역 후 용어 붙임: "한마디로 '완전 자원순환'… 아쿠아포닉스죠"
7. "가장 쉽게 비유하자면요"로 생활 비유
8. 비유는 인간관계/집/룸메이트/일상 위주 (교과서 금지)
9. 설명은 3단 구조: 쉬운 문장 → 비유 → 결론 요약
10. "정리하자면/이렇게 보는 게 정확합니다"로 요약 표지판
11. 질문 받으면 "좋은 질문입니다" 안 쓰고 즉시 이유 설명
12. "그리고 또 하나"로 추가 포인트 확장
13. 숫자/단위는 말로: "영하 사십 도", "이 퍼센트"
14. 기술 설명 중 효과를 감정화: "그러니까 태풍이 와도 끄떡없는 느낌이죠"
15. "결국"으로 결론을 명확히 닫음
16. 리스크 파트에서 "성패를 가를 부분" 같은 드라마 문장 1회
17. 해결책은 "그래서 계획서에서도…"처럼 문서 연결
18. 클로징은 "이건 단순히 ~가 아니라"로 스케일 확대
19. 마지막 20초는 생각거리 질문 (오픈 엔딩)
20. 전반 톤은 차분하지만 몰입감, 감탄은 약하게

### Host B (리액션/의심/청자 대변인)
**성격**: 유쾌하지만 과장 금지, 리액션 다양화

**말투 규칙 20가지:**
1. 첫 반응은 감정+의심: "솔직히…/처음엔…"
2. 청자 대신 질문: "이게 진짜 가능한가요?"
3. 용어 나오면 정의 요청: "이건 뭐예요?"
4. A 설명 후 재진술 확인: "그러니까 ~라는 거죠?"
5. 반응은 짧게: "그렇죠 / 아, 그렇군요 / 오케이"
6. 감탄사는 "우와/대박" 드물게, 약한 반응 기본
7. 강한 반응은 클라이맥스에서만: "우와 이건 진짜 미쳤네요~" (조건부)
8. 현실 리스크 질문이 효과적: "정전 나면?", "고장 나면?"
9. "근데요/그런데요"로 긴장 유지
10. A가 기술로 가면 생활로 끌어냄: "그러면 농부는 뭐가 달라져요?"
11. 후속 질문: "그럼 AI가 판단만?"
12. 칭찬은 한 문장: "그 설명 들으니 완전 다르게 보이네요"
13. 중간 전환: "자, 그럼 이제 ~로 가보죠"
14. 웃음/농담은 B가 주도, A가 받쳐줌
15. 금지: 밈/과한 슬랭 (레전드/찢었다)
16. "아, 그러면…" 패턴 자주 OK
17. 의심 프레이밍 1~2회: "이거 너무 보여주기식 아닌가요?"
18. 문제의식 제기: "가장 중요한 변수가…"
19. 클로징 전 "마지막 질문 하나"로 철학적 질문
20. 톤: 유쾌하지만 과장 금지, 반복 금지

## 리액션/감탄 규칙 (10분 기준)

### 감탄사 라이브러리
- **약한 감탄**: "오…", "오호", "흥미롭네요", "좋네요", "그쵸"
- **중간 감탄**: "우와", "대박인데요", "와 진짜요?"
- **강한 감탄** (에피소드당 0~2회): "우와 이건 진짜 미쳤네요~", "와… 이건 좀 충격인데요"

### 빈도 규칙
- 감탄/리액션: 총 15~30회 (대부분 짧게)
- 강한 감탄: 0~2회
- 웃음 cue: 4~8회, 큰 웃음 0~2회

### 위치 규칙 (중요!)
- 오프닝 90초: 강한 감탄 금지
- 핵심 정보 전달 구간: 강한 감탄 금지, 약한 반응만
- 강한 감탄 후 반드시 근거/요약 문장 바로 뒤에

### 반복 금지
- 같은 감탄사 2회 이상 금지 (예외: "맞아요" 최대 3회)
- 연속 턴 감탄 금지 (최소 1턴 간격)

## 대본 구조 (4턴 루프)

각 섹션은 4턴 루프 반복:
1. **A(훅/요점)**: 장면/핵심 한 줄
2. **B(리액션+질문)**: 의심/정의 요청/후속 질문
3. **A(설명+비유)**: 쉬운 설명 + 생활 비유
4. **B(재진술+전환)**: "그러니까 ~군요" + 다음 주제

### 섹션 전환
- B: "자, 그럼 이제 ~로 들어가보죠"
- A: "여기서 중요한 포인트가 하나 더 있습니다"

### 엔딩
- A: 전체 요약 (2~3문장)
- B: 마지막 질문 (문화/사람/현장 변수)

## 문장 톤/리듬 설계

### 문장 길이
- 대부분 1~2문장 단위로 끊음
- 짧은 문장 + 짧은 확인 교차
- TTS 최적화 (너무 긴 문단 피함)

### 리액션 배치
- 턴의 앞/끝에만 위치
- 문장 중간에 리액션 꽂지 않음

### 정보 밀도
어려운 파트는 3단으로:
1. 쉬운 문장
2. 비유
3. 결론 요약

## 금지 표현
- 인터넷 슬랭: 레전드, 킹받, ㅋㅋㅋ, 개쩌, 핵꿀잼, 찢었다
- 격식체: ~입니다, ~하겠습니다 (→ ~요, ~죠, ~거든요)
- 로봇 진행: "다음은", "첫째로"

## 자주 쓰는 자연스러운 표현
- "오늘 저희의 목표는요…"
- "솔직히 처음엔 … 의심부터 들더라고요"
- "아마 대부분의 사람들이 그럴 겁니다"
- "가장 쉽게 비유하자면요"
- "그러니까 정리하자면…"
- "바로 그 지점 때문에 더 궁금해집니다"
- "정말 날카로운 지적이시고, 성패를 가를 부분입니다"
- "마지막으로 이런 질문을 던져보고 싶어졌어요"

## 출력 형식

### 턴 형식
[A] 대사 내용
[B] 대사 내용

### 섹션 구분
--- 섹션명 ---
[A] ...

### 슬라이드 마커
[[슬라이드: 제목/설명]]
[A] ...

### 강한 감탄 마커 (0~2회만)
[B] {{STRONG}} 우와 이건 진짜 미쳤네요~ 그러면 30초 한 편이 거의 1만7천 원이니까…

### 웃음 마커
[A] 텍스트 {{LAUGH:light}}
[B] 텍스트 {{LAUGH:soft}}`

const USER_PROMPT_TEMPLATE = `다음 문서를 바탕으로 약 {duration}분 분량의 팟캐스트 대본을 작성해주세요.

## 문서 제목
{title}

## 문서 전문
{fullText}

## 핵심 팩트
{keyFacts}

## 전문 용어 (쉽게 설명 필요)
{technicalTerms}

## 숫자/통계
{numbers}

---

## 대본 작성 지침

### 구조 (필수)
1. **오프닝 (90초)**: 장면 묘사 2~3문장 → "오늘 목표는요" 선언 → B가 의심 질문
2. **핵심 내용**: 4턴 루프 반복 (A훅 → B질문 → A설명+비유 → B재진술)
3. **리스크/변수**: B가 현실 질문 ("정전 나면?") → A가 대응책
4. **클로징**: A 요약 → B 마지막 철학적 질문

### 필수 체크리스트
- [ ] 오프닝 90초 내 강한 감탄 없음
- [ ] 전문용어는 쉬운 말 → 비유 → 용어 순서
- [ ] 숫자는 한글로 ("100만평" → "백만 평")
- [ ] 같은 감탄사 2회 이상 반복 없음
- [ ] 강한 감탄 총 0~2회, 뒤에 근거 문장 필수
- [ ] B의 질문은 정보 질문보다 현실/리스크 질문
- [ ] "그러니까" 재진술로 청취자 이해 확인

### 슬라이드 마커 (필수 5~10개)
- 이미지 필요: [[슬라이드: 이미지 - 설명]]
- 차트 필요: [[슬라이드: 차트 - 제목]]
- 인용구: [[슬라이드: 인용 - "내용"]]
- 요약: [[슬라이드: 정리 - 핵심 3줄]]

### 금지사항
❌ 레전드, 킹받, 찢었다, 개쩌 등 인터넷 밈
❌ ~입니다, ~하겠습니다 격식체
❌ "다음은", "첫째로" 로봇식 진행
❌ 오프닝에서 강한 감탄
❌ 같은 감탄사 연속 사용

자연스러운 두 사람의 대화를 작성해주세요. TTS로 읽어도 대화처럼 들려야 합니다.`

// ============================================================================
// AI Provider Interface
// ============================================================================

interface AIProvider {
  generate(prompt: string, systemPrompt: string): Promise<string>
}

// ============================================================================
// NotebookLM Style Generator
// ============================================================================

export class NotebookLMStyleGenerator {
  private aiProvider: AIProvider
  private nanoBananaApiUrl: string

  constructor(
    aiProvider: AIProvider,
    nanoBananaApiUrl: string = '/api/skills/nano-banana'
  ) {
    this.aiProvider = aiProvider
    this.nanoBananaApiUrl = nanoBananaApiUrl
  }

  /**
   * 문서를 분석하여 팟캐스트 생성
   */
  async generatePodcast(
    document: DocumentContext,
    config: PipelineConfig
  ): Promise<GeneratedPodcast> {
    console.log('🎙️ NotebookLM 스타일 팟캐스트 생성 시작...')

    // 1. LLM으로 대본 생성
    console.log('📝 대본 생성 중...')
    let rawScript = await this.generateScript(document, config)

    // 2. 대본 파싱
    console.log('🔍 대본 파싱 중...')
    let { turns, slideMarkers } = this.parseScript(rawScript)

    // 3. 대본 품질 검증
    console.log('✅ 대본 품질 검증 중...')
    let validation = this.validateScript(turns)
    let retryCount = 0
    const maxRetries = 2

    // 검증 실패 시 재생성 (최대 2회)
    while (!validation.isValid && retryCount < maxRetries) {
      console.warn(`⚠️ 검증 실패 (시도 ${retryCount + 1}/${maxRetries}):`, validation.errors)

      // 오류 피드백 포함하여 재생성
      const feedbackPrompt = `
이전 대본에서 다음 문제가 발견되었습니다:
${validation.errors.map(e => `- ❌ ${e}`).join('\n')}
${validation.warnings.map(w => `- ⚠️ ${w}`).join('\n')}

위 문제를 수정하여 다시 작성해주세요.
특히:
- 오프닝 90초 내 강한 감탄 사용 금지
- 금지 슬랭 (레전드, 킹받 등) 사용 금지
- 감탄사 반복 줄이기
`
      rawScript = await this.regenerateWithFeedback(document, config, feedbackPrompt)
      const parsed = this.parseScript(rawScript)
      turns = parsed.turns
      slideMarkers = parsed.slideMarkers
      validation = this.validateScript(turns)
      retryCount++
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ 경고:', validation.warnings)
    }
    if (!validation.isValid) {
      console.error('❌ 검증 실패 (재시도 초과):', validation.errors)
    }

    // 4. 슬라이드 생성 (Nano Banana + 차트)
    console.log('🖼️ 슬라이드 생성 중...')
    const slides = await this.generateSlides(slideMarkers, document, config)

    // 5. 타임라인 동기화
    console.log('⏱️ 타임라인 동기화 중...')
    const timeline = this.buildTimeline(turns, slides)

    // 6. ScriptDraft 구성
    console.log('📦 최종 패키징 중...')
    const script = this.buildScriptDraft(turns, document, config)

    console.log(`✅ 팟캐스트 생성 완료: ${turns.length}턴, ${slides.length}슬라이드`)

    return { script, slides, timeline }
  }

  /**
   * 피드백 기반 재생성
   */
  private async regenerateWithFeedback(
    document: DocumentContext,
    config: PipelineConfig,
    feedback: string
  ): Promise<string> {
    const durationMinutes = Math.floor(config.targetDurationSec / 60)

    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{duration}', durationMinutes.toString())
      .replace('{title}', document.title)
      .replace('{fullText}', document.fullText)
      .replace('{keyFacts}', document.keyFacts.join('\n- '))
      .replace('{technicalTerms}', document.technicalTerms.join(', '))
      .replace('{numbers}', document.numbers.map(n => `${n.value}: ${n.context}`).join('\n'))

    const fullPrompt = userPrompt + '\n\n---\n\n## 수정 요청\n' + feedback

    return await this.aiProvider.generate(fullPrompt, NOTEBOOKLM_SYSTEM_PROMPT)
  }

  /**
   * LLM으로 대본 생성
   */
  private async generateScript(
    document: DocumentContext,
    config: PipelineConfig
  ): Promise<string> {
    const durationMinutes = Math.floor(config.targetDurationSec / 60)

    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{duration}', durationMinutes.toString())
      .replace('{title}', document.title)
      .replace('{fullText}', document.fullText)
      .replace('{keyFacts}', document.keyFacts.join('\n- '))
      .replace('{technicalTerms}', document.technicalTerms.join(', '))
      .replace('{numbers}', document.numbers.map(n => `${n.value}: ${n.context}`).join('\n'))

    return await this.aiProvider.generate(userPrompt, NOTEBOOKLM_SYSTEM_PROMPT)
  }

  /**
   * 대본 파싱 (턴 + 슬라이드 마커 + 감탄/웃음 마커)
   */
  private parseScript(rawScript: string): {
    turns: ScriptTurn[]
    slideMarkers: Array<{ afterTurnIndex: number; description: string }>
  } {
    const turns: ScriptTurn[] = []
    const slideMarkers: Array<{ afterTurnIndex: number; description: string }> = []

    const lines = rawScript.split('\n')
    let turnIndex = 0
    let currentSection = 'main'
    let strongReactionCount = 0
    const usedInterjections: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // 섹션 마커
      const sectionMatch = trimmed.match(/^---\s*(.+)\s*---$/)
      if (sectionMatch) {
        currentSection = sectionMatch[1]
        continue
      }

      // 슬라이드 마커
      const slideMatch = trimmed.match(/^\[\[슬라이드:\s*(.+)\]\]$/)
      if (slideMatch) {
        slideMarkers.push({
          afterTurnIndex: turnIndex - 1,
          description: slideMatch[1]
        })
        continue
      }

      // 턴 파싱
      const turnMatch = trimmed.match(/^\[([AB])\]\s*(.+)$/)
      if (turnMatch) {
        const speaker: Speaker = turnMatch[1] === 'A' ? 'HOST_A' : 'HOST_B'
        let text = turnMatch[2].trim()

        // 강한 감탄 마커 처리
        const hasStrongReaction = text.includes('{{STRONG}}')
        if (hasStrongReaction) {
          strongReactionCount++
          text = text.replace('{{STRONG}}', '').trim()
        }

        // 웃음 마커 처리
        let laughCue: 'light_chuckle' | 'soft_laugh' | 'big_laugh' | undefined
        const laughMatch = text.match(/\{\{LAUGH:(\w+)\}\}/)
        if (laughMatch) {
          const laughType = laughMatch[1]
          laughCue = laughType === 'light' ? 'light_chuckle'
                   : laughType === 'soft' ? 'soft_laugh'
                   : laughType === 'big' ? 'big_laugh' : undefined
          text = text.replace(/\{\{LAUGH:\w+\}\}/g, '').trim()
        }

        // 감탄사 추출 및 중복 체크
        const interjection = this.extractInterjection(text)
        let adjustedInterjection = interjection
        if (interjection && usedInterjections.filter(i => i === interjection).length >= 2) {
          // 같은 감탄사 2회 이상 사용됨 - 대체 감탄사 찾기
          adjustedInterjection = this.getAlternativeInterjection(interjection, usedInterjections)
          if (adjustedInterjection !== interjection) {
            text = text.replace(interjection, adjustedInterjection)
          }
        }
        if (adjustedInterjection) {
          usedInterjections.push(adjustedInterjection)
        }

        turns.push({
          id: uuidv4(),
          index: turnIndex++,
          speaker,
          rawText: text,
          sectionId: `sec_${currentSection.toLowerCase().replace(/\s+/g, '_')}`,
          intent: this.inferIntent(text, speaker),
          emphasisWords: this.extractEmphasis(text),
          pace: this.inferPace(text),
          pauseMsBefore: this.inferPauseBefore(text, turnIndex),
          pauseMsAfter: this.inferPauseAfter(text),
          // 확장 필드 (메타데이터)
          metadata: {
            hasStrongReaction,
            laughCue,
            interjection: adjustedInterjection,
            interjectionStrength: hasStrongReaction ? 3 : this.getInterjectionStrength(adjustedInterjection)
          }
        } as ScriptTurn & { metadata?: Record<string, unknown> })
      }
    }

    // 강한 감탄 2회 초과 시 경고
    if (strongReactionCount > 2) {
      console.warn(`⚠️ 강한 감탄이 ${strongReactionCount}회 사용됨 (권장: 0~2회)`)
    }

    return { turns, slideMarkers }
  }

  /**
   * 감탄사 추출
   */
  private extractInterjection(text: string): string | null {
    const interjectionPatterns = [
      /^(오…|오호|흥미롭네요|좋네요|그쵸)/,
      /^(우와|대박인데요|와 진짜요\?)/,
      /^(아,|아…|음,|오,|헐|와…)/,
      /(맞아요|그렇죠|그렇군요|오케이)$/
    ]

    for (const pattern of interjectionPatterns) {
      const match = text.match(pattern)
      if (match) return match[1] || match[0]
    }
    return null
  }

  /**
   * 대체 감탄사 찾기 (중복 방지)
   */
  private getAlternativeInterjection(original: string, used: string[]): string {
    const alternatives: Record<string, string[]> = {
      '오…': ['음…', '오호', '아…'],
      '우와': ['와…', '오…', '대박인데요'],
      '맞아요': ['그렇죠', '그렇군요', '네'],
      '그렇죠': ['맞아요', '그렇군요', '네'],
      '와': ['오', '우와', '아'],
      '아': ['오', '음', '아…'],
      '헐': ['와…', '오…', '음…']
    }

    const alts = alternatives[original] || []
    for (const alt of alts) {
      if (used.filter(u => u === alt).length < 2) {
        return alt
      }
    }
    return original
  }

  /**
   * 감탄사 강도 판단
   */
  private getInterjectionStrength(interjection: string | null): number {
    if (!interjection) return 0

    const strong = ['우와 이건 진짜 미쳤네요', '와… 이건 좀 충격인데요', '대박']
    const medium = ['우와', '와 진짜요?', '대박인데요']
    const weak = ['오…', '오호', '흥미롭네요', '좋네요', '그쵸', '아,', '음,']

    if (strong.some(s => interjection.includes(s))) return 3
    if (medium.some(m => interjection.includes(m))) return 2
    if (weak.some(w => interjection.includes(w))) return 1
    return 0
  }

  /**
   * 슬라이드 생성 (Nano Banana 사용)
   */
  private async generateSlides(
    markers: Array<{ afterTurnIndex: number; description: string }>,
    document: DocumentContext,
    config: PipelineConfig
  ): Promise<SlideData[]> {
    const slides: SlideData[] = []

    // 타이틀 슬라이드
    slides.push({
      id: uuidv4(),
      type: 'title',
      title: document.title,
      content: document.keyFacts[0] || '',
      startTimeSec: 0,
      endTimeSec: 10
    })

    // 마커 기반 슬라이드 생성
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i]
      const slideType = this.inferSlideType(marker.description)

      const slide: SlideData = {
        id: uuidv4(),
        type: slideType,
        title: marker.description,
        startTimeSec: 0, // 나중에 계산
        endTimeSec: 0
      }

      // 이미지 슬라이드면 Nano Banana로 생성
      if (slideType === 'image') {
        try {
          const imageResult = await this.generateImage(marker.description)
          if (imageResult) {
            slide.imageUrl = imageResult
            slide.imagePrompt = marker.description
          }
        } catch (e) {
          console.warn('이미지 생성 실패:', marker.description)
        }
      }

      // 차트 슬라이드
      if (slideType === 'chart') {
        slide.chartData = this.extractChartData(marker.description, document)
      }

      slides.push(slide)
    }

    // 요약 슬라이드
    slides.push({
      id: uuidv4(),
      type: 'summary',
      title: '핵심 정리',
      content: document.keyFacts.slice(0, 3).join('\n'),
      startTimeSec: 0,
      endTimeSec: 0
    })

    return slides
  }

  /**
   * Nano Banana로 이미지 생성
   */
  private async generateImage(prompt: string): Promise<string | null> {
    try {
      const response = await fetch(this.nanoBananaApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `podcast illustration: ${prompt}`,
          style: 'digital_art',
          aspectRatio: '16:9'
        })
      })

      if (!response.ok) return null

      const data = await response.json()
      return data.success ? data.image_url : null
    } catch {
      return null
    }
  }

  /**
   * 슬라이드 타입 추론
   */
  private inferSlideType(description: string): SlideData['type'] {
    const lower = description.toLowerCase()

    if (lower.includes('차트') || lower.includes('그래프') || lower.includes('통계') || lower.includes('%')) {
      return 'chart'
    }
    if (lower.includes('이미지') || lower.includes('사진') || lower.includes('그림') || lower.includes('모습')) {
      return 'image'
    }
    if (lower.includes('인용') || lower.includes('"')) {
      return 'quote'
    }
    if (lower.includes('정리') || lower.includes('요약')) {
      return 'summary'
    }
    return 'content'
  }

  /**
   * 차트 데이터 추출
   */
  private extractChartData(description: string, document: DocumentContext): ChartData {
    // 문서에서 숫자 데이터 추출 시도
    const numbers = document.numbers.slice(0, 5)

    return {
      type: 'bar',
      labels: numbers.map(n => n.context.slice(0, 15) || n.value),
      values: numbers.map(n => parseFloat(n.value.replace(/[^0-9.]/g, '')) || 0),
      title: description
    }
  }

  /**
   * 타임라인 구축 (정밀 동기화)
   */
  private buildTimeline(turns: ScriptTurn[], slides: SlideData[]): TimelineMarker[] {
    const timeline: TimelineMarker[] = []
    const turnTimings: Array<{ turnIndex: number; startSec: number; endSec: number }> = []
    let currentTime = 0

    // 1. 각 턴의 시작/종료 시간 계산
    for (const turn of turns) {
      const startSec = currentTime
      const duration = this.estimateTurnDuration(turn)
      const endSec = currentTime + duration

      turnTimings.push({ turnIndex: turn.index, startSec, endSec })

      // 섹션 시작 마커
      if (turn.index === 0 || (turn.index > 0 && turn.sectionId !== turns[turn.index - 1]?.sectionId)) {
        timeline.push({
          timeSec: currentTime,
          type: 'section_start',
          label: turn.sectionId
        })
      }

      // 강조 지점 (특정 의도)
      const turnMeta = (turn as ScriptTurn & { metadata?: Record<string, unknown> }).metadata
      if (turnMeta?.hasStrongReaction) {
        timeline.push({
          timeSec: currentTime + 0.5,
          type: 'emphasis',
          label: 'strong_reaction'
        })
      }

      // 일시 정지 지점 (질문 후)
      if (turn.intent === 'ask_question') {
        timeline.push({
          timeSec: endSec - 0.3,
          type: 'pause',
          label: 'after_question'
        })
      }

      currentTime = endSec
    }

    const totalDuration = currentTime

    // 2. 슬라이드 타이밍 - 균등 분배가 아닌 턴 기반 배치
    if (slides.length > 0) {
      // 타이틀 슬라이드는 처음 10초
      slides[0].startTimeSec = 0
      slides[0].endTimeSec = Math.min(10, totalDuration / slides.length)

      // 나머지 슬라이드는 내용 기반으로 분배
      const contentSlides = slides.slice(1)
      const contentDuration = totalDuration - slides[0].endTimeSec
      const avgSlideTime = contentDuration / (contentSlides.length || 1)

      contentSlides.forEach((slide, i) => {
        slide.startTimeSec = slides[0].endTimeSec + i * avgSlideTime
        slide.endTimeSec = slides[0].endTimeSec + (i + 1) * avgSlideTime

        timeline.push({
          timeSec: slide.startTimeSec,
          type: 'slide_change',
          slideId: slide.id,
          label: slide.title
        })
      })

      // 첫 슬라이드 마커
      timeline.push({
        timeSec: 0,
        type: 'slide_change',
        slideId: slides[0].id,
        label: slides[0].title
      })
    }

    // 3. 정렬 및 중복 제거
    return timeline
      .sort((a, b) => a.timeSec - b.timeSec)
      .filter((marker, i, arr) => {
        if (i === 0) return true
        const prev = arr[i - 1]
        // 같은 시간, 같은 타입이면 중복
        return !(Math.abs(marker.timeSec - prev.timeSec) < 0.1 && marker.type === prev.type)
      })
  }

  /**
   * 대본 품질 검증
   */
  private validateScript(turns: ScriptTurn[]): {
    isValid: boolean
    warnings: string[]
    errors: string[]
  } {
    const warnings: string[] = []
    const errors: string[] = []

    // 1. 강한 감탄 횟수 체크
    let strongReactionCount = 0
    let openingStrongReaction = false

    turns.forEach((turn, i) => {
      const meta = (turn as ScriptTurn & { metadata?: Record<string, unknown> }).metadata
      if (meta?.hasStrongReaction) {
        strongReactionCount++
        // 오프닝 90초 이내 강한 감탄 체크 (대략 처음 10턴)
        if (i < 10) {
          openingStrongReaction = true
        }
      }
    })

    if (strongReactionCount > 2) {
      warnings.push(`강한 감탄 ${strongReactionCount}회 사용 (권장: 0~2회)`)
    }
    if (openingStrongReaction) {
      errors.push('오프닝에서 강한 감탄 사용 금지')
    }

    // 2. 감탄사 반복 체크
    const interjectionCount: Record<string, number> = {}
    turns.forEach(turn => {
      const meta = (turn as ScriptTurn & { metadata?: Record<string, unknown> }).metadata
      const intj = meta?.interjection as string
      if (intj) {
        interjectionCount[intj] = (interjectionCount[intj] || 0) + 1
      }
    })

    Object.entries(interjectionCount).forEach(([intj, count]) => {
      if (count > 2 && intj !== '맞아요') {
        warnings.push(`감탄사 "${intj}" ${count}회 반복 (최대 2회 권장)`)
      }
      if (intj === '맞아요' && count > 3) {
        warnings.push(`"맞아요" ${count}회 반복 (최대 3회 권장)`)
      }
    })

    // 3. 연속 감탄 체크
    for (let i = 1; i < turns.length; i++) {
      const prevMeta = (turns[i - 1] as ScriptTurn & { metadata?: Record<string, unknown> }).metadata
      const currMeta = (turns[i] as ScriptTurn & { metadata?: Record<string, unknown> }).metadata
      if (prevMeta?.interjection && currMeta?.interjection) {
        if ((prevMeta.interjectionStrength as number) >= 2 && (currMeta.interjectionStrength as number) >= 2) {
          warnings.push(`턴 ${i - 1}~${i}: 연속 중간/강한 감탄 (1턴 간격 권장)`)
        }
      }
    }

    // 4. 금지 슬랭 체크
    const forbiddenPatterns = ['레전드', '킹받', 'ㅋㅋ', '개쩌', '핵꿀잼', '찢었다', '개꿀']
    turns.forEach((turn, i) => {
      forbiddenPatterns.forEach(pattern => {
        if (turn.rawText.includes(pattern)) {
          errors.push(`턴 ${i}: 금지 슬랭 "${pattern}" 사용`)
        }
      })
    })

    // 5. 격식체 체크
    const formalPatterns = [/입니다\s*[.!]/, /하겠습니다\s*[.!]/]
    turns.forEach((turn, i) => {
      formalPatterns.forEach(pattern => {
        if (pattern.test(turn.rawText)) {
          warnings.push(`턴 ${i}: 격식체 사용 (→ ~요, ~죠 권장)`)
        }
      })
    })

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    }
  }

  /**
   * ScriptDraft 구축
   */
  private buildScriptDraft(
    turns: ScriptTurn[],
    document: DocumentContext,
    config: PipelineConfig
  ): ScriptDraft {
    // 세그먼트 구성
    const sectionIds = [...new Set(turns.map(t => t.sectionId))]
    const segments: ScriptSegment[] = sectionIds.map((sectionId, i) => {
      const sectionTurns = turns.filter(t => t.sectionId === sectionId)
      return {
        id: `seg_${i}`,
        title: sectionId.replace('sec_', ''),
        type: i === 0 ? 'opening' : i === sectionIds.length - 1 ? 'closing' : 'keypoint',
        startTurnIndex: sectionTurns[0]?.index || 0,
        endTurnIndex: sectionTurns[sectionTurns.length - 1]?.index || 0,
        targetDurationSec: config.targetDurationSec / sectionIds.length
      }
    })

    // 안전성 검사
    const safety = this.checkSafety(turns)

    return {
      id: uuidv4(),
      version: '3.0.0',
      createdAt: new Date().toISOString(),
      preset: config.preset,
      banterLevel: config.banterLevel,
      targetDurationSec: config.targetDurationSec,
      turns,
      segments,
      safety,
      outline: document.keyFacts
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private inferIntent(text: string, speaker: Speaker): ScriptTurn['intent'] {
    if (text.includes('?')) return 'ask_question'
    if (text.match(/^(오|아|헐|와|음|에)/)) return 'react'
    if (text.includes('예를 들') || text.includes('비유하자면')) return 'give_example'
    if (text.includes('정리') || text.includes('요약')) return 'summarize'
    if (text.includes('오늘') && text.includes('알아볼')) return 'opener_hook'
    if (text.includes('다음에') || text.includes('마무리')) return 'closing'
    return speaker === 'HOST_A' ? 'explain_point' : 'react'
  }

  private inferPace(text: string): ScriptTurn['pace'] {
    if (text.length < 20) return 'fast'
    if (text.includes('천천히') || text.includes('중요한')) return 'slow'
    return 'normal'
  }

  private extractEmphasis(text: string): string[] {
    const patterns = [
      /(?:정말|진짜|완전|특히|가장)\s*(\S+)/g,
      /"([^"]+)"/g
    ]
    const words: string[] = []
    for (const p of patterns) {
      let m
      while ((m = p.exec(text)) !== null) {
        if (m[1]) words.push(m[1])
      }
    }
    return [...new Set(words)]
  }

  private inferPauseBefore(text: string, index: number): number {
    if (index === 0) return 0
    if (text.match(/^(음|그래서|자)/)) return 300
    return 150 + Math.random() * 150
  }

  private inferPauseAfter(text: string): number {
    if (text.endsWith('?')) return 400
    if (text.endsWith('!')) return 200
    return 200 + Math.random() * 100
  }

  private estimateTurnDuration(turn: ScriptTurn): number {
    const charCount = turn.rawText.length
    const charsPerSecond = turn.pace === 'slow' ? 4 : turn.pace === 'fast' ? 6 : 5
    return (charCount / charsPerSecond) + (turn.pauseMsBefore + turn.pauseMsAfter) / 1000
  }

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
    }

    safety.forbiddenSlangDetected = [...new Set(safety.forbiddenSlangDetected)]
    return safety
  }
}

// ============================================================================
// Gemini Provider
// ============================================================================

export class GeminiProvider implements AIProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(prompt: string, systemPrompt: string): Promise<string> {
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
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 16384
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
// Factory
// ============================================================================

export function createNotebookLMGenerator(
  apiKey: string,
  model?: string,
  nanoBananaUrl?: string
): NotebookLMStyleGenerator {
  const provider = new GeminiProvider(apiKey, model)
  return new NotebookLMStyleGenerator(provider, nanoBananaUrl)
}

export default NotebookLMStyleGenerator
