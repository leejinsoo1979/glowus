/**
 * Monaco Claude Plugin
 * Monaco Editor에 Claude 기능 연동
 */

class MonacoClaudePlugin {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.monaco = options.monaco || window.monaco;
    this.claude = options.claudeClient || new ClaudeClient();
    
    // UI 컨테이너
    this.panelContainer = options.panelContainer || null;
    this.outputCallback = options.onOutput || null;
    
    // 상태
    this.isLoading = false;
    this.currentRequest = null;

    this._init();
  }

  _init() {
    this._registerCommands();
    this._registerContextMenu();
    this._registerKeybindings();
  }

  // 명령어 등록
  _registerCommands() {
    // 선택한 코드로 질문
    this.editor.addAction({
      id: 'claude.askSelected',
      label: 'Claude에게 물어보기',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 1,
      run: () => this._askAboutSelection()
    });

    // 코드 설명
    this.editor.addAction({
      id: 'claude.explain',
      label: 'Claude: 코드 설명',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 2,
      run: () => this._runWithSelection('explain')
    });

    // 리팩토링
    this.editor.addAction({
      id: 'claude.refactor',
      label: 'Claude: 리팩토링 제안',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 3,
      run: () => this._runWithSelection('refactor')
    });

    // 버그 찾기
    this.editor.addAction({
      id: 'claude.findBugs',
      label: 'Claude: 버그 찾기',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 4,
      run: () => this._runWithSelection('findBugs')
    });

    // 주석 추가
    this.editor.addAction({
      id: 'claude.addComments',
      label: 'Claude: 주석 추가',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 5,
      run: () => this._runWithSelection('addComments')
    });

    // 테스트 작성
    this.editor.addAction({
      id: 'claude.writeTests',
      label: 'Claude: 테스트 작성',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 6,
      run: () => this._runWithSelection('writeTests')
    });
  }

  // 컨텍스트 메뉴 (우클릭)
  _registerContextMenu() {
    // Monaco의 addAction에서 contextMenuGroupId로 이미 추가됨
  }

  // 단축키 등록
  _registerKeybindings() {
    // Cmd+Shift+C: 선택 영역으로 Claude에게 질문
    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyMod.Shift | this.monaco.KeyCode.KeyC,
      () => this._askAboutSelection()
    );

    // Cmd+Shift+E: 코드 설명
    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyMod.Shift | this.monaco.KeyCode.KeyE,
      () => this._runWithSelection('explain')
    );

    // Cmd+Shift+R: 리팩토링
    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyMod.Shift | this.monaco.KeyCode.KeyR,
      () => this._runWithSelection('refactor')
    );
  }

  // 선택 영역 코드 가져오기
  _getSelectedCode() {
    const selection = this.editor.getSelection();
    if (!selection || selection.isEmpty()) {
      // 선택 없으면 전체 코드
      return this.editor.getValue();
    }
    return this.editor.getModel().getValueInRange(selection);
  }

  // 현재 언어 가져오기
  _getLanguage() {
    const model = this.editor.getModel();
    return model ? model.getLanguageId() : 'plaintext';
  }

  // 선택한 코드에 대해 질문 (프롬프트 입력 받음)
  async _askAboutSelection() {
    const code = this._getSelectedCode();
    const language = this._getLanguage();

    const prompt = window.prompt('Claude에게 물어볼 내용:');
    if (!prompt) return;

    await this._sendRequest(prompt, code, language);
  }

  // 프리셋 명령 실행
  async _runWithSelection(action) {
    const code = this._getSelectedCode();
    const language = this._getLanguage();

    if (!code.trim()) {
      this._output('⚠️ 코드를 선택하거나 입력해주세요.');
      return;
    }

    this.isLoading = true;
    this._output(`🔄 ${action} 실행 중...`, true);

    try {
      const result = await this.claude[action](code, language);
      this._output(result);
    } catch (e) {
      this._output(`❌ 에러: ${e.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  // Claude에 요청 보내기
  async _sendRequest(prompt, code, language) {
    if (this.isLoading) {
      this._output('⚠️ 이미 요청 처리 중입니다.');
      return;
    }

    this.isLoading = true;
    this._output('🔄 Claude 응답 대기 중...', true);

    let fullResponse = '';

    try {
      await this.claude.askWithCode(prompt, code, {
        language,
        onChunk: (chunk) => {
          fullResponse += chunk;
          this._output(fullResponse, true);
        },
        onComplete: (text) => {
          this._output(text);
        }
      });
    } catch (e) {
      this._output(`❌ 에러: ${e.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  // 출력 처리
  _output(text, isStreaming = false) {
    if (this.outputCallback) {
      this.outputCallback(text, isStreaming);
    }
    
    if (this.panelContainer) {
      this.panelContainer.innerHTML = this._formatOutput(text);
      if (!isStreaming) {
        this.panelContainer.scrollTop = this.panelContainer.scrollHeight;
      }
    }
  }

  // 마크다운 간단 포맷팅
  _formatOutput(text) {
    return text
      // 코드 블록
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // 인라인 코드
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 굵게
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 줄바꿈
      .replace(/\n/g, '<br>');
  }

  // 외부에서 직접 질문
  async ask(prompt) {
    const code = this._getSelectedCode();
    const language = this._getLanguage();
    await this._sendRequest(prompt, code, language);
  }

  // 연결 상태 확인
  async checkConnection() {
    return await this.claude.checkConnection();
  }

  // 정리
  dispose() {
    // 필요시 정리 로직
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MonacoClaudePlugin;
}

if (typeof window !== 'undefined') {
  window.MonacoClaudePlugin = MonacoClaudePlugin;
}
