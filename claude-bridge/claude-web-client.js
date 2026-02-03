/**
 * Claude Web Client
 * 브릿지 서버를 통해 Claude Code CLI와 통신
 */

class ClaudeClient {
  constructor(options = {}) {
    this.bridgeUrl = options.bridgeUrl || 'http://localhost:3333';
    this.model = options.model || null; // null이면 기본 모델 사용
    this.onError = options.onError || console.error;
  }

  // 브릿지 서버 연결 확인
  async checkConnection() {
    try {
      const res = await fetch(`${this.bridgeUrl}/health`);
      const data = await res.json();
      return { connected: true, ...data };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }

  // Claude Code 버전 확인
  async getVersion() {
    try {
      const res = await fetch(`${this.bridgeUrl}/version`);
      return await res.json();
    } catch (e) {
      this.onError(e);
      return null;
    }
  }

  // 일반 질문 (스트리밍)
  async ask(prompt, options = {}) {
    const { onChunk, onComplete, cwd } = options;
    
    try {
      const res = await fetch(`${this.bridgeUrl}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          cwd,
          model: this.model
        })
      });

      return this._handleStream(res, onChunk, onComplete);
    } catch (e) {
      this.onError(e);
      throw e;
    }
  }

  // 코드와 함께 질문 (스트리밍)
  async askWithCode(prompt, code, options = {}) {
    const { language, filename, onChunk, onComplete, cwd } = options;
    
    try {
      const res = await fetch(`${this.bridgeUrl}/claude/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          code,
          language,
          filename,
          cwd,
          model: this.model
        })
      });

      return this._handleStream(res, onChunk, onComplete);
    } catch (e) {
      this.onError(e);
      throw e;
    }
  }

  // 동기 요청 (스트리밍 없이)
  async askSync(prompt, options = {}) {
    const { code, language, cwd } = options;
    
    try {
      const res = await fetch(`${this.bridgeUrl}/claude/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          code,
          language,
          cwd,
          model: this.model
        })
      });

      return await res.json();
    } catch (e) {
      this.onError(e);
      throw e;
    }
  }

  // 스트림 처리
  async _handleStream(response, onChunk, onComplete) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            
            if (data.type === 'assistant') {
              // 텍스트 청크
              const text = data.content || '';
              fullText += text;
              if (onChunk) onChunk(text, data);
            } else if (data.type === 'done') {
              // 완료
              if (onComplete) onComplete(fullText, data);
            } else if (data.type === 'error') {
              // 에러
              this.onError(new Error(data.content));
            }
          } catch {
            // JSON 파싱 실패 - 텍스트로 처리
            fullText += jsonStr;
            if (onChunk) onChunk(jsonStr, null);
          }
        }
      }
    }

    return fullText;
  }

  // 모델 변경
  setModel(model) {
    this.model = model;
  }

  // 프리셋 프롬프트
  async explain(code, language) {
    return this.askWithCode('이 코드를 자세히 설명해줘.', code, { language });
  }

  async refactor(code, language) {
    return this.askWithCode('이 코드를 더 깔끔하게 리팩토링해줘.', code, { language });
  }

  async findBugs(code, language) {
    return this.askWithCode('이 코드에서 버그나 개선점을 찾아줘.', code, { language });
  }

  async addComments(code, language) {
    return this.askWithCode('이 코드에 주석을 추가해줘.', code, { language });
  }

  async writeTests(code, language) {
    return this.askWithCode('이 코드의 테스트 코드를 작성해줘.', code, { language });
  }
}

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaudeClient;
}

// Browser global
if (typeof window !== 'undefined') {
  window.ClaudeClient = ClaudeClient;
}
