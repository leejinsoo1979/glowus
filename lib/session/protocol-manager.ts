/**
 * Protocol Manager - 모드별 세션 진행 규칙 엔진
 *
 * 무한 되묻기/결론 부재를 방지하고
 * 각 모드에 맞는 구조화된 진행을 강제합니다.
 */

import type { SessionMessage } from '@/components/session-room/ChatPanel'

type SessionMode = 'meeting' | 'presentation' | 'debate' | 'free'

interface ProtocolState {
  mode: SessionMode
  startedAt: Date
  timeLimit?: number // seconds
  currentPhase: string
  phaseStartedAt: Date
  speakingQueue: string[]
  roundCount: number
  questionCount: Record<string, number> // participantId -> count
}

interface MeetingOutputs {
  decisions: string[]
  actionItems: { task: string; assignee?: string; deadline?: string }[]
  risks: string[]
  nextSteps: string[]
}

interface DebateOutputs {
  teamAPosition: string
  teamBPosition: string
  crossExamPoints: { team: 'A' | 'B'; point: string }[]
  synthesis: string
  scores: { teamA: number; teamB: number }
}

interface PresentationOutputs {
  summary: string
  keyPoints: string[]
  questions: { question: string; answer?: string }[]
  followUps: string[]
}

/**
 * 회의모드 프로토콜
 */
export class MeetingProtocol {
  private state: ProtocolState
  private outputs: MeetingOutputs
  private messages: SessionMessage[]

  constructor(timeLimit?: number) {
    this.state = {
      mode: 'meeting',
      startedAt: new Date(),
      timeLimit,
      currentPhase: 'opening',
      phaseStartedAt: new Date(),
      speakingQueue: [],
      roundCount: 0,
      questionCount: {}
    }

    this.outputs = {
      decisions: [],
      actionItems: [],
      risks: [],
      nextSteps: []
    }

    this.messages = []
  }

  /**
   * 메시지 추가 및 프로토콜 규칙 적용
   */
  processMessage(message: SessionMessage): {
    allowed: boolean
    suggestion?: string
    forceConclusion?: boolean
  } {
    this.messages.push(message)

    // 질문 카운트 추적
    const participantId = message.participantId
    if (!this.state.questionCount[participantId]) {
      this.state.questionCount[participantId] = 0
    }

    // 질문 패턴 감지
    if (this.isQuestion(message.content)) {
      this.state.questionCount[participantId]++
    }

    // 같은 질문 2회 반복 감지
    if (this.detectRepeatedQuestion(message)) {
      return {
        allowed: true,
        suggestion: '같은 질문이 반복되고 있습니다. 결정 프레임으로 전환하세요.',
        forceConclusion: true
      }
    }

    // 타임박스 체크
    const elapsed = (Date.now() - this.state.startedAt.getTime()) / 1000
    if (this.state.timeLimit && elapsed >= this.state.timeLimit) {
      return {
        allowed: true,
        suggestion: '시간이 종료되었습니다. 결론을 도출하세요.',
        forceConclusion: true
      }
    }

    return { allowed: true }
  }

  /**
   * 결론 생성 프롬프트
   */
  generateConclusionPrompt(): string {
    return `## 회의 결론 도출

지금까지의 논의를 바탕으로 다음을 정리하세요:

1. **결정사항 (Decision)**
   - 최소 1개 이상의 명확한 결정
   - 근거와 함께 제시

2. **액션 아이템**
   - 구체적인 실행 과제
   - 담당자 (가능한 경우)
   - 기한 (가능한 경우)

3. **리스크 및 주의사항**
   - 잠재적 위험 요소
   - 주의가 필요한 부분

4. **다음 단계**
   - 후속 회의 필요 여부
   - 추가 검토 사항

각 항목은 [Evidence: ...] 형식으로 근거를 명시하세요.`
  }

