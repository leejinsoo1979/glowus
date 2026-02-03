/**
 * Monaco Editor Claude Plugin
 *
 * Monaco Editor에서 Claude Code CLI를 사용하기 위한 플러그인
 * - 단축키: Cmd+Shift+C (선택한 코드로 Claude에게 질문)
 * - 컨텍스트 메뉴: Claude에게 물어보기, 코드 설명, 리팩토링 제안, 버그 찾기
 *
 * @example
 * ```typescript
 * import { initMonacoClaudePlugin } from '@/lib/claude-bridge/monaco-claude-plugin'
 * import * as monaco from 'monaco-editor'
 *
 * const editor = monaco.editor.create(container, { ... })
 *
 * initMonacoClaudePlugin(editor, {
 *   bridgeUrl: 'http://localhost:3333',
 *   onResponse: (response, type) => {
 *     // 응답 처리 (패널에 표시 등)
 *   },
 *   onStreaming: (chunk) => {
 *     // 스트리밍 중 처리
 *   },
 * })
 * ```
 */

import type * as Monaco from 'monaco-editor'
import { ClaudeWebClient, StreamChunk } from './claude-web-client'

export interface MonacoClaudePluginOptions {
  bridgeUrl?: string
  onResponse?: (response: string, type: ClaudeActionType) => void
  onStreaming?: (chunk: StreamChunk) => void
  onError?: (error: Error) => void
  onStart?: (type: ClaudeActionType) => void
  onEnd?: (type: ClaudeActionType) => void
  showInlineResponse?: boolean
  responsePosition?: 'panel' | 'inline' | 'modal'
}

export type ClaudeActionType =
  | 'ask'
  | 'explain'
  | 'refactor'
  | 'findBugs'
  | 'optimize'
  | 'addComments'
  | 'writeTests'
  | 'custom'

interface ClaudeAction {
  id: string
  label: string
  type: ClaudeActionType
  prompt: (code: string, language: string, filename?: string) => string
  keybinding?: number[]
  contextMenuGroupId?: string
  contextMenuOrder?: number
}

// 기본 액션 정의
const DEFAULT_ACTIONS: ClaudeAction[] = [
  {
    id: 'claude.askAboutCode',
    label: 'Claude: 선택한 코드에 대해 질문하기',
    type: 'ask',
    prompt: (code, language) =>
      `다음 ${language} 코드에 대해 질문이 있어요. 코드를 분석하고 설명해주세요.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    keybinding: [
      2048 + 1024 + 33, // Cmd/Ctrl + Shift + C
    ],
    contextMenuGroupId: 'claude',
    contextMenuOrder: 1,
  },
  {
    id: 'claude.explainCode',
    label: 'Claude: 코드 설명',
    type: 'explain',
    prompt: (code, language) =>
      `다음 ${language} 코드를 상세히 설명해줘. 각 부분이 무엇을 하는지, 왜 이렇게 작성되었는지 알려줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    keybinding: [
      2048 + 1024 + 35, // Cmd/Ctrl + Shift + E
    ],
    contextMenuGroupId: 'claude',
    contextMenuOrder: 2,
  },
  {
    id: 'claude.refactorCode',
    label: 'Claude: 리팩토링 제안',
    type: 'refactor',
    prompt: (code, language) =>
      `다음 ${language} 코드를 리팩토링해줘. 더 깔끔하고, 읽기 쉽고, 유지보수하기 좋은 코드로 개선해줘. 변경 사항과 이유를 설명해줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    keybinding: [
      2048 + 1024 + 48, // Cmd/Ctrl + Shift + R
    ],
    contextMenuGroupId: 'claude',
    contextMenuOrder: 3,
  },
  {
    id: 'claude.findBugs',
    label: 'Claude: 버그 찾기',
    type: 'findBugs',
    prompt: (code, language) =>
      `다음 ${language} 코드에서 잠재적인 버그, 에러, 문제점을 찾아줘. 각 문제에 대해 원인과 해결 방법을 알려줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    keybinding: [
      2048 + 1024 + 32, // Cmd/Ctrl + Shift + B
    ],
    contextMenuGroupId: 'claude',
    contextMenuOrder: 4,
  },
  {
    id: 'claude.optimizeCode',
    label: 'Claude: 성능 최적화',
    type: 'optimize',
    prompt: (code, language) =>
      `다음 ${language} 코드의 성능을 최적화해줘. 시간 복잡도, 공간 복잡도, 불필요한 연산 등을 분석하고 개선해줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    contextMenuGroupId: 'claude',
    contextMenuOrder: 5,
  },
  {
    id: 'claude.addComments',
    label: 'Claude: 주석 추가',
    type: 'addComments',
    prompt: (code, language) =>
      `다음 ${language} 코드에 적절한 주석을 추가해줘. JSDoc/TSDoc 스타일로 함수 설명을 추가하고, 복잡한 로직에는 인라인 주석을 달아줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    contextMenuGroupId: 'claude',
    contextMenuOrder: 6,
  },
  {
    id: 'claude.writeTests',
    label: 'Claude: 테스트 코드 작성',
    type: 'writeTests',
    prompt: (code, language) =>
      `다음 ${language} 코드에 대한 유닛 테스트를 작성해줘. Jest를 사용하고, 다양한 케이스를 커버해줘.\n\n\`\`\`${language}\n${code}\n\`\`\``,
    contextMenuGroupId: 'claude',
    contextMenuOrder: 7,
  },
]

