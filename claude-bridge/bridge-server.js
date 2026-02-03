const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Claude Code 버전 확인
app.get('/version', (req, res) => {
  const claude = spawn('claude', ['--version'], { shell: true });
  let output = '';
  
  claude.stdout.on('data', (data) => output += data.toString());
  claude.on('close', (code) => {
    res.json({ version: output.trim(), code });
  });
});

// 일반 프롬프트 (스트리밍)
app.post('/claude', (req, res) => {
  const { prompt, cwd, model } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const args = ['-p', prompt, '--output-format', 'stream-json'];
  if (model) args.push('--model', model);

  const claude = spawn('claude', args, {
    cwd: cwd || process.cwd(),
    shell: true,
    env: { ...process.env }
  });

  claude.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      res.write(`data: ${line}\n\n`);
    });
  });

  claude.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: data.toString() })}\n\n`);
  });

  claude.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    claude.kill();
  });
});

// 코드와 함께 질문 (스트리밍)
app.post('/claude/code', (req, res) => {
  const { prompt, code, language, filename, cwd, model } = req.body;
  
  if (!prompt || !code) {
    return res.status(400).json({ error: 'prompt and code required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const fullPrompt = `
파일: ${filename || 'untitled'}
언어: ${language || 'unknown'}

\`\`\`${language || ''}
${code}
\`\`\`

${prompt}
`.trim();

  const args = ['-p', fullPrompt, '--output-format', 'stream-json'];
  if (model) args.push('--model', model);

  const claude = spawn('claude', args, {
    cwd: cwd || process.cwd(),
    shell: true,
    env: { ...process.env }
  });

  claude.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      res.write(`data: ${line}\n\n`);
    });
  });

  claude.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: data.toString() })}\n\n`);
  });

  claude.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    claude.kill();
  });
});

// 비스트리밍 (단순 응답)
app.post('/claude/sync', async (req, res) => {
  const { prompt, code, language, cwd, model } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  let fullPrompt = prompt;
  if (code) {
    fullPrompt = `
\`\`\`${language || ''}
${code}
\`\`\`

${prompt}
`.trim();
  }

  const args = ['-p', fullPrompt, '--output-format', 'json'];
  if (model) args.push('--model', model);

  const claude = spawn('claude', args, {
    cwd: cwd || process.cwd(),
    shell: true,
    env: { ...process.env }
  });

  let output = '';
  let error = '';

  claude.stdout.on('data', (data) => output += data.toString());
  claude.stderr.on('data', (data) => error += data.toString());

  claude.on('close', (code) => {
    if (code === 0) {
      try {
        res.json(JSON.parse(output));
      } catch {
        res.json({ result: output, code });
      }
    } else {
      res.status(500).json({ error, code });
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║       Claude Code Bridge Server Running            ║
╠════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                       ║
║                                                    ║
║  Endpoints:                                        ║
║    GET  /health        - 서버 상태 확인            ║
║    GET  /version       - Claude Code 버전          ║
║    POST /claude        - 스트리밍 응답             ║
║    POST /claude/code   - 코드와 함께 스트리밍      ║
║    POST /claude/sync   - 동기 응답                 ║
╚════════════════════════════════════════════════════╝
  `);
});