  /**
   * 산출물 추출
   */
  extractOutputs(content: string): MeetingOutputs {
    // 결정사항 추출
    const decisionMatch = content.match(/결정(?:사항)?[:\s]*([^#]+?)(?=##|액션|리스크|다음|$)/is)
    if (decisionMatch) {
      const decisions = decisionMatch[1]
        .split(/[-•]\s*/)
        .filter(d => d.trim().length > 10)
        .map(d => d.trim())
      this.outputs.decisions.push(...decisions)
    }

    // 액션 아이템 추출
    const actionMatch = content.match(/액션[:\s]*([^#]+?)(?=##|리스크|다음|$)/is)
    if (actionMatch) {
      const actions = actionMatch[1]
        .split(/[-•]\s*/)
        .filter(a => a.trim().length > 5)
        .map(a => ({ task: a.trim() }))
      this.outputs.actionItems.push(...actions)
    }

    // 리스크 추출
    const riskMatch = content.match(/리스크[:\s]*([^#]+?)(?=##|다음|$)/is)
    if (riskMatch) {
      const risks = riskMatch[1]
        .split(/[-•]\s*/)
        .filter(r => r.trim().length > 5)
        .map(r => r.trim())
      this.outputs.risks.push(...risks)
    }

    return this.outputs
  }

  private isQuestion(content: string): boolean {
    return content.includes('?') || /어떻게|무엇|왜|어디|누가|언제/.test(content)
  }

  private detectRepeatedQuestion(message: SessionMessage): boolean {
    const recentMessages = this.messages.slice(-10)
    const similar = recentMessages.filter(m =>
      m.participantId !== message.participantId &&
      this.calculateSimilarity(m.content, message.content) > 0.7
    )
    return similar.length >= 2
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = [...wordsA].filter(w => wordsB.has(w))
    return intersection.length / Math.max(wordsA.size, wordsB.size)
  }
}

/**
 * 토론모드 프로토콜
 */
export class DebateProtocol {
  private state: ProtocolState
  private outputs: DebateOutputs
  private teamA: string[] = []
  private teamB: string[] = []

  constructor(teamA: string[], teamB: string[]) {
    this.teamA = teamA
    this.teamB = teamB

    this.state = {
      mode: 'debate',
      startedAt: new Date(),
      currentPhase: 'opening',
      phaseStartedAt: new Date(),
      speakingQueue: [],
      roundCount: 0,
      questionCount: {}
    }

    this.outputs = {
      teamAPosition: '',
      teamBPosition: '',
      crossExamPoints: [],
      synthesis: '',
      scores: { teamA: 0, teamB: 0 }
    }
  }

  /**
   * 현재 라운드의 발언 규칙
   */
  getCurrentRules(): {
    phase: 'opening' | 'cross' | 'rebuttal' | 'synthesis'
    allowedSpeakers: string[]
    instruction: string
  } {
    switch (this.state.currentPhase) {
      case 'opening':
        return {
          phase: 'opening',
          allowedSpeakers: [...this.teamA, ...this.teamB],
          instruction: '각 팀의 입장을 근거와 함께 제시하세요. [Evidence: ...] 필수.'
        }
      case 'cross':
        return {
          phase: 'cross',
          allowedSpeakers: [...this.teamA, ...this.teamB],
          instruction: '상대 팀 주장의 약점을 2개 이상 지적하세요. 근거 필수.'
        }
      case 'rebuttal':
        return {
          phase: 'rebuttal',
          allowedSpeakers: [...this.teamA, ...this.teamB],
          instruction: '상대 반론에 대응하고 입장을 수정/보완하세요.'
        }
      case 'synthesis':
        return {
          phase: 'synthesis',
          allowedSpeakers: ['system'],
          instruction: '양측 주장을 종합하여 합의안 또는 판정을 도출하세요.'
        }
      default:
        return {
          phase: 'opening',
          allowedSpeakers: [],
          instruction: ''
        }
    }
  }

  /**
   * 다음 라운드로 진행
   */
  advancePhase(): void {
    const phases = ['opening', 'cross', 'rebuttal', 'synthesis']
    const currentIndex = phases.indexOf(this.state.currentPhase)
    if (currentIndex < phases.length - 1) {
      this.state.currentPhase = phases[currentIndex + 1]
      this.state.phaseStartedAt = new Date()
      this.state.roundCount++
    }
  }

  /**
   * 점수 계산 (근거 기반)
   */
  calculateScores(messages: SessionMessage[]): { teamA: number; teamB: number } {
    let teamAScore = 0
    let teamBScore = 0

    for (const message of messages) {
      const hasEvidence = message.evidence && message.evidence.length > 0
      const evidenceCount = message.evidence?.length || 0

      const isTeamA = this.teamA.includes(message.participantId)
      const isTeamB = this.teamB.includes(message.participantId)

      if (isTeamA) {
        teamAScore += hasEvidence ? (1 + evidenceCount * 0.5) : 0
      } else if (isTeamB) {
        teamBScore += hasEvidence ? (1 + evidenceCount * 0.5) : 0
      }
    }

    this.outputs.scores = { teamA: teamAScore, teamB: teamBScore }
    return this.outputs.scores
  }

  /**
   * 종합 판정 프롬프트
   */
  generateSynthesisPrompt(): string {
    return `## 토론 종합 판정

양측의 주장을 분석하고 다음을 제시하세요:

1. **Team A 핵심 주장 요약**
   - 주요 근거와 함께

2. **Team B 핵심 주장 요약**
   - 주요 근거와 함께

3. **교차검증 결과**
   - 각 팀이 제기한 유효한 반론

4. **판정 또는 합의안**
   - 근거 기반 점수: Team A ${this.outputs.scores.teamA}점, Team B ${this.outputs.scores.teamB}점
   - 최종 판정 또는 합의 가능한 중간안

증거 없는 주장은 점수에서 제외됩니다.`
  }
}

/**
 * 발표모드 프로토콜
 */
export class PresentationProtocol {
  private presenterId: string
  private state: ProtocolState
  private outputs: PresentationOutputs

  constructor(presenterId: string) {
    this.presenterId = presenterId

    this.state = {
      mode: 'presentation',
      startedAt: new Date(),
      currentPhase: 'presenting',
      phaseStartedAt: new Date(),
      speakingQueue: [],
      roundCount: 0,
      questionCount: {}
    }

    this.outputs = {
      summary: '',
      keyPoints: [],
      questions: [],
      followUps: []
    }
  }

  /**
   * 발표자 권한 확인
   */
  isPresenter(participantId: string): boolean {
    return participantId === this.presenterId
  }

  /**
   * Q&A 라운드 시작
   */
  startQA(): void {
    this.state.currentPhase = 'qa'
    this.state.phaseStartedAt = new Date()
  }

  /**
   * 질문 등록
   */
  addQuestion(question: string, askerId: string): void {
    this.outputs.questions.push({ question })
  }

  /**
   * 발표 요약 프롬프트
   */
  generateSummaryPrompt(): string {
    return `## 발표 요약

다음 형식으로 발표 내용을 정리하세요:

1. **핵심 요약** (3문장 이내)

2. **주요 포인트** (최대 5개)
   - 각 포인트에 [Evidence: ...] 근거 포함

3. **Q&A 내용**
   - 제기된 질문과 답변

4. **후속 조치**
   - 추가 검토 필요 사항
   - 다음 발표 주제 제안`
  }
}

/**
 * 자유토론 프로토콜 (되묻기 루프 방지만)
 */
export class FreeProtocol {
  private messages: SessionMessage[] = []
  private loopWarningCount = 0

  processMessage(message: SessionMessage): {
    allowed: boolean
    warning?: string
  } {
    this.messages.push(message)

    // 되묻기 루프 감지
    if (this.detectLoop()) {
      this.loopWarningCount++

      if (this.loopWarningCount >= 2) {
        return {
          allowed: true,
          warning: '대화가 반복되고 있습니다. 구체적인 질문으로 바꾸거나 3가지 옵션 중 선택하세요.'
        }
      }
    }

    return { allowed: true }
  }

  private detectLoop(): boolean {
    if (this.messages.length < 6) return false

    const recent = this.messages.slice(-6)
    const patterns = recent.map(m => m.content.substring(0, 50).toLowerCase())

    // 비슷한 패턴이 3번 이상 반복되면 루프
    const counts: Record<string, number> = {}
    for (const p of patterns) {
      const key = p.replace(/[^가-힣a-z0-9]/g, '')
      counts[key] = (counts[key] || 0) + 1
    }

    return Object.values(counts).some(c => c >= 3)
  }
}
