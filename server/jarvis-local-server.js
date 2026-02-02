/**
 * Jarvis Local Server - 맥북 원격 제어 + GlowUS 통합 서버
 *
 * 기능:
 * 1. HTTP API로 PC 제어 (파일, 앱, 시스템)
 * 2. GlowUS API 프록시 (에이전트, 프로젝트, 스킬 빌더)
 * 3. 브라우저 자동화 (Playwright)
 *
 * 실행: node server/jarvis-local-server.js
 * 또는: npm run jarvis:local
 */

const http = require('http');
const https = require('https');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

const PORT = process.env.JARVIS_LOCAL_PORT || 3099;
const API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me';
const GLOWUS_URL = process.env.GLOWUS_URL || 'http://localhost:3000';

// ============================================
// GlowUS API 프록시 헬퍼
// ============================================

async function callGlowUSAPI(action, params = {}, userId = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/jarvis/control', GLOWUS_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const body = JSON.stringify({
      action,
      params,
      _userId: userId,
      _secret: API_SECRET,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Invalid JSON response', raw: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

// ============================================
// 핸들러들
// ============================================

const handlers = {
  // 시스템 정보
  async get_system_info() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
      hostname: os.hostname(),
      uptime: Math.round(os.uptime() / 60) + '분',
      homeDir: os.homedir(),
      username: os.userInfo().username,
    };
  },

  // 앱 실행
  async launch_app(args) {
    const { appName } = args;
    try {
      await execAsync(`open -a "${appName}"`);
      return { success: true, message: `${appName} 실행 완료` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 앱 종료
  async kill_app(args) {
    const { appName } = args;
    try {
      await execAsync(`pkill -x "${appName}"`);
      return { success: true, message: `${appName} 종료 완료` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 실행 중인 앱 목록
  async list_running_apps() {
    const { stdout } = await execAsync(`ps aux | grep -v grep | awk '{print $11}' | sort -u`);
    const apps = stdout.split('\n').filter(Boolean);
    return { apps };
  },

  // 시스템 명령 실행 (위험 - 승인 필요)
  async execute_command(args) {
    const { command, cwd } = args;

    // 위험한 명령 차단
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /rm\s+-rf\s+~/,
      /mkfs/,
      /dd\s+if=/,
      />\s*\/dev\/sd/,
      /shutdown/,
      /reboot/,
      /sudo\s+rm/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { success: false, error: '위험한 명령은 실행할 수 없습니다.' };
      }
    }

    try {
      const options = cwd ? { cwd } : {};
      const { stdout, stderr } = await execAsync(command, options);
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message, stderr: err.stderr };
    }
  },

  // 파일 읽기
  async read_file(args) {
    const { path: filePath } = args;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파일 쓰기 (위험 - 승인 필요)
  async write_file(args) {
    const { path: filePath, content } = args;
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, message: `파일 저장 완료: ${filePath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파일 삭제 (위험 - 승인 필요)
  async delete_file(args) {
    const { path: filePath } = args;
    try {
      await fs.unlink(filePath);
      return { success: true, message: `파일 삭제 완료: ${filePath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 폴더 생성
  async create_folder(args) {
    const { path: folderPath } = args;
    try {
      await fs.mkdir(folderPath, { recursive: true });
      return { success: true, message: `폴더 생성 완료: ${folderPath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 폴더 삭제 (위험 - 승인 필요)
  async delete_folder(args) {
    const { path: folderPath } = args;
    try {
      await fs.rm(folderPath, { recursive: true });
      return { success: true, message: `폴더 삭제 완료: ${folderPath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 디렉토리 목록
  async list_directory(args) {
    const { path: dirPath } = args;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
      return { success: true, items, path: dirPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파일 이동 (위험 - 승인 필요)
  async move_file(args) {
    const { from, to } = args;
    try {
      await fs.rename(from, to);
      return { success: true, message: `파일 이동 완료: ${from} → ${to}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파일 복사
  async copy_file(args) {
    const { from, to } = args;
    try {
      await fs.copyFile(from, to);
      return { success: true, message: `파일 복사 완료: ${from} → ${to}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파일 검색
  async search_files(args) {
    const { path: searchPath, query, recursive } = args;
    const results = [];

    const searchDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            results.push(fullPath);
          }
          if (recursive && entry.isDirectory()) {
            try {
              await searchDir(fullPath);
            } catch {
              // 권한 없는 폴더 스킵
            }
          }
        }
      } catch (err) {
        // 스킵
      }
    };

    await searchDir(searchPath);
    return { success: true, results, count: results.length, query };
  },

  // 파일 내용 검색
  async search_in_files(args) {
    const { path: searchPath, pattern, extension } = args;
    try {
      const cmd = `grep -r -l "${pattern}" "${searchPath}"${extension ? ` --include="*${extension}"` : ''} 2>/dev/null || true`;
      const { stdout } = await execAsync(cmd);
      const files = stdout.split('\n').filter(Boolean);
      return { success: true, files, count: files.length, pattern };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 스크린샷 촬영
  async take_screenshot(args) {
    const { path: savePath } = args;
    const filePath = savePath || path.join(os.homedir(), 'Desktop', `screenshot-${Date.now()}.png`);
    try {
      await execAsync(`screencapture -x "${filePath}"`);
      return { success: true, path: filePath, message: '스크린샷 저장 완료' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // URL 열기
  async open_url(args) {
    const { url } = args;
    try {
      await execAsync(`open "${url}"`);
      return { success: true, message: `URL 열기: ${url}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 파인더에서 열기
  async open_in_finder(args) {
    const { path: filePath } = args;
    try {
      await execAsync(`open -R "${filePath}"`);
      return { success: true, message: `파인더에서 열기: ${filePath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 클립보드 읽기
  async get_clipboard() {
    try {
      const { stdout } = await execAsync('pbpaste');
      return { success: true, content: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 클립보드 쓰기
  async set_clipboard(args) {
    const { content } = args;
    try {
      await execAsync(`echo "${content.replace(/"/g, '\\"')}" | pbcopy`);
      return { success: true, message: '클립보드에 복사 완료' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 알림 보내기
  async send_notification(args) {
    const { title, message } = args;
    try {
      await execAsync(`osascript -e 'display notification "${message}" with title "${title}"'`);
      return { success: true, message: '알림 전송 완료' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 핑 (연결 테스트)
  async ping() {
    return { success: true, message: 'pong', timestamp: new Date().toISOString() };
  },

  // ============================================
  // GlowUS 제어
  // ============================================

  // 에이전트 목록
  async glowus_agents(args) {
    const result = await callGlowUSAPI('listAgents', {}, args?.userId);
    return result;
  },

  // 에이전트 생성
  async glowus_create_agent(args) {
    const { name, description, llmModel } = args;
    if (!name) return { success: false, error: '에이전트 이름이 필요합니다' };
    const result = await callGlowUSAPI('createAgent', { name, description, llmModel }, args?.userId);
    return result;
  },

  // 에이전트 삭제
  async glowus_delete_agent(args) {
    const { agentId } = args;
    if (!agentId) return { success: false, error: 'agentId가 필요합니다' };
    const result = await callGlowUSAPI('deleteAgent', { agentId }, args?.userId);
    return result;
  },

  // 프로젝트 목록
  async glowus_projects(args) {
    const result = await callGlowUSAPI('listProjects', {}, args?.userId);
    return result;
  },

  // 프로젝트 생성
  async glowus_create_project(args) {
    const { name, description } = args;
    if (!name) return { success: false, error: '프로젝트 이름이 필요합니다' };
    const result = await callGlowUSAPI('createProject', { name, description }, args?.userId);
    return result;
  },

  // 스킬 목록
  async glowus_skills(args) {
    const { agentId } = args;
    if (!agentId) return { success: false, error: 'agentId가 필요합니다' };
    const result = await callGlowUSAPI('listSkills', { agentId }, args?.userId);
    return result;
  },

  // 스킬 추가
  async glowus_add_skill(args) {
    const { agentId, name, description } = args;
    if (!agentId || !name) return { success: false, error: 'agentId와 name이 필요합니다' };
    const result = await callGlowUSAPI('addSkill', { agentId, name, description }, args?.userId);
    return result;
  },

  // 스킬 빌더 상태
  async glowus_skill_builder(args) {
    const { agentId } = args;
    if (!agentId) return { success: false, error: 'agentId가 필요합니다' };
    const result = await callGlowUSAPI('getSkillBuilderState', { agentId }, args?.userId);
    return result;
  },

  // 스킬 빌더 노드 추가
  async glowus_add_node(args) {
    const { agentId, type, position, data } = args;
    if (!agentId || !type) return { success: false, error: 'agentId와 type이 필요합니다' };
    const result = await callGlowUSAPI('addNode', { agentId, type, position, data }, args?.userId);
    return result;
  },

  // 스킬 빌더 노드 연결
  async glowus_connect_nodes(args) {
    const { agentId, source, target } = args;
    if (!agentId || !source || !target) return { success: false, error: 'agentId, source, target가 필요합니다' };
    const result = await callGlowUSAPI('connectNodes', { agentId, source, target }, args?.userId);
    return result;
  },

  // 노드 타입 목록
  async glowus_node_types() {
    const result = await callGlowUSAPI('getNodeTypes');
    return result;
  },

  // 페이지 이동
  async glowus_navigate(args) {
    const { page } = args;
    if (!page) return { success: false, error: '페이지 이름이 필요합니다' };
    const result = await callGlowUSAPI('navigate', { page });
    return result;
  },

  // 이동 가능한 페이지 목록
  async glowus_pages() {
    const result = await callGlowUSAPI('getPages');
    return result;
  },

  // 에이전트에게 채팅
  async glowus_chat(args) {
    const { agentId, message } = args;
    if (!agentId || !message) return { success: false, error: 'agentId와 message가 필요합니다' };
    const result = await callGlowUSAPI('sendChat', { agentId, message }, args?.userId);
    return result;
  },

  // GlowUS 상태
  async glowus_status(args) {
    const result = await callGlowUSAPI('getState', {}, args?.userId);
    return result;
  },

  // 브라우저 스크립트 실행 (Playwright)
  async run_browser_script(args) {
    const { scriptCode, variables } = args;
    const startTime = Date.now();

    try {
      // Playwright 동적 로드
      let playwright;
      try {
        playwright = require('playwright');
      } catch (e) {
        return {
          success: false,
          error: 'Playwright가 설치되지 않았습니다. npm install playwright 실행 필요',
        };
      }

      // 브라우저 실행
      const browser = await playwright.chromium.launch({
        headless: false, // 사용자가 볼 수 있게
        slowMo: 100, // 동작 확인용 딜레이
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      // 스크립트를 함수로 변환하여 실행
      // scriptCode는 "async function execute(page, variables) { ... }" 형태
      const executeFunc = new Function('page', 'variables', `
        return (async () => {
          ${scriptCode.replace(/^async function execute\(page, variables\)\s*\{/, '').replace(/\}$/, '')}
        })();
      `);

      const result = await executeFunc(page, variables);

      // 브라우저는 열어둠 (사용자가 확인할 수 있게)
      // 30초 후 자동 종료
      setTimeout(async () => {
        try {
          await browser.close();
        } catch (e) {}
      }, 30000);

      return {
        success: true,
        message: result?.message || '스크립트 실행 완료',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },

  // 브라우저 열기 (간단)
  async open_browser(args) {
    const { url } = args;
    try {
      await execAsync(`open "${url || 'https://www.google.com'}"`);
      return { success: true, message: `브라우저 열기: ${url}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // URL로 이동 (AppleScript - Chrome)
  async navigate_url(args) {
    const { url } = args;
    try {
      // Chrome이 열려있으면 새 탭, 아니면 열기
      const script = `
        tell application "Google Chrome"
          if (count of windows) = 0 then
            make new window
          end if
          tell front window
            make new tab with properties {URL:"${url}"}
          end tell
          activate
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      return { success: true, message: `Chrome에서 열기: ${url}` };
    } catch (err) {
      // Chrome 없으면 기본 브라우저로
      try {
        await execAsync(`open "${url}"`);
        return { success: true, message: `브라우저에서 열기: ${url}` };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },
};

// ============================================
// HTTP 서버
// ============================================

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 인증 확인
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${API_SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // 라우팅
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /health - 상태 확인
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hostname: os.hostname() }));
    return;
  }

  // GET /tools - 사용 가능한 도구 목록
  if (req.method === 'GET' && url.pathname === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: Object.keys(handlers) }));
    return;
  }

  // POST /execute - 도구 실행
  if (req.method === 'POST' && url.pathname === '/execute') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { tool, args } = JSON.parse(body);

        if (!tool || !handlers[tool]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown tool: ${tool}` }));
          return;
        }

        console.log(`[Jarvis Local] Executing: ${tool}`, args);
        const result = await handlers[tool](args || {});
        console.log(`[Jarvis Local] Result:`, result);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Jarvis Local] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /glowus - GlowUS 간편 API
  // 예: POST /glowus { "action": "agents" }
  //     POST /glowus { "action": "create_agent", "name": "MyAgent" }
  if (req.method === 'POST' && url.pathname === '/glowus') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { action, ...params } = data;

        if (!action) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'action이 필요합니다',
            availableActions: [
              'agents', 'create_agent', 'delete_agent',
              'projects', 'create_project',
              'skills', 'add_skill',
              'skill_builder', 'add_node', 'connect_nodes', 'node_types',
              'navigate', 'pages',
              'chat', 'status'
            ]
          }));
          return;
        }

        // action을 glowus_ 핸들러로 매핑
        const handlerName = `glowus_${action}`;
        if (!handlers[handlerName]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown GlowUS action: ${action}` }));
          return;
        }

        console.log(`[Jarvis GlowUS] Action: ${action}`, params);
        const result = await handlers[handlerName](params);
        console.log(`[Jarvis GlowUS] Result:`, result);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Jarvis GlowUS] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    JARVIS LOCAL SERVER                          ║
║                  PC Control + GlowUS API                        ║
╠════════════════════════════════════════════════════════════════╣
║  Status:    Running                                             ║
║  Port:      ${PORT}                                                ║
║  GlowUS:    ${GLOWUS_URL.padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                     ║
║    GET  /health   - 상태 확인                                   ║
║    GET  /tools    - 사용 가능한 도구 목록                       ║
║    POST /execute  - 도구 실행                                   ║
║    POST /glowus   - GlowUS 제어 (간편 API)                      ║
╠════════════════════════════════════════════════════════════════╣
║  PC Tools:     파일, 앱, 시스템, 브라우저 제어                  ║
║  GlowUS Tools: 에이전트, 프로젝트, 스킬 빌더 제어               ║
╠════════════════════════════════════════════════════════════════╣
║  Authorization: Bearer ${API_SECRET.substring(0, 10)}...                       ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n[Jarvis Local] Shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