export class MonacoClaudePlugin {
  private editor: Monaco.editor.IStandaloneCodeEditor
  private client: ClaudeWebClient
  private options: MonacoClaudePluginOptions
  private disposables: Monaco.IDisposable[] = []
  private isProcessing = false
  private inlineWidget: Monaco.editor.IContentWidget | null = null
  private responseDecorations: string[] = []

  constructor(
    editor: Monaco.editor.IStandaloneCodeEditor,
    options: MonacoClaudePluginOptions = {}
  ) {
    this.editor = editor
    this.options = options
    this.client = new ClaudeWebClient(options.bridgeUrl || 'http://localhost:3333')

    this.registerActions()
    this.registerContextMenu()
  }

  /**
   * 액션 등록
   */
  private registerActions(): void {
    for (const action of DEFAULT_ACTIONS) {
      const disposable = this.editor.addAction({
        id: action.id,
        label: action.label,
        keybindings: action.keybinding,
        contextMenuGroupId: action.contextMenuGroupId,
        contextMenuOrder: action.contextMenuOrder,
        run: async () => {
          await this.executeAction(action)
        },
      })

      this.disposables.push(disposable)
    }

    // 커스텀 프롬프트 액션
    const customAction = this.editor.addAction({
      id: 'claude.customPrompt',
      label: 'Claude: 커스텀 프롬프트',
      keybindings: [2048 + 1024 + 41], // Cmd/Ctrl + Shift + K
      contextMenuGroupId: 'claude',
      contextMenuOrder: 0,
      run: async () => {
        const prompt = window.prompt('Claude에게 물어볼 내용을 입력하세요:')
        if (prompt) {
          await this.executeCustomPrompt(prompt)
        }
      },
    })

    this.disposables.push(customAction)
  }

  /**
   * 컨텍스트 메뉴 등록
   */
  private registerContextMenu(): void {
    // Monaco의 기본 컨텍스트 메뉴에 Claude 섹션 추가
    // (addAction에서 contextMenuGroupId를 설정하면 자동으로 추가됨)
  }

  /**
   * 액션 실행
   */
  private async executeAction(action: ClaudeAction): Promise<void> {
    if (this.isProcessing) {
      console.warn('[MonacoClaudePlugin] Already processing a request')
      return
    }

    const selection = this.editor.getSelection()
    if (!selection || selection.isEmpty()) {
      this.showNotification('코드를 선택해주세요', 'warning')
      return
    }

    const model = this.editor.getModel()
    if (!model) return

    const selectedCode = model.getValueInRange(selection)
    const language = model.getLanguageId()
    const filename = (model as any).uri?.path?.split('/').pop()

    const prompt = action.prompt(selectedCode, language, filename)

    await this.sendToClaudeWithStreaming(prompt, action.type)
  }

