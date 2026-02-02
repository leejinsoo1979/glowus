/**
 * Claude Code Executor
 *
 * 에이전트가 Claude Code CLI를 통해 작업을 실행
 * Agent Claude Manager 서버와 통신
 */

const AGENT_CLAUDE_URL = process.env.AGENT_CLAUDE_URL || 'http://localhost:3100';

interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  agentId?: string;
}

/**
 * 에이전트의 Claude Code 세션 시작
 */
export async function startAgentClaudeSession(
  agentId: string,
  agentName: string
): Promise<ExecuteResult> {
  try {
    const res = await fetch(`${AGENT_CLAUDE_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, agentName }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: `Claude Manager 연결 실패: ${error.message}`,
    };
  }
}

/**
 * 에이전트의 Claude Code 세션 종료
 */
export async function stopAgentClaudeSession(agentId: string): Promise<ExecuteResult> {
  try {
    const res = await fetch(`${AGENT_CLAUDE_URL}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: `Claude Manager 연결 실패: ${error.message}`,
    };
  }
}

/**
 * 에이전트에게 Claude Code로 작업 실행 요청
 */
export async function executeWithClaudeCode(
  agentId: string,
  agentName: string,
  task: string
): Promise<ExecuteResult> {
  try {
    const res = await fetch(`${AGENT_CLAUDE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, agentName, task }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    // Manager 서버가 안 켜져 있으면
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Agent Claude Manager가 실행 중이 아닙니다. npm run agent:claude 실행 필요',
      };
    }
    return {
      success: false,
      error: `실행 실패: ${error.message}`,
    };
  }
}

/**
 * 에이전트에게 메시지 전송 (세션이 이미 시작된 경우)
 */
export async function sendToAgentClaude(
  agentId: string,
  message: string
): Promise<ExecuteResult> {
  try {
    const res = await fetch(`${AGENT_CLAUDE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, message }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: `메시지 전송 실패: ${error.message}`,
    };
  }
}

/**
 * 활성 Claude Code 세션 목록 조회
 */
export async function getActiveClaudeSessions(): Promise<{
  success: boolean;
  sessions?: Array<{
    agentId: string;
    agentName: string;
    workspacePath: string;
    startedAt: string;
    isReady: boolean;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch(`${AGENT_CLAUDE_URL}/sessions`);
    const data = await res.json();
    return { success: true, sessions: data.sessions };
  } catch (error: any) {
    return {
      success: false,
      error: `세션 조회 실패: ${error.message}`,
    };
  }
}

/**
 * 코딩 작업인지 판단
 */
export function isCodingTask(message: string): boolean {
  const codingKeywords = [
    '코딩', '개발', '프로그래밍', '코드',
    'code', 'coding', 'develop', 'programming',
    '파일 생성', '파일 수정', '함수', '클래스',
    'create file', 'edit file', 'function', 'class',
    '구현', 'implement', '빌드', 'build',
    '버그', 'bug', '에러', 'error', '수정', 'fix',
    '리팩토링', 'refactor', '테스트', 'test',
    'API', 'api', '서버', 'server', '데이터베이스', 'database',
    '스크립트', 'script', '자동화', 'automation',
  ];

  const lowerMessage = message.toLowerCase();
  return codingKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

/**
 * 에이전트 작업 실행 (자동 판단)
 * - 코딩 작업: Claude Code 사용
 * - 일반 작업: 기존 LLM 사용
 */
export async function executeAgentTask(
  agentId: string,
  agentName: string,
  task: string,
  forceClaudeCode: boolean = false
): Promise<ExecuteResult> {
  // 코딩 작업이거나 강제 모드면 Claude Code 사용
  if (forceClaudeCode || isCodingTask(task)) {
    console.log(`[Agent ${agentName}] Claude Code로 실행: ${task.substring(0, 50)}...`);
    return executeWithClaudeCode(agentId, agentName, task);
  }

  // 일반 작업은 false 반환 (기존 로직 사용하도록)
  return {
    success: false,
    error: 'NOT_CODING_TASK',
  };
}
