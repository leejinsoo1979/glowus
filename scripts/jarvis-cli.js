#!/usr/bin/env node
/**
 * Jarvis CLI - PC + GlowUS 통합 제어
 *
 * 사용법:
 *   node scripts/jarvis-cli.js <command> [args...]
 *   npx jarvis <command> [args...]
 *
 * 예시:
 *   jarvis agents              # 에이전트 목록
 *   jarvis projects            # 프로젝트 목록
 *   jarvis create-agent "My Agent"
 *   jarvis nodes <agentId>     # 스킬 빌더 노드 목록
 *   jarvis status              # GlowUS 상태
 *   jarvis apps                # 실행 중인 앱
 *   jarvis open Safari         # 앱 실행
 */

const http = require('http');

const JARVIS_URL = process.env.JARVIS_LOCAL_URL || 'http://localhost:3099';
const API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me';

// HTTP 요청 헬퍼
function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, JARVIS_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// GlowUS API 호출
async function glowus(action, params = {}) {
  return request('/glowus', 'POST', { action, ...params });
}

// PC 도구 실행
async function execute(tool, args = {}) {
  return request('/execute', 'POST', { tool, args });
}

// 결과 출력
function print(result) {
  if (result.error) {
    console.error('❌ Error:', result.error);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

// 명령어 처리
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
🤖 Jarvis CLI - PC + GlowUS 통합 제어

📋 GlowUS 명령어:
  agents                    에이전트 목록
  create-agent <name>       에이전트 생성
  delete-agent <id>         에이전트 삭제
  projects                  프로젝트 목록
  create-project <name>     프로젝트 생성
  skills <agentId>          스킬 목록
  add-skill <agentId> <name> 스킬 추가
  nodes <agentId>           스킬 빌더 노드 목록
  add-node <agentId> <type> 노드 추가
  node-types                사용 가능한 노드 타입
  pages                     이동 가능한 페이지
  goto <page>               페이지 이동
  chat <agentId> <message>  에이전트 채팅
  status                    GlowUS 상태

🖥️ PC 명령어:
  apps                      실행 중인 앱
  open <appName>            앱 실행
  close <appName>           앱 종료
  search <path> <query>     파일 검색
  ls <path>                 디렉토리 목록
  read <file>               파일 읽기
  info                      시스템 정보
  screenshot                스크린샷
  url <url>                 URL 열기
  ping                      연결 테스트
`);
    return;
  }

  try {
    let result;

    switch (command) {
      // === GlowUS 명령어 ===
      case 'agents':
        result = await glowus('agents');
        break;

      case 'create-agent':
        result = await glowus('create_agent', { name: args[1] });
        break;

      case 'delete-agent':
        result = await glowus('delete_agent', { agentId: args[1] });
        break;

      case 'projects':
        result = await glowus('projects');
        break;

      case 'create-project':
        result = await glowus('create_project', { name: args[1] });
        break;

      case 'skills':
        result = await glowus('skills', { agentId: args[1] });
        break;

      case 'add-skill':
        result = await glowus('add_skill', { agentId: args[1], name: args[2] });
        break;

      case 'nodes':
        result = await glowus('skill_builder', { agentId: args[1] });
        break;

      case 'add-node':
        result = await glowus('add_node', { agentId: args[1], type: args[2] });
        break;

      case 'connect':
        result = await glowus('connect_nodes', { agentId: args[1], source: args[2], target: args[3] });
        break;

      case 'node-types':
        result = await glowus('node_types');
        break;

      case 'pages':
        result = await glowus('pages');
        break;

      case 'goto':
        result = await glowus('navigate', { page: args[1] });
        break;

      case 'chat':
        result = await glowus('chat', { agentId: args[1], message: args.slice(2).join(' ') });
        break;

      case 'status':
        result = await glowus('status');
        break;

      // === PC 명령어 ===
      case 'apps':
        result = await execute('list_running_apps');
        break;

      case 'open':
        result = await execute('launch_app', { appName: args[1] });
        break;

      case 'close':
        result = await execute('kill_app', { appName: args[1] });
        break;

      case 'search':
        result = await execute('search_files', { path: args[1], query: args[2], recursive: true });
        break;

      case 'ls':
        result = await execute('list_directory', { path: args[1] || '.' });
        break;

      case 'read':
        result = await execute('read_file', { path: args[1] });
        break;

      case 'info':
        result = await execute('get_system_info');
        break;

      case 'screenshot':
        result = await execute('take_screenshot', { path: args[1] });
        break;

      case 'url':
        result = await execute('open_url', { url: args[1] });
        break;

      case 'ping':
        result = await execute('ping');
        break;

      case 'tools':
        result = await request('/tools', 'GET');
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "jarvis help" for available commands');
        process.exit(1);
    }

    print(result);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Jarvis Local Server에 연결할 수 없습니다.');
      console.log('서버 실행: npm run jarvis:local');
    } else {
      console.error('❌ Error:', err.message);
    }
    process.exit(1);
  }
}

main();