  /**
   * 커스텀 프롬프트 실행
   */
  private async executeCustomPrompt(customPrompt: string): Promise<void> {
    if (this.isProcessing) return

    const selection = this.editor.getSelection()
    const model = this.editor.getModel()
    if (!model) return

    let prompt = customPrompt

    // 코드가 선택되어 있으면 포함
    if (selection && !selection.isEmpty()) {
      const selectedCode = model.getValueInRange(selection)
      const language = model.getLanguageId()
      prompt = `다음 ${language} 코드에 대해: ${customPrompt}\n\n\`\`\`${language}\n${selectedCode}\n\`\`\``
    }

    await this.sendToClaudeWithStreaming(prompt, 'custom')
  }

  /**
   * Claude에게 스트리밍 요청
   */
  private async sendToClaudeWithStreaming(
    prompt: string,
    type: ClaudeActionType
  ): Promise<void> {
    this.isProcessing = true
    this.options.onStart?.(type)

    let fullResponse = ''

    try {
      await this.client.stream(
        prompt,
        (chunk) => {
          if (chunk.type === 'text') {
            fullResponse = chunk.content || ''
            this.options.onStreaming?.(chunk)

            // 인라인 응답 표시 (옵션)
            if (this.options.showInlineResponse) {
              this.updateInlineResponse(fullResponse)
            }
          } else if (chunk.type === 'error') {
            const error = new Error(chunk.message || 'Unknown error')
            this.options.onError?.(error)
          } else if (chunk.type === 'done') {
            this.options.onResponse?.(fullResponse, type)
          }
        }
      )
    } catch (error: any) {
      this.options.onError?.(error)
      this.showNotification(`오류: ${error.message}`, 'error')
    } finally {
      this.isProcessing = false
      this.options.onEnd?.(type)
    }
  }

  /**
   * 인라인 응답 업데이트
   */
  private updateInlineResponse(content: string): void {
    const selection = this.editor.getSelection()
    if (!selection) return

    // 이전 데코레이션 제거
    this.clearInlineResponse()

    // 새 데코레이션 추가 (응답을 선택 영역 아래에 표시)
    const endLine = selection.endLineNumber

    this.responseDecorations = this.editor.deltaDecorations([], [
      {
        range: {
          startLineNumber: endLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: 1,
        },
        options: {
          afterContentClassName: 'claude-inline-response',
          after: {
            content: `\n/* Claude: ${content.substring(0, 100)}... */`,
            inlineClassName: 'claude-inline-text',
          },
        },
      },
    ])
  }

  /**
   * 인라인 응답 제거
   */
  clearInlineResponse(): void {
    if (this.responseDecorations.length > 0) {
      this.editor.deltaDecorations(this.responseDecorations, [])
      this.responseDecorations = []
    }
  }

  /**
   * 알림 표시
   */
  private showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
    // Monaco는 기본 알림 시스템이 없으므로 콘솔 또는 커스텀 UI 사용
    console.log(`[MonacoClaudePlugin] ${type}: ${message}`)

