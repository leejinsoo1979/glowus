/**
 * Monaco Editor + Claude Code Integration
 *
 * Monaco Editor와 Claude Code CLI를 연결하여 VSCode 익스텐션과 유사한 기능 제공.
 *
 * Features:
 * - 선택 영역 컨텍스트 추적
 * - 우클릭 메뉴 액션 (Ask Claude, Explain, Refactor)
 * - 키보드 단축키 (Cmd+Shift+C, Cmd+Shift+E, Cmd+Shift+R)
 */

import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

// ============================================
// Types
// ============================================

export interface SelectionContext {
  fileName: string
  filePath: string
  language: string
  selectedCode: string
  lineRange: {
    start: number
    end: number
  }
  lineCount: number
}

export interface ClaudeAction {
  id: string
  label: string
  keybinding?: number[]
  contextMenuGroupId: string
  contextMenuOrder: number
  run: (editor: editor.ICodeEditor, context: SelectionContext) => void
}

// ============================================
// Selection Context Helper
// ============================================

/**
 * Monaco Editor에서 현재 선택 영역의 컨텍스트를 가져옴
 */
export function getSelectionContext(
  editor: editor.ICodeEditor,
  filePath: string = ''
): SelectionContext | null {
  const selection = editor.getSelection()
  const model = editor.getModel()

  if (!selection || !model || selection.isEmpty()) {
    return null
  }

  const selectedCode = model.getValueInRange(selection)
  const fileName = model.uri.path.split('/').pop() || 'file'
  const language = model.getLanguageId() || 'text'

  return {
    fileName,
    filePath: filePath || model.uri.path,
    language,
    selectedCode,
    lineRange: {
      start: selection.startLineNumber,
      end: selection.endLineNumber,
    },
    lineCount: selection.endLineNumber - selection.startLineNumber + 1,
  }
}

// ============================================
// Claude Actions Registration
// ============================================

/**
 * Claude 관련 액션을 Monaco Editor에 등록
 */
export function registerClaudeActions(
  editor: editor.IStandaloneCodeEditor,
  monaco: Monaco,
  options: {
    filePath?: string
    onAsk?: (context: SelectionContext) => void
    onExplain?: (context: SelectionContext) => void
    onRefactor?: (context: SelectionContext) => void
    onFix?: (context: SelectionContext) => void
    onOptimize?: (context: SelectionContext) => void
    onDocument?: (context: SelectionContext) => void
  }
): () => void {
  const disposables: { dispose: () => void }[] = []

  // Helper to get context and call callback
  const withContext = (callback?: (ctx: SelectionContext) => void) => {
    return () => {
      const context = getSelectionContext(editor, options.filePath)
      if (context && callback) {
        callback(context)
      }
    }
  }

  // ============================================
  // Context Menu Actions (우클릭 메뉴)
  // ============================================

  // Ask Claude
  disposables.push(
    editor.addAction({
      id: 'claude.ask',
      label: 'Claude: 선택한 코드에 대해 질문하기',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 1,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
      ],
      run: withContext(options.onAsk),
    })
  )

  // Explain
  disposables.push(
    editor.addAction({
      id: 'claude.explain',
      label: 'Claude: 코드 설명',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 2,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
      ],
      run: withContext(options.onExplain),
    })
  )

  // Refactor
  disposables.push(
    editor.addAction({
      id: 'claude.refactor',
      label: 'Claude: 리팩토링',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 3,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR,
      ],
      run: withContext(options.onRefactor),
    })
  )

  // Fix
  disposables.push(
    editor.addAction({
      id: 'claude.fix',
      label: 'Claude: 버그 수정',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 4,
      run: withContext(options.onFix),
    })
  )

  // Optimize
  disposables.push(
    editor.addAction({
      id: 'claude.optimize',
      label: 'Claude: 성능 최적화',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 5,
      run: withContext(options.onOptimize),
    })
  )

  // Document
  disposables.push(
    editor.addAction({
      id: 'claude.document',
      label: 'Claude: 문서화/주석 추가',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 6,
      run: withContext(options.onDocument),
    })
  )

  // Return cleanup function
  return () => {
    disposables.forEach((d) => d.dispose())
  }
}

// ============================================
// Prompt Builders
// ============================================

export function buildAskPrompt(context: SelectionContext, question?: string): string {
  return `
현재 파일: ${context.fileName}
선택된 코드 (${context.lineCount}줄, 라인 ${context.lineRange.start}-${context.lineRange.end}):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

${question || '이 코드에 대해 설명해주세요.'}
`.trim()
}

export function buildExplainPrompt(context: SelectionContext): string {
  return `
현재 파일: ${context.fileName}
선택된 코드 (${context.lineCount}줄):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

이 코드가 무엇을 하는지 상세히 설명해주세요:
1. 코드의 목적
2. 각 부분의 역할
3. 입력과 출력
4. 중요한 로직이나 알고리즘
`.trim()
}

export function buildRefactorPrompt(context: SelectionContext): string {
  return `
현재 파일: ${context.fileName}
리팩토링할 코드 (${context.lineCount}줄):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

이 코드를 다음 관점에서 리팩토링해주세요:
1. 가독성 향상
2. 중복 제거 (DRY)
3. 단일 책임 원칙 (SRP)
4. 더 나은 네이밍
5. 필요시 함수/컴포넌트 분리

개선된 코드와 변경 이유를 설명해주세요.
`.trim()
}

export function buildFixPrompt(context: SelectionContext): string {
  return `
현재 파일: ${context.fileName}
문제가 있는 코드 (${context.lineCount}줄):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

이 코드에서 잠재적인 버그나 문제점을 찾아서:
1. 문제점 분석
2. 수정된 코드 제시
3. 수정 이유 설명
`.trim()
}

export function buildOptimizePrompt(context: SelectionContext): string {
  return `
현재 파일: ${context.fileName}
최적화할 코드 (${context.lineCount}줄):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

이 코드의 성능을 최적화해주세요:
1. 시간 복잡도 개선
2. 메모리 사용 최적화
3. 불필요한 연산 제거
4. 캐싱 기회 식별

최적화된 코드와 예상되는 성능 향상을 설명해주세요.
`.trim()
}

export function buildDocumentPrompt(context: SelectionContext): string {
  return `
현재 파일: ${context.fileName}
문서화할 코드 (${context.lineCount}줄):
\`\`\`${context.language}
${context.selectedCode}
\`\`\`

이 코드에 적절한 문서화/주석을 추가해주세요:
1. JSDoc/TSDoc 스타일 주석
2. 파라미터와 반환값 설명
3. 사용 예시 (필요시)
4. 중요한 비즈니스 로직 설명
`.trim()
}

// ============================================
// Zustand Store Integration
// ============================================

/**
 * GlowCode Store와 Monaco 선택 영역을 동기화
 */
export function syncSelectionToStore(
  editor: editor.IStandaloneCodeEditor,
  setContext: (ctx: { selectedCode?: string; currentFile?: string }) => void,
  filePath?: string
): () => void {
  const updateSelection = () => {
    const context = getSelectionContext(editor, filePath)

    if (context) {
      setContext({
        selectedCode: context.selectedCode,
        currentFile: context.fileName,
      })
    } else {
      setContext({
        selectedCode: undefined,
      })
    }
  }

  const disposable = editor.onDidChangeCursorSelection(updateSelection)

  // Initial sync
  updateSelection()

  return () => {
    disposable.dispose()
  }
}
