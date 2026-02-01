/**
 * Jarvis Local Server - 맥북 원격 제어용 로컬 서버
 *
 * 기능:
 * 1. HTTP API로 Vercel에서 명령 수신
 * 2. 로컬 맥북에서 실제 명령 실행
 * 3. 결과를 Vercel로 반환
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

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    JARVIS LOCAL SERVER                     ║
╠═══════════════════════════════════════════════════════════╣
║  Status:    Running                                        ║
║  Port:      ${PORT}                                           ║
║  Host:      0.0.0.0                                        ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /health   - 상태 확인                              ║
║    GET  /tools    - 사용 가능한 도구 목록                  ║
║    POST /execute  - 도구 실행                              ║
╠═══════════════════════════════════════════════════════════╣
║  Authorization: Bearer ${API_SECRET.substring(0, 10)}...                  ║
╚═══════════════════════════════════════════════════════════╝
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