    // 간단한 alert로 대체 (실제 사용 시 커스텀 토스트 사용)
    if (type === 'error' || type === 'warning') {
      // 가능하면 커스텀 토스트 UI 사용
    }
  }

  /**
   * 코드 삽입 (Claude 응답을 에디터에 삽입)
   */
  insertCode(code: string, position?: 'cursor' | 'end' | 'replace'): void {
    const selection = this.editor.getSelection()
    if (!selection) return

    const model = this.editor.getModel()
    if (!model) return

    let range: Monaco.IRange

    switch (position) {
      case 'replace':
        range = selection
        break
      case 'end':
        const lastLine = model.getLineCount()
        const lastColumn = model.getLineMaxColumn(lastLine)
        range = {
          startLineNumber: lastLine,
          startColumn: lastColumn,
          endLineNumber: lastLine,
          endColumn: lastColumn,
        }
        code = '\n\n' + code
        break
      case 'cursor':
      default:
        range = {
          startLineNumber: selection.endLineNumber,
          startColumn: selection.endColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        }
        code = '\n' + code
    }

    this.editor.executeEdits('claude-plugin', [
      {
        range,
        text: code,
        forceMoveMarkers: true,
      },
    ])
  }

  /**
   * Diff 뷰 표시 (원본과 수정된 코드 비교)
   */
  showDiff(originalCode: string, modifiedCode: string): Monaco.editor.IStandaloneDiffEditor | null {
    // Diff 에디터를 위한 컨테이너가 필요함
    // 실제 구현 시 모달이나 사이드 패널에 표시
    console.log('[MonacoClaudePlugin] Diff view requested')
    console.log('Original:', originalCode.substring(0, 100))
    console.log('Modified:', modifiedCode.substring(0, 100))

    return null
  }

  /**
   * 요청 취소
   */
  cancel(): void {
    this.client.cancel()
    this.isProcessing = false
  }

  /**
   * 브릿지 연결 확인
   */
  async checkConnection(): Promise<boolean> {
    const result = await this.client.checkConnection()
    return result !== null
  }

  /**
   * 외부에서 직접 질문 (선택 영역 코드 포함)
   */
  async ask(prompt: string): Promise<void> {
    if (this.isProcessing) return

    const model = this.editor.getModel()
    if (!model) return

    const selection = this.editor.getSelection()
    let fullPrompt = prompt

    // 코드가 선택되어 있으면 포함
    if (selection && !selection.isEmpty()) {
      const code = model.getValueInRange(selection)
      const language = model.getLanguageId()
      fullPrompt = `다음 ${language} 코드에 대해: ${prompt}\n\n\`\`\`${language}\n${code}\n\`\`\``
    }

    await this.sendToClaudeWithStreaming(fullPrompt, 'ask')
  }

  /**
   * 선택된 코드 가져오기
   */
  getSelectedCode(): string {
    const selection = this.editor.getSelection()
    const model = this.editor.getModel()

    if (!selection || !model || selection.isEmpty()) {
      return model?.getValue() || ''
    }

    return model.getValueInRange(selection)
  }

  /**
   * 현재 언어 가져오기
   */
  getLanguage(): string {
    const model = this.editor.getModel()
    return model?.getLanguageId() || 'plaintext'
  }

  /**
   * Claude 클라이언트 접근 (프리셋 메서드용)
   */
  getClient(): ClaudeWebClient {
    return this.client
  }

  /**
   * 처리 중인지 확인
   */
  get isLoading(): boolean {
    return this.isProcessing
  }

  /**
   * 플러그인 정리
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
    this.disposables = []
    this.clearInlineResponse()
  }
}

/**
 * Monaco Editor에 Claude 플러그인 초기화
 */
export function initMonacoClaudePlugin(
  editor: Monaco.editor.IStandaloneCodeEditor,
  options?: MonacoClaudePluginOptions
): MonacoClaudePlugin {
  return new MonacoClaudePlugin(editor, options)
}

/**
 * CSS 스타일 주입 (인라인 응답용)
 */
export function injectClaudeStyles(): void {
  if (typeof document === 'undefined') return

  const styleId = 'monaco-claude-plugin-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .claude-inline-response {
      display: block;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(217, 119, 87, 0.1);
      border-left: 3px solid #D97757;
      border-radius: 0 4px 4px 0;
      font-family: inherit;
    }

    .claude-inline-text {
      color: #D97757;
      font-style: italic;
      opacity: 0.9;
    }

    .monaco-editor .claude-response-decoration {
      background: rgba(217, 119, 87, 0.05);
    }

    .monaco-editor .claude-loading-decoration::after {
      content: '⏳ Claude 응답 중...';
      color: #D97757;
      font-style: italic;
      margin-left: 10px;
    }
  `
  document.head.appendChild(style)
}

export default MonacoClaudePlugin
