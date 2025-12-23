// Electron 모듈 import
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, webContents, globalShortcut } from 'electron';

import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { fork, ChildProcess, exec } from 'child_process';
import * as chokidar from 'chokidar';

// electron-updater는 지연 로딩 (app.whenReady() 이후 사용)
let autoUpdater: any = null;

// node-pty는 버전 충돌로 비활성화 - terminal-server.js(WebSocket)가 대신 처리
let pty: any = null;

// File system watcher (chokidar) - 외부 파일 변경 감지용
let fileWatcher: chokidar.FSWatcher | null = null;
let watchedPath: string | null = null;

// .env.local 로드 (Electron 메인 프로세스용)
// 초기 로드 시 안전한 경로만 사용 (app 객체 참조 없이)
function loadEnvFile() {
    const envPaths = [
        path.join(process.cwd(), '.env.local'),
        path.join(__dirname, '..', '.env.local'),
        path.join(__dirname, '..', '..', '.env.local'),
    ];

    for (const envPath of envPaths) {
        try {
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                content.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const eqIndex = trimmed.indexOf('=');
                        if (eqIndex > 0) {
                            const key = trimmed.slice(0, eqIndex).trim();
                            let value = trimmed.slice(eqIndex + 1).trim();
                            // Remove quotes
                            if ((value.startsWith('"') && value.endsWith('"')) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.slice(1, -1);
                            }
                            if (!process.env[key]) {
                                process.env[key] = value;
                            }
                        }
                    }
                });
                console.log('[Env] Loaded:', envPath);
                return;
            }
        } catch (e) {
            // 경로 접근 에러 무시
        }
    }
    console.log('[Env] No .env.local found');
}

loadEnvFile();

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);
const writeFile = util.promisify(fs.writeFile);

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3999;

function startServer(): Promise<string> {
    const isDev = !app.isPackaged;
    if (isDev) return Promise.resolve('http://localhost:3000');

    return new Promise((resolve, reject) => {
        // Path to server.js in the unpacked resources (unpacked due to 'extraResources')
        // structure: Contents/Resources/server/server.js
        const serverPath = path.join(process.resourcesPath, 'server/server.js');

        console.log('Starting Next.js server from:', serverPath);

        if (!fs.existsSync(serverPath)) {
            console.error('Server file not found at:', serverPath);
            // Fallback just in case relative path is different in some builds
            return reject(new Error(`Server file not found at ${serverPath}`));
        }

        serverProcess = fork(serverPath, [], {
            cwd: path.dirname(serverPath), // Important: Set CWD so Next.js finds .next/static
            env: {
                ...process.env,
                PORT: SERVER_PORT.toString(),
                HOSTNAME: '127.0.0.1',
                NODE_ENV: 'production'
            },
            // Ensure we use the bundled Node executable (Electron) if possible, 
            // but fork usually does the right thing.
        });

        serverProcess.on('error', (err) => {
            console.error('Failed to start server process:', err);
            reject(err);
        });

        // Poll for readiness
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds
        const interval = setInterval(() => {
            fetch(`http://127.0.0.1:${SERVER_PORT}`)
                .then(res => {
                    // 200 is homepage, 404 is also fine (server acts)
                    if (res.status >= 200 && res.status < 500) {
                        clearInterval(interval);
                        console.log('Server is ready!');
                        resolve(`http://127.0.0.1:${SERVER_PORT}`);
                    }
                })
                .catch(() => {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error('Server startup timeout'));
                    }
                });
        }, 500);
    });
}

function stopServer() {
    if (serverProcess) {
        console.log('Stopping server process...');
        serverProcess.kill('SIGKILL'); // Force kill to prevent hanging
        serverProcess = null;
    }
}

async function createWindow() {
    try {
        const startUrl = await startServer();

        mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                webviewTag: true, // Enable <webview> tag
            },
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 16, y: 16 },
            backgroundColor: '#111111',
            title: 'GlowUS',
        });

        // WebAuthn/패스키 요청 비활성화 (무한 로딩 방지)
        mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
            // 알림, 미디어 등 기본 권한만 허용
            const allowedPermissions = ['notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write'];
            if (allowedPermissions.includes(permission)) {
                callback(true);
            } else {
                // 그 외 권한(패스키 관련 포함)은 거부
                callback(false);
            }
        });

        // Spoof User Agent to allows Google Login (Remove "Electron" identifier)
        const userAgent = mainWindow.webContents.getUserAgent();
        mainWindow.webContents.setUserAgent(userAgent.replace(/Electron\/[0-9\.]+\s/, ''));

        mainWindow.loadURL(startUrl);

        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }

        // OAuth 및 외부 링크 처리
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            // OAuth 인증 URL은 외부 브라우저에서 열기
            const isOAuthUrl =
                url.includes('accounts.google.com') ||
                url.includes('github.com/login/oauth') ||
                url.includes('supabase.co/auth') ||
                url.includes('/auth/v1/authorize');

            if (isOAuthUrl) {
                shell.openExternal(url);
                return { action: 'deny' };
            }

            // 로컬 URL은 허용
            if (url.startsWith('http://localhost') || url.startsWith('file://')) {
                return { action: 'allow' };
            }

            // 그 외 외부 URL은 브라우저에서 열기
            shell.openExternal(url);
            return { action: 'deny' };
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });

    } catch (err: any) {
        console.error('Failed to create window:', err);
        dialog.showErrorBox('Application Error', `Failed to start the application server.\n\nError: ${err.message}`);
    }
}

// GPU/Network 크래시 방지 - app.whenReady() 전에 설정해야 함
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,NetworkService');

if (process.platform === 'darwin') {
    app.setName('GlowUS');
}

app.whenReady().then(() => {
    // electron-updater 지연 로딩
    try {
        autoUpdater = require('electron-updater').autoUpdater;
        autoUpdater.logger = console;
    } catch (e) {
        console.log('[AutoUpdater] Failed to load:', e);
    }

    createWindow();

    // DevTools 글로벌 단축키 등록 (Cmd+Option+I / Ctrl+Shift+I)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.toggleDevTools();
        }
    });
    globalShortcut.register('CommandOrControl+Alt+I', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.toggleDevTools();
        }
    });

    // Check for updates on startup
    if (app.isPackaged && autoUpdater) {
        autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
            console.error('Failed to check for updates:', err);
        });
    }

    // Create Application Menu
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'GlowUS',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu:new-note');
                    }
                },
                {
                    label: 'New File...',
                    accelerator: 'Alt+CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu:new-file');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Folder...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!mainWindow) return;
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory', 'createDirectory']
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            const dirPath = result.filePaths[0];
                            const name = path.basename(dirPath);
                            mainWindow.webContents.send('menu:folder-selected', {
                                kind: 'directory',
                                name: name,
                                path: dirPath
                            });
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow?.webContents.send('menu:save');
                    }
                },
                {
                    label: 'Save As...',
                    accelerator: 'Shift+CmdOrCtrl+S',
                    click: () => {
                        mainWindow?.webContents.send('menu:save-as');
                    }
                },
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        await shell.openExternal('https://glowus.io');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Check for updates on startup
    if (app.isPackaged && autoUpdater) {
        autoUpdater.checkForUpdatesAndNotify();

        // Detailed update lifecycle events
        autoUpdater.on('update-available', () => {
            console.log('Update available, downloading...');
        });

        autoUpdater.on('update-downloaded', (info: { version: string }) => {
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Ready',
                message: `Version ${info.version} has been downloaded and is ready to install.`,
                buttons: ['Restart and Update', 'Later']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });

        autoUpdater.on('error', (err: Error) => {
            console.error('Update error:', err);
        });
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on('web-contents-created', (event, contents) => {
    // Intercept all webview creations
    if (contents.getType() === 'webview') {
        // Prevent new windows from being created by the webview
        contents.setWindowOpenHandler((details) => {
            const url = details.url;

            // OAuth 인증 URL은 외부 브라우저에서 열기
            const isOAuthUrl =
                url.includes('accounts.google.com') ||
                url.includes('github.com/login/oauth') ||
                url.includes('supabase.co/auth') ||
                url.includes('/auth/v1/authorize');

            if (isOAuthUrl) {
                shell.openExternal(url);
                return { action: 'deny' };
            }

            // 그 외 새 창은 차단
            return { action: 'deny' };
        });
    }
});

app.on('window-all-closed', () => {
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopServer();
});

// ==========================================
// IPC Handlers (File System Abstraction)
// ==========================================

// 0. Get Current Working Directory
ipcMain.handle('fs:get-cwd', async () => {
    return process.cwd();
});

// 1. Select Directory
ipcMain.handle('fs:select-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const dirPath = result.filePaths[0];
    const name = path.basename(dirPath);

    return {
        kind: 'directory',
        name: name,
        path: dirPath // Important: Absolute path for Electron
    };
});

// 2. Read Directory
ipcMain.handle('fs:read-directory', async (_, dirPath: string, options: { includeSystemFiles?: boolean } = {}) => {
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });

        // Transform to our FileSystemHandle format
        const results = [];

        for (const entry of entries) {
            // Skip system files if not requested
            if (!options.includeSystemFiles) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            }

            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                results.push({
                    kind: 'directory',
                    name: entry.name,
                    path: fullPath
                });
            } else if (entry.isFile()) {
                const stats = await stat(fullPath);
                results.push({
                    kind: 'file',
                    name: entry.name,
                    path: fullPath,
                    size: stats.size,
                    lastModified: stats.mtimeMs
                });
            }
        }

        return results;

    } catch (err) {
        console.error('Failed to read dir:', dirPath, err);
        throw err;
    }
});

// 2.5 Batch Scan Directory Tree (Single IPC call for entire tree)
interface ScanResult {
    path: string;
    relativePath: string;
    name: string;
    kind: 'file' | 'directory';
    size?: number;
    lastModified?: number;
    children?: ScanResult[];
    childCount?: number;
}

ipcMain.handle('fs:scan-tree', async (_, rootPath: string, options: {
    includeSystemFiles?: boolean;
    maxDepth?: number;
    includeContent?: boolean;
    contentExtensions?: string[];
} = {}) => {
    const {
        includeSystemFiles = false,
        maxDepth = Infinity,
        includeContent = false,
        contentExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html']
    } = options;

    const startTime = Date.now();
    let fileCount = 0;
    let dirCount = 0;

    const shouldSkip = (name: string): boolean => {
        if (includeSystemFiles) return false;
        if (name.startsWith('.')) return true;
        if (name === 'node_modules') return true;
        if (name === '__pycache__') return true;
        if (name === '.git') return true;
        if (name === 'dist') return true;
        if (name === 'build') return true;
        if (name === '.next') return true;
        return false;
    };

    const scanDir = async (dirPath: string, relativePath: string, depth: number): Promise<ScanResult> => {
        const name = path.basename(dirPath);
        const result: ScanResult = {
            path: dirPath,
            relativePath,
            name,
            kind: 'directory',
            children: [],
            childCount: 0
        };

        if (depth >= maxDepth) {
            // Just count children without recursing
            try {
                const entries = await readdir(dirPath, { withFileTypes: true });
                result.childCount = entries.filter(e => !shouldSkip(e.name)).length;
            } catch { }
            return result;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            // Process in parallel for speed
            const promises = entries
                .filter(entry => !shouldSkip(entry.name))
                .map(async (entry) => {
                    const fullPath = path.join(dirPath, entry.name);
                    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                    if (entry.isDirectory()) {
                        dirCount++;
                        return scanDir(fullPath, entryRelativePath, depth + 1);
                    } else if (entry.isFile()) {
                        fileCount++;
                        const stats = await stat(fullPath);
                        const ext = path.extname(entry.name).toLowerCase();

                        const fileResult: ScanResult = {
                            path: fullPath,
                            relativePath: entryRelativePath,
                            name: entry.name,
                            kind: 'file',
                            size: stats.size,
                            lastModified: stats.mtimeMs
                        };

                        // Optionally include file content for code analysis
                        if (includeContent && contentExtensions.includes(ext) && stats.size < 100000) {
                            try {
                                (fileResult as any).content = await readFile(fullPath, 'utf-8');
                            } catch { }
                        }

                        return fileResult;
                    }
                    return null;
                });

            const children = await Promise.all(promises);
            result.children = children.filter(Boolean) as ScanResult[];
            result.childCount = result.children.length;

        } catch (err) {
            console.error('Failed to scan dir:', dirPath, err);
        }

        return result;
    };

    try {
        const tree = await scanDir(rootPath, '', 0);
        const elapsed = Date.now() - startTime;

        console.log(`[fs:scan-tree] Scanned ${fileCount} files, ${dirCount} dirs in ${elapsed}ms`);

        return {
            tree,
            stats: {
                fileCount,
                dirCount,
                elapsed
            }
        };
    } catch (err) {
        console.error('Failed to scan tree:', rootPath, err);
        throw err;
    }
});

// 3. Read File Content
ipcMain.handle('fs:read-file', async (_, filePath: string) => {
    return await readFile(filePath, 'utf-8');
});

// 4. Write File Content
ipcMain.handle('fs:write-file', async (_, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8');
    return true;
});

// 4.1 Create Directory
ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return { success: true, path: dirPath };
    } catch (error) {
        console.error('[fs:mkdir] Failed:', error);
        return { success: false, error: (error as Error).message };
    }
});

// 4.1.1 Create Project Workspace - 프로젝트용 로컬 폴더 생성
ipcMain.handle('fs:create-project-workspace', async (_, projectName: string, customPath?: string) => {
    try {
        // 기본 워크스페이스 경로: ~/Documents/GlowUS-Projects/
        const homeDir = app.getPath('home');
        const documentsDir = app.getPath('documents');
        const defaultWorkspaceRoot = path.join(documentsDir, 'GlowUS-Projects');

        // 워크스페이스 루트 폴더 생성
        if (!fs.existsSync(defaultWorkspaceRoot)) {
            fs.mkdirSync(defaultWorkspaceRoot, { recursive: true });
        }

        // 프로젝트 이름 정리 (파일 시스템에 안전한 이름으로)
        const safeName = projectName
            .replace(/[<>:"/\\|?*]/g, '-')  // 특수문자 제거
            .replace(/\s+/g, '-')            // 공백을 하이픈으로
            .replace(/-+/g, '-')             // 연속 하이픈 제거
            .toLowerCase();

        // 프로젝트 폴더 경로
        const projectPath = customPath || path.join(defaultWorkspaceRoot, safeName);

        // 이미 존재하는 경우 숫자 추가
        let finalPath = projectPath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
            finalPath = `${projectPath}-${counter}`;
            counter++;
        }

        // 폴더 생성
        fs.mkdirSync(finalPath, { recursive: true });

        // 기본 .gitignore 생성
        const gitignoreContent = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Build
.next/
out/
build/
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
`;
        fs.writeFileSync(path.join(finalPath, '.gitignore'), gitignoreContent);

        // 기본 README.md 생성
        const readmeContent = `# ${projectName}

Created with GlowUS

## Getting Started

This project was created using GlowUS Neural Map.

## Project Structure

Add your project files here.
`;
        fs.writeFileSync(path.join(finalPath, 'README.md'), readmeContent);

        console.log('[fs:create-project-workspace] Created:', finalPath);
        return { success: true, path: finalPath };
    } catch (error) {
        console.error('[fs:create-project-workspace] Failed:', error);
        return { success: false, error: (error as Error).message };
    }
});

// 4.1.2 Get Workspace Root - 워크스페이스 루트 경로 반환
ipcMain.handle('fs:get-workspace-root', async () => {
    const documentsDir = app.getPath('documents');
    return path.join(documentsDir, 'GlowUS-Projects');
});

// 4.2 Delete File
ipcMain.handle('fs:delete-file', async (_, filePath: string) => {
    try {
        fs.unlinkSync(filePath);
        return { success: true };
    } catch (error) {
        console.error('[fs:delete-file] Failed:', error);
        return { success: false, error: (error as Error).message };
    }
});

// 4.5 File System Watcher (chokidar) - 외부 파일 변경 감지
ipcMain.handle('fs:watch-start', async (_, dirPath: string) => {
    // 기존 watcher가 있으면 닫기
    if (fileWatcher) {
        await fileWatcher.close();
        fileWatcher = null;
    }

    watchedPath = dirPath;
    console.log('[FileWatcher] Starting to watch:', dirPath);

    // Debounce를 위한 타이머 관리
    const pendingEvents = new Map<string, NodeJS.Timeout>();
    const DEBOUNCE_MS = 300; // 300ms debounce

    fileWatcher = chokidar.watch(dirPath, {
        ignored: [
            /(^|[\/\\])\../, // dotfiles (hidden files)
            '**/node_modules/**',
            '**/.git/**',
            '**/.next/**',
            '**/dist/**',
            '**/dist-electron/**',
            '**/*.log',
            '**/package-lock.json',
        ],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100,
        },
    });

    const sendChange = (eventType: 'create' | 'change' | 'delete', filePath: string) => {
        // 기존 pending event가 있으면 취소
        const existing = pendingEvents.get(filePath);
        if (existing) {
            clearTimeout(existing);
        }

        // Debounced 이벤트 전송
        const timer = setTimeout(() => {
            pendingEvents.delete(filePath);
            if (mainWindow && !mainWindow.isDestroyed()) {
                console.log(`[FileWatcher] ${eventType}:`, filePath);
                mainWindow.webContents.send('fs:changed', { path: filePath, type: eventType });
            }
        }, DEBOUNCE_MS);

        pendingEvents.set(filePath, timer);
    };

    fileWatcher
        .on('add', (filePath: string) => sendChange('create', filePath))
        .on('change', (filePath: string) => sendChange('change', filePath))
        .on('unlink', (filePath: string) => sendChange('delete', filePath))
        .on('addDir', (filePath: string) => sendChange('create', filePath))
        .on('unlinkDir', (filePath: string) => sendChange('delete', filePath))
        .on('error', (error: Error) => console.error('[FileWatcher] Error:', error));

    return { success: true, path: dirPath };
});

ipcMain.handle('fs:watch-stop', async () => {
    if (fileWatcher) {
        await fileWatcher.close();
        fileWatcher = null;
        watchedPath = null;
        console.log('[FileWatcher] Stopped watching');
    }
    return { success: true };
});

// Copy file
ipcMain.handle('fs:copy-file', async (_, src: string, dest: string) => {
    try {
        await fs.promises.copyFile(src, dest);
        console.log('[FS] File copied:', src, '->', dest);
        return { success: true };
    } catch (error: any) {
        console.error('[FS] Copy file failed:', error);
        return { success: false, error: error.message };
    }
});

// Rename/move file or folder
ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
    try {
        await fs.promises.rename(oldPath, newPath);
        console.log('[FS] Renamed:', oldPath, '->', newPath);
        return { success: true };
    } catch (error: any) {
        console.error('[FS] Rename failed:', error);
        return { success: false, error: error.message };
    }
});

// Shell: Show item in Finder/Explorer
ipcMain.handle('shell:show-item-in-folder', async (_, filePath: string) => {
    try {
        shell.showItemInFolder(filePath);
        console.log('[Shell] Showing in folder:', filePath);
    } catch (error: any) {
        console.error('[Shell] Show in folder failed:', error);
    }
});

// Shell: Move item to trash
ipcMain.handle('shell:trash-item', async (_, filePath: string) => {
    try {
        await shell.trashItem(filePath);
        console.log('[Shell] Moved to trash:', filePath);
        return { success: true };
    } catch (error: any) {
        console.error('[Shell] Trash item failed:', error);
        return { success: false, error: error.message };
    }
});

// Shell: Open path with default application
ipcMain.handle('shell:open-path', async (_, filePath: string) => {
    try {
        const result = await shell.openPath(filePath);
        if (result) {
            console.error('[Shell] Open path error:', result);
            return result;
        }
        console.log('[Shell] Opened path:', filePath);
        return '';
    } catch (error: any) {
        console.error('[Shell] Open path failed:', error);
        return error.message;
    }
});

// 5. Check for Updates
ipcMain.handle('app:check-for-updates', async () => {
    if (app.isPackaged && autoUpdater) {
        return await autoUpdater.checkForUpdatesAndNotify();
    }
    return { status: 'dev-mode', message: 'Update check is skipped in development mode.' };
});

// 6. Open Webview DevTools (Fallback mechanism)
ipcMain.handle('app:open-webview-devtools', async (_, webContentsId?: number) => {
    // 1. If a specific ID is provided (Best method)
    if (webContentsId) {
        try {
            const wc = webContents.fromId(webContentsId);
            if (wc) {
                wc.openDevTools({ mode: 'right' });
                return { success: true, message: `Opened DevTools for provided ID ${webContentsId}` };
            }
        } catch (e) {
            console.error(`Failed to find WebContents with ID ${webContentsId}:`, e);
        }
    }

    // 2. Fallback: Search for guest webview
    const allContents = webContents.getAllWebContents();

    // Log for debugging
    console.log('Searching for webview contents to open DevTools...');

    for (const wc of allContents) {
        // Skip mainWindow
        if (mainWindow && wc.id === mainWindow.webContents.id) continue;

        // Skip DevTools and other internal pages
        const url = wc.getURL();
        if (url.startsWith('devtools://')) continue;
        if (url.startsWith('chrome-extension://')) continue;

        console.log(`Potential target found - ID: ${wc.id}, URL: ${url}`);

        // If it's not the main window and not devtools, it's likely our webview
        try {
            wc.openDevTools({ mode: 'right' });
            return { success: true, message: `Opened DevTools for WebContents ID ${wc.id}` };
        } catch (err: any) {
            console.error(`Failed to open devtools on ID ${wc.id}:`, err);
        }
    }

    return { success: false, message: 'No suitable webview found' };
});

// ==========================================
// Mermaid Data Source Handlers
// ==========================================

const execPromise = util.promisify(exec);

// 7. Git Log for GitGraph
ipcMain.handle('git:log', async (_, dirPath: string, options: { maxCommits?: number } = {}) => {
    const { maxCommits = 50 } = options;

    try {
        // Custom format: hash|shortHash|message|refs|parents|date|tags
        const format = '%H|%h|%s|%D|%P|%ci|%(describe:tags)';
        const { stdout } = await execPromise(
            `git log --oneline -n ${maxCommits} --format="${format}" --all`,
            { cwd: dirPath, maxBuffer: 10 * 1024 * 1024 }
        );
        return stdout;
    } catch (err: any) {
        console.error('Git log failed:', err.message);
        return '';
    }
});

// 8. Git Branch Info
ipcMain.handle('git:branches', async (_, dirPath: string) => {
    try {
        const { stdout } = await execPromise(
            'git branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)"',
            { cwd: dirPath }
        );
        return stdout;
    } catch (err: any) {
        console.error('Git branches failed:', err.message);
        return '';
    }
});

// 9. File Statistics (count by extension)
ipcMain.handle('fs:file-stats', async (_, dirPath: string) => {
    const stats: Record<string, { count: number; size: number }> = {};

    const scanDir = async (dir: string) => {
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                // Skip system/build directories
                if (entry.name.startsWith('.') ||
                    entry.name === 'node_modules' ||
                    entry.name === 'dist' ||
                    entry.name === 'build' ||
                    entry.name === '.next' ||
                    entry.name === '__pycache__') {
                    continue;
                }

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
                    const fileStat = await stat(fullPath);

                    if (!stats[ext]) {
                        stats[ext] = { count: 0, size: 0 };
                    }
                    stats[ext].count++;
                    stats[ext].size += fileStat.size;
                }
            }
        } catch (err) {
            // Ignore permission errors
        }
    };

    await scanDir(dirPath);

    // Convert to array and sort by count
    return Object.entries(stats)
        .map(([extension, data]) => ({ extension, ...data }))
        .sort((a, b) => b.count - a.count);
});

// 10. Scan API Routes
ipcMain.handle('fs:scan-api-routes', async (_, dirPath: string) => {
    const routes: { path: string; method: string; file: string }[] = [];
    const apiDir = path.join(dirPath, 'app', 'api');

    const scanApiDir = async (dir: string, routePath: string = '/api') => {
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const newRoutePath = `${routePath}/${entry.name.replace(/\[([^\]]+)\]/g, ':$1')}`;

                if (entry.isDirectory()) {
                    await scanApiDir(fullPath, newRoutePath);
                } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                    // Read file to detect HTTP methods
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

                        for (const method of methods) {
                            // Check for export async function GET/POST/etc or export const GET
                            if (content.includes(`export async function ${method}`) ||
                                content.includes(`export function ${method}`) ||
                                content.includes(`export const ${method}`)) {
                                routes.push({
                                    path: routePath.replace('/route', ''),
                                    method,
                                    file: fullPath
                                });
                            }
                        }
                    } catch { }
                }
            }
        } catch { }
    };

    if (fs.existsSync(apiDir)) {
        await scanApiDir(apiDir);
    }

    return routes;
});

// 11. Scan TypeScript/JavaScript for Classes and Interfaces
ipcMain.handle('fs:scan-types', async (_, dirPath: string, options: { extensions?: string[] } = {}) => {
    const { extensions = ['.ts', '.tsx'] } = options;
    const types: any[] = [];

    const scanDir = async (dir: string) => {
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.name.startsWith('.') ||
                    entry.name === 'node_modules' ||
                    entry.name === 'dist' ||
                    entry.name === '.next') {
                    continue;
                }

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        try {
                            const content = await readFile(fullPath, 'utf-8');

                            // Simple regex parsing for interfaces and classes
                            // Interface
                            const interfaceMatches = content.matchAll(/export\s+(?:interface|type)\s+(\w+)\s*(?:<[^>]*>)?\s*(?:extends\s+(\w+))?\s*\{([^}]*)\}/g);
                            for (const match of interfaceMatches) {
                                const [, name, extendsName, body] = match;
                                const properties = body.split('\n')
                                    .map(line => line.trim())
                                    .filter(line => line && !line.startsWith('//'))
                                    .map(line => {
                                        const propMatch = line.match(/^(\w+)\??:\s*(.+?);?$/);
                                        if (propMatch) {
                                            return { name: propMatch[1], type: propMatch[2].replace(/;$/, '') };
                                        }
                                        return null;
                                    })
                                    .filter(Boolean);

                                types.push({
                                    name,
                                    kind: 'interface',
                                    properties,
                                    methods: [],
                                    extends: extendsName,
                                    file: fullPath
                                });
                            }

                            // Class
                            const classMatches = content.matchAll(/export\s+class\s+(\w+)\s*(?:<[^>]*>)?\s*(?:extends\s+(\w+))?\s*(?:implements\s+([\w,\s]+))?\s*\{/g);
                            for (const match of classMatches) {
                                const [, name, extendsName, implementsStr] = match;
                                types.push({
                                    name,
                                    kind: 'class',
                                    properties: [],
                                    methods: [],
                                    extends: extendsName,
                                    implements: implementsStr?.split(',').map(s => s.trim()),
                                    file: fullPath
                                });
                            }
                        } catch { }
                    }
                }
            }
        } catch { }
    };

    await scanDir(dirPath);
    return types;
});

// ==========================================
// AI Viewfinder - Screen Capture Handlers
// ==========================================

// 12. Capture Webview Content
ipcMain.handle('viewfinder:capture-webview', async (_, webContentsId: number, rect?: { x: number; y: number; width: number; height: number }) => {
    try {
        const wc = webContents.fromId(webContentsId);
        if (!wc) {
            return { success: false, error: 'WebContents not found' };
        }

        // Capture the webview content
        const image = await wc.capturePage(rect ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        } : undefined);

        if (image.isEmpty()) {
            return { success: false, error: 'Captured image is empty' };
        }

        // Convert to base64 data URL
        const dataUrl = image.toDataURL();
        const size = image.getSize();

        return {
            success: true,
            dataUrl,
            width: size.width,
            height: size.height,
            timestamp: Date.now()
        };
    } catch (err: any) {
        console.error('Viewfinder capture webview failed:', err);
        return { success: false, error: err.message };
    }
});

// 13. Capture Main Window Content
ipcMain.handle('viewfinder:capture-window', async (_, rect?: { x: number; y: number; width: number; height: number }) => {
    try {
        if (!mainWindow) {
            return { success: false, error: 'Main window not available' };
        }

        // Capture the main window content
        const image = await mainWindow.webContents.capturePage(rect ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        } : undefined);

        if (image.isEmpty()) {
            return { success: false, error: 'Captured image is empty' };
        }

        // Convert to base64 data URL
        const dataUrl = image.toDataURL();
        const size = image.getSize();

        return {
            success: true,
            dataUrl,
            width: size.width,
            height: size.height,
            timestamp: Date.now()
        };
    } catch (err: any) {
        console.error('Viewfinder capture window failed:', err);
        return { success: false, error: err.message };
    }
});

// 14. Check if folder is empty (for project scaffolding prompt)
ipcMain.handle('fs:is-empty', async (_, dirPath: string) => {
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const nonSystemFiles = entries.filter(e =>
            !e.name.startsWith('.') &&
            e.name !== 'node_modules' &&
            e.name !== '__pycache__' &&
            e.name !== '.git'
        );
        const isEmpty = nonSystemFiles.length === 0;
        const folderName = path.basename(dirPath);

        return {
            isEmpty,
            folderName,
            path: dirPath,
            existingFiles: nonSystemFiles.map(e => e.name).slice(0, 5),
            fileCount: nonSystemFiles.length
        };
    } catch (err: any) {
        console.error('fs:is-empty error:', err);
        return { isEmpty: false, error: err.message };
    }
});

// 15. Scaffold project (direct IPC, not via agent)
ipcMain.handle('project:scaffold', async (_, params: {
    dirPath: string;
    template: string;
    options?: { typescript?: boolean; tailwind?: boolean; eslint?: boolean };
}) => {
    const { dirPath, template, options = {} } = params;
    const projectName = path.basename(dirPath);

    console.log(`[Project] 스캐폴딩 시작: ${template} → ${dirPath}`);

    // 템플릿별 명령어 (간소화)
    const TEMPLATES: Record<string, { cmd: string; postInstall?: string[] }> = {
        'next-app-ts': {
            cmd: `npx create-next-app@latest . --ts --no-git --use-npm ${options.tailwind ? '--tailwind' : '--no-tailwind'} ${options.eslint ? '--eslint' : '--no-eslint'} --src-dir --app --import-alias "@/*" --yes`
        },
        'vite-react-ts': {
            cmd: `npm create vite@latest . -- --template react-ts`,
            postInstall: ['npm install']
        },
        'vite-vue-ts': {
            cmd: `npm create vite@latest . -- --template vue-ts`,
            postInstall: ['npm install']
        },
        'express-ts': {
            cmd: 'npm init -y && npm install express cors && npm install -D typescript @types/node @types/express ts-node'
        }
    };

    const config = TEMPLATES[template];
    if (!config) {
        return { success: false, error: `Unknown template: ${template}` };
    }

    try {
        // 메인 명령어 실행
        if (config.cmd) {
            await execPromise(config.cmd, {
                cwd: dirPath,
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });
        }

        // 후처리
        if (config.postInstall) {
            for (const cmd of config.postInstall) {
                await execPromise(cmd, { cwd: dirPath, timeout: 180000 });
            }
        }

        // 완료 알림
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('project:scaffolded', {
                template,
                projectName,
                path: dirPath
            });
        }

        return {
            success: true,
            template,
            projectName,
            path: dirPath,
            message: `${projectName} 프로젝트가 ${template} 템플릿으로 생성되었습니다!`
        };
    } catch (error: any) {
        console.error('[Project] 스캐폴딩 오류:', error);
        return { success: false, error: error.message };
    }
});

// 16. Parse Supabase/Database Schema
ipcMain.handle('fs:scan-schema', async (_, dirPath: string) => {
    const tables: any[] = [];

    // Look for common schema definition files
    const schemaFiles = [
        'lib/supabase/types.ts',
        'types/supabase.ts',
        'types/database.ts',
        'prisma/schema.prisma',
        'supabase/migrations/*.sql'
    ];

    for (const schemaPattern of schemaFiles) {
        const schemaPath = path.join(dirPath, schemaPattern.replace('*', ''));

        if (schemaPattern.includes('*')) {
            // Handle glob patterns (migrations)
            const migrationDir = path.dirname(path.join(dirPath, schemaPattern));
            try {
                if (fs.existsSync(migrationDir)) {
                    const files = await readdir(migrationDir);
                    for (const file of files) {
                        if (file.endsWith('.sql')) {
                            const content = await readFile(path.join(migrationDir, file), 'utf-8');
                            // Parse CREATE TABLE statements
                            const tableMatches = content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi);
                            for (const match of tableMatches) {
                                const [, tableName, columnDefs] = match;
                                const columns = columnDefs.split(',')
                                    .map(col => col.trim())
                                    .filter(col => col && !col.startsWith('CONSTRAINT') && !col.startsWith('PRIMARY') && !col.startsWith('FOREIGN'))
                                    .map(col => {
                                        const parts = col.split(/\s+/);
                                        return {
                                            name: parts[0],
                                            type: parts[1] || 'unknown',
                                            isPrimary: col.toUpperCase().includes('PRIMARY KEY'),
                                            isForeign: col.toUpperCase().includes('REFERENCES')
                                        };
                                    });
                                tables.push({ name: tableName, columns, source: file });
                            }
                        }
                    }
                }
            } catch { }
        } else if (fs.existsSync(schemaPath)) {
            try {
                const content = await readFile(schemaPath, 'utf-8');

                if (schemaPath.endsWith('.prisma')) {
                    // Parse Prisma schema
                    const modelMatches = content.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\}/g);
                    for (const match of modelMatches) {
                        const [, modelName, body] = match;
                        const columns = body.split('\n')
                            .map(line => line.trim())
                            .filter(line => line && !line.startsWith('//') && !line.startsWith('@@'))
                            .map(line => {
                                const parts = line.split(/\s+/);
                                return {
                                    name: parts[0],
                                    type: parts[1] || 'unknown',
                                    isPrimary: line.includes('@id'),
                                    isForeign: line.includes('@relation')
                                };
                            })
                            .filter(col => col.name);
                        tables.push({ name: modelName, columns, source: 'prisma' });
                    }
                } else if (schemaPath.includes('supabase') || schemaPath.includes('database')) {
                    // Parse TypeScript Database types
                    const tableMatches = content.matchAll(/(\w+):\s*\{\s*Row:\s*\{([^}]+)\}/g);
                    for (const match of tableMatches) {
                        const [, tableName, rowDef] = match;
                        const columns = rowDef.split('\n')
                            .map(line => line.trim())
                            .filter(line => line && line.includes(':'))
                            .map(line => {
                                const [name, type] = line.split(':').map(s => s.trim());
                                return {
                                    name: name.replace(/['"]/g, ''),
                                    type: type?.replace(/[;,]/g, '') || 'unknown'
                                };
                            });
                        tables.push({ name: tableName, columns, source: 'supabase-types' });
                    }
                }
            } catch { }
        }
    }

    return tables;
});

// ============================================
// 15. Terminal (PTY) - VS Code style
// NOTE: node-pty 버전 충돌로 비활성화 - terminal-server.js(WebSocket) 사용
// ============================================

const PTY_DISABLED = true;

// 터미널 인스턴스 저장소
const terminals: Map<string, any> = new Map();

// 기본 셸 결정
function getDefaultShell(): string {
    if (process.platform === 'win32') {
        return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/zsh';
}

// 터미널 생성 - WebSocket 서버(terminal-server.js)로 리다이렉트
ipcMain.handle('terminal:create', async (_event, id: string, cwd?: string) => {
    if (PTY_DISABLED || !pty) {
        // PTY 비활성화 - WebSocket 서버 사용 안내
        return {
            success: true,
            useWebSocket: true,
            wsUrl: 'ws://localhost:3001',
            message: 'Use WebSocket terminal server at ws://localhost:3001'
        };
    }

    // Legacy PTY code (비활성화됨)
    return { success: false, error: 'PTY is disabled. Use WebSocket terminal.' }
});

// 터미널 입력
ipcMain.handle('terminal:write', async (_, id: string, data: string) => {
    const ptyProcess = terminals.get(id);
    if (ptyProcess) {
        ptyProcess.write(data);
        return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
});

// 터미널 리사이즈
ipcMain.handle('terminal:resize', async (_, id: string, cols: number, rows: number) => {
    const ptyProcess = terminals.get(id);
    if (ptyProcess) {
        ptyProcess.resize(cols, rows);
        return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
});

// 터미널 종료
ipcMain.handle('terminal:kill', async (_, id: string) => {
    const ptyProcess = terminals.get(id);
    if (ptyProcess) {
        ptyProcess.kill();
        terminals.delete(id);
        return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
});

// 앱 종료 시 모든 터미널 정리
app.on('before-quit', () => {
    terminals.forEach((ptyProcess) => {
        ptyProcess.kill();
    });
    terminals.clear();
});

// ============================================
// AI Agent - Electron 메인 프로세스에서 직접 실행
// Cursor 스타일: API 라운드트립 없이 직접 파일시스템 접근
// ============================================

interface AgentFile {
    id: string;
    name: string;
    path?: string;
    content?: string;
    type: string;
}

interface AgentContext {
    files: AgentFile[];
    projectPath?: string;
}

interface AgentMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}

// 설계 결과 저장소 (세션 동안 유지)
interface DesignArtifact {
    type: 'flowchart' | 'schema' | 'logic';
    title: string;
    content: string;
    createdAt: number;
}
const designArtifacts: DesignArtifact[] = [];

// Agent 도구 실행 - 직접 파일시스템 접근
async function executeAgentTool(
    toolName: string,
    args: Record<string, unknown>,
    context: AgentContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const projectPath = context.projectPath || '';

    console.log(`[Tool] 실행: ${toolName}`);
    console.log(`[Tool] 인자:`, JSON.stringify(args, null, 2));

    try {
        switch (toolName) {
            // ====== 설계 도구 ======
            case 'create_flowchart': {
                const title = args.title as string;
                const mermaidCode = args.mermaid_code as string;
                const diagramType = (args.diagram_type as string) || 'flowchart';

                // 설계 저장
                designArtifacts.push({
                    type: 'flowchart',
                    title,
                    content: mermaidCode,
                    createdAt: Date.now()
                });

                // .mermaid 파일로도 저장
                const safeName = title.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase();
                const mermaidPath = path.join(projectPath || '/tmp', `design_${safeName}.mmd`);
                await writeFile(mermaidPath, mermaidCode, 'utf-8');

                // 렌더러에 이벤트 전송 (탭 전환 + 다이어그램 표시)
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('agent:design', {
                        type: 'flowchart',
                        title,
                        mermaidCode,
                        diagramType,
                        filePath: mermaidPath
                    });
                }

                console.log(`[Tool] 플로우차트 생성: ${title}`);
                return {
                    success: true,
                    result: {
                        title,
                        diagramType,
                        filePath: mermaidPath,
                        message: `플로우차트 "${title}" 생성 완료. Mermaid 탭에서 확인하세요.`
                    }
                };
            }

            case 'design_data_schema': {
                const title = args.title as string;
                const schema = args.schema as string;
                const description = (args.description as string) || '';

                designArtifacts.push({
                    type: 'schema',
                    title,
                    content: schema,
                    createdAt: Date.now()
                });

                // .d.ts 파일로 저장
                const safeName = title.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase();
                const schemaPath = path.join(projectPath || '/tmp', `types_${safeName}.d.ts`);
                const schemaContent = `/**
 * ${title}
 * ${description}
 * Generated by Agent
 */

${schema}
`;
                await writeFile(schemaPath, schemaContent, 'utf-8');

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('agent:design', {
                        type: 'schema',
                        title,
                        schema,
                        description,
                        filePath: schemaPath
                    });
                }

                console.log(`[Tool] 스키마 설계: ${title}`);
                return {
                    success: true,
                    result: {
                        title,
                        filePath: schemaPath,
                        message: `데이터 스키마 "${title}" 설계 완료. Data 탭에서 확인하세요.`
                    }
                };
            }

            case 'design_logic': {
                const title = args.title as string;
                const pseudocode = args.pseudocode as string;
                const functions = (args.functions as string[]) || [];

                designArtifacts.push({
                    type: 'logic',
                    title,
                    content: pseudocode,
                    createdAt: Date.now()
                });

                // .logic.md 파일로 저장
                const safeName = title.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase();
                const logicPath = path.join(projectPath || '/tmp', `logic_${safeName}.md`);
                const logicContent = `# ${title} - 로직 설계

## 알고리즘
\`\`\`
${pseudocode}
\`\`\`

## 구현할 함수
${functions.map(f => `- \`${f}()\``).join('\n')}

---
Generated by Agent at ${new Date().toISOString()}
`;
                await writeFile(logicPath, logicContent, 'utf-8');

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('agent:design', {
                        type: 'logic',
                        title,
                        pseudocode,
                        functions,
                        filePath: logicPath
                    });
                }

                console.log(`[Tool] 로직 설계: ${title}`);
                return {
                    success: true,
                    result: {
                        title,
                        functions,
                        filePath: logicPath,
                        message: `로직 "${title}" 설계 완료. Logic 탭에서 확인하세요.`
                    }
                };
            }

            case 'switch_view': {
                const tab = args.tab as string;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('agent:switch-tab', { tab });
                }
                return { success: true, result: { tab, message: `${tab} 탭으로 전환됨` } };
            }

            // ====== 파일 도구 ======
            case 'read_file': {
                const filePath = args.path as string;
                const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
                const content = await readFile(fullPath, 'utf-8');
                return { success: true, result: { path: filePath, content, lines: content.split('\n').length } };
            }

            case 'edit_file': {
                const filePath = args.path as string;
                const oldContent = args.old_content as string;
                const newContent = args.new_content as string;
                const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);

                const currentContent = await readFile(fullPath, 'utf-8');
                if (!currentContent.includes(oldContent)) {
                    return { success: false, error: '교체할 코드를 찾을 수 없습니다' };
                }

                const updatedContent = currentContent.replace(oldContent, newContent);
                await writeFile(fullPath, updatedContent, 'utf-8');

                // Notify renderer that file changed
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('fs:changed', { path: fullPath, type: 'change' });
                }

                return { success: true, result: { path: filePath, message: '파일이 수정되었습니다' } };
            }

            case 'create_file': {
                const filePath = args.path as string;
                const content = args.content as string;
                const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);

                console.log(`[Tool] create_file: ${fullPath}`);

                // 디렉토리 생성
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    console.log(`[Tool] 디렉토리 생성: ${dir}`);
                    fs.mkdirSync(dir, { recursive: true });
                }

                await writeFile(fullPath, content, 'utf-8');
                console.log(`[Tool] 파일 생성 완료: ${fullPath} (${content.length} bytes)`);

                // Notify renderer that file created
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('fs:changed', { path: fullPath, type: 'create' });
                }

                return { success: true, result: { path: filePath, message: '파일이 생성되었습니다' } };
            }

            case 'run_terminal_cmd': {
                const command = args.command as string;
                const cwd = (args.cwd as string) || projectPath;

                // 위험한 명령어 필터링
                const dangerousPatterns = [/rm\s+-rf\s+[\/~]/i, /sudo\s+rm/i, /mkfs/i];
                for (const pattern of dangerousPatterns) {
                    if (pattern.test(command)) {
                        return { success: false, error: '위험한 명령어는 실행할 수 없습니다' };
                    }
                }

                return new Promise((resolve) => {
                    exec(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
                        if (error) {
                            resolve({ success: false, error: error.message, result: { stdout, stderr } });
                        } else {
                            resolve({ success: true, result: { stdout, stderr } });
                        }
                    });
                });
            }

            case 'search_files': {
                const query = (args.query as string).toLowerCase();
                const results: Array<{ path: string; matches: string[] }> = [];

                for (const file of context.files) {
                    const filePath = file.path || file.name;
                    if (filePath.toLowerCase().includes(query)) {
                        results.push({ path: filePath, matches: ['파일명 일치'] });
                    } else if (file.content?.toLowerCase().includes(query)) {
                        const lines = file.content.split('\n');
                        const matchedLines = lines
                            .filter(line => line.toLowerCase().includes(query))
                            .slice(0, 3)
                            .map(line => line.trim().slice(0, 80));
                        if (matchedLines.length > 0) {
                            results.push({ path: filePath, matches: matchedLines });
                        }
                    }
                }
                return { success: true, result: { query, count: results.length, results: results.slice(0, 20) } };
            }

            case 'get_file_structure': {
                const basePath = (args.path as string) || projectPath;
                const structure: Record<string, string[]> = {};

                for (const file of context.files) {
                    const filePath = file.path || file.name;
                    const parts = filePath.split('/');
                    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
                    if (!structure[folder]) structure[folder] = [];
                    structure[folder].push(parts[parts.length - 1]);
                }
                return { success: true, result: { totalFiles: context.files.length, structure } };
            }

            // ====== 프로젝트 스캐폴딩 도구 ======
            case 'check_folder_empty': {
                try {
                    const entries = await readdir(projectPath, { withFileTypes: true });
                    const nonSystemFiles = entries.filter(e =>
                        !e.name.startsWith('.') &&
                        e.name !== 'node_modules' &&
                        e.name !== '__pycache__'
                    );
                    const isEmpty = nonSystemFiles.length === 0;
                    const folderName = path.basename(projectPath);

                    return {
                        success: true,
                        result: {
                            isEmpty,
                            folderName,
                            path: projectPath,
                            existingFiles: nonSystemFiles.map(e => e.name).slice(0, 10),
                            message: isEmpty
                                ? `"${folderName}" 폴더가 비어있습니다. scaffold_project로 프로젝트를 초기화하세요.`
                                : `"${folderName}" 폴더에 ${nonSystemFiles.length}개 파일/폴더가 있습니다.`
                        }
                    };
                } catch (err: any) {
                    return { success: false, error: err.message };
                }
            }

            case 'scaffold_project': {
                const template = args.template as string;
                const projectName = (args.name as string) || path.basename(projectPath);
                const options = (args.options as Record<string, boolean>) || {};

                console.log(`[Tool] 프로젝트 스캐폴딩: ${template} → ${projectPath}`);

                // 템플릿별 명령어 정의
                const SCAFFOLD_COMMANDS: Record<string, { cmd: string; postInstall?: string[]; files?: Record<string, string> }> = {
                    'next-app': {
                        cmd: `npx create-next-app@latest . --js --no-git --use-npm --no-tailwind --no-eslint --no-src-dir --no-app --import-alias "@/*" --yes`,
                    },
                    'next-app-ts': {
                        cmd: `npx create-next-app@latest . --ts --no-git --use-npm ${options.tailwind ? '--tailwind' : '--no-tailwind'} ${options.eslint ? '--eslint' : '--no-eslint'} --src-dir --app --import-alias "@/*" --yes`,
                    },
                    'vite-react': {
                        cmd: `npm create vite@latest . -- --template react`,
                        postInstall: ['npm install']
                    },
                    'vite-react-ts': {
                        cmd: `npm create vite@latest . -- --template react-ts`,
                        postInstall: ['npm install']
                    },
                    'vite-vue': {
                        cmd: `npm create vite@latest . -- --template vue-ts`,
                        postInstall: ['npm install']
                    },
                    'express': {
                        cmd: '',
                        postInstall: ['npm init -y', 'npm install express cors'],
                        files: {
                            'index.js': `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ${projectName}!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
                            '.gitignore': 'node_modules\n.env\n.DS_Store'
                        }
                    },
                    'express-ts': {
                        cmd: '',
                        postInstall: ['npm init -y', 'npm install express cors', 'npm install -D typescript @types/node @types/express ts-node nodemon'],
                        files: {
                            'src/index.ts': `import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from ${projectName}!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
                            'tsconfig.json': JSON.stringify({
                                compilerOptions: {
                                    target: "ES2020",
                                    module: "commonjs",
                                    lib: ["ES2020"],
                                    outDir: "./dist",
                                    rootDir: "./src",
                                    strict: true,
                                    esModuleInterop: true,
                                    skipLibCheck: true
                                },
                                include: ["src/**/*"]
                            }, null, 2),
                            '.gitignore': 'node_modules\ndist\n.env\n.DS_Store'
                        }
                    },
                    'python-fastapi': {
                        cmd: '',
                        postInstall: ['python3 -m venv venv', './venv/bin/pip install fastapi uvicorn'],
                        files: {
                            'main.py': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="${projectName}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello from ${projectName}!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
                            'requirements.txt': 'fastapi\nuvicorn[standard]',
                            '.gitignore': 'venv\n__pycache__\n.env\n*.pyc'
                        }
                    },
                    'python-flask': {
                        cmd: '',
                        postInstall: ['python3 -m venv venv', './venv/bin/pip install flask flask-cors'],
                        files: {
                            'app.py': `from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    return jsonify({"message": "Hello from ${projectName}!"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)`,
                            'requirements.txt': 'flask\nflask-cors',
                            '.gitignore': 'venv\n__pycache__\n.env\n*.pyc'
                        }
                    },
                    'electron-react': {
                        cmd: `npm create vite@latest . -- --template react-ts`,
                        postInstall: [
                            'npm install',
                            'npm install -D electron electron-builder concurrently wait-on'
                        ],
                        files: {
                            'electron/main.js': `const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  mainWindow.loadURL(isDev ? 'http://localhost:5173' : \`file://\${path.join(__dirname, '../dist/index.html')}\`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });`
                        }
                    },
                    'empty': {
                        cmd: '',
                        postInstall: ['npm init -y'],
                        files: {
                            '.gitignore': 'node_modules\n.env\n.DS_Store\ndist\nbuild',
                            'README.md': `# ${projectName}\n\nNew project created by GlowUS Agent.`
                        }
                    }
                };

                const scaffoldConfig = SCAFFOLD_COMMANDS[template];
                if (!scaffoldConfig) {
                    return { success: false, error: `알 수 없는 템플릿: ${template}` };
                }

                const results: string[] = [];

                try {
                    // 1. 파일 생성 (있으면)
                    if (scaffoldConfig.files) {
                        for (const [filePath, content] of Object.entries(scaffoldConfig.files)) {
                            const fullPath = path.join(projectPath, filePath);
                            const dir = path.dirname(fullPath);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            await writeFile(fullPath, content, 'utf-8');
                            results.push(`✅ 생성: ${filePath}`);
                        }
                    }

                    // 2. 메인 명령어 실행 (있으면)
                    if (scaffoldConfig.cmd) {
                        const { stdout, stderr } = await execPromise(scaffoldConfig.cmd, {
                            cwd: projectPath,
                            timeout: 120000,
                            maxBuffer: 10 * 1024 * 1024
                        });
                        results.push(`✅ 스캐폴딩 완료: ${template}`);
                        if (stdout) results.push(stdout.slice(0, 500));
                    }

                    // 3. 후처리 명령어 실행
                    if (scaffoldConfig.postInstall) {
                        for (const cmd of scaffoldConfig.postInstall) {
                            try {
                                const { stdout } = await execPromise(cmd, {
                                    cwd: projectPath,
                                    timeout: 180000,
                                    maxBuffer: 10 * 1024 * 1024
                                });
                                results.push(`✅ 실행: ${cmd}`);
                            } catch (err: any) {
                                results.push(`⚠️ ${cmd}: ${err.message.slice(0, 100)}`);
                            }
                        }
                    }

                    // 렌더러에 프로젝트 초기화 완료 알림
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('project:scaffolded', {
                            template,
                            projectName,
                            path: projectPath,
                            results
                        });
                    }

                    return {
                        success: true,
                        result: {
                            template,
                            projectName,
                            path: projectPath,
                            log: results,
                            message: `🎉 "${projectName}" 프로젝트가 ${template} 템플릿으로 생성되었습니다!`
                        }
                    };
                } catch (error: any) {
                    return {
                        success: false,
                        error: error.message,
                        result: { log: results }
                    };
                }
            }

            default:
                return { success: false, error: `알 수 없는 도구: ${toolName}` };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// 도구 정의 (공통) - 개발 워크플로우 순서 반영
const AGENT_TOOL_DEFINITIONS = [
    // ====== PHASE 1: 설계 도구 (먼저 사용) ======
    {
        name: 'create_flowchart',
        description: 'STEP 1: Create a Mermaid flowchart diagram to visualize the app structure. ALWAYS use this FIRST before coding.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Diagram title' },
                mermaid_code: { type: 'string', description: 'Mermaid flowchart syntax (e.g., "flowchart TD\\n  A[Start] --> B[Process]...")' },
                diagram_type: { type: 'string', enum: ['flowchart', 'sequence', 'class', 'er', 'state'], description: 'Diagram type' }
            },
            required: ['title', 'mermaid_code']
        }
    },
    {
        name: 'design_data_schema',
        description: 'STEP 2: Design data structure/schema. Use after flowchart, before coding.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Schema name' },
                schema: { type: 'string', description: 'TypeScript interface or JSON schema definition' },
                description: { type: 'string', description: 'What this data represents' }
            },
            required: ['title', 'schema']
        }
    },
    {
        name: 'design_logic',
        description: 'STEP 3: Design logic flow and algorithms. Use after schema, before coding.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Logic module name' },
                pseudocode: { type: 'string', description: 'Pseudocode or algorithm description' },
                functions: { type: 'array', items: { type: 'string' }, description: 'List of function names to implement' }
            },
            required: ['title', 'pseudocode']
        }
    },
    {
        name: 'switch_view',
        description: 'Switch to a different view tab (map, logic, data, mermaid)',
        parameters: {
            type: 'object',
            properties: {
                tab: { type: 'string', enum: ['map', 'logic', 'data', 'mermaid'], description: 'Tab to switch to' }
            },
            required: ['tab']
        }
    },
    // ====== PHASE 2: 코딩 도구 (설계 후 사용) ======
    {
        name: 'create_file',
        description: 'STEP 4: Create a new file. Use AFTER completing design (flowchart → schema → logic → code).',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path (e.g., "game.html", "src/app.js")' },
                content: { type: 'string', description: 'Complete file content (full source code)' }
            },
            required: ['path', 'content']
        }
    },
    {
        name: 'edit_file',
        description: 'Modify an existing file',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to edit' },
                old_content: { type: 'string', description: 'Exact code to replace' },
                new_content: { type: 'string', description: 'New code to insert' }
            },
            required: ['path', 'old_content', 'new_content']
        }
    },
    {
        name: 'read_file',
        description: 'Read file contents',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to read' }
            },
            required: ['path']
        }
    },
    {
        name: 'run_terminal_cmd',
        description: 'Run shell command (npm install, git, etc)',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Command to run' },
                cwd: { type: 'string', description: 'Working directory' }
            },
            required: ['command']
        }
    },
    {
        name: 'search_files',
        description: 'Search for code or files',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
        }
    },
    {
        name: 'get_file_structure',
        description: 'List folder structure',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path' }
            },
            required: []
        }
    },
    // ====== PHASE 0: 프로젝트 스캐폴딩 도구 ======
    {
        name: 'scaffold_project',
        description: 'Initialize a new project from template (like Cursor/Antigravity). Use when user opens an empty folder or asks to create a new project.',
        parameters: {
            type: 'object',
            properties: {
                template: {
                    type: 'string',
                    enum: ['next-app', 'next-app-ts', 'vite-react', 'vite-react-ts', 'vite-vue', 'express', 'express-ts', 'python-fastapi', 'python-flask', 'electron-react', 'empty'],
                    description: 'Project template to use'
                },
                name: { type: 'string', description: 'Project name (optional, uses folder name if not provided)' },
                options: {
                    type: 'object',
                    properties: {
                        typescript: { type: 'boolean', description: 'Use TypeScript' },
                        tailwind: { type: 'boolean', description: 'Include Tailwind CSS' },
                        eslint: { type: 'boolean', description: 'Include ESLint' }
                    }
                }
            },
            required: ['template']
        }
    },
    {
        name: 'check_folder_empty',
        description: 'Check if the current project folder is empty (to suggest project scaffolding)',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
];

const MAX_ITERATIONS = 10;

// OpenAI/xAI 형식 도구
function getOpenAITools() {
    return AGENT_TOOL_DEFINITIONS.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
}

// Anthropic 형식 도구
function getAnthropicTools() {
    return AGENT_TOOL_DEFINITIONS.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
    }));
}

// Gemini 형식 도구
function getGeminiTools() {
    return [{ functionDeclarations: AGENT_TOOL_DEFINITIONS }];
}

// ============================================
// OpenAI/xAI Agent
// ============================================
async function runOpenAIAgent(
    messages: AgentMessage[],
    context: AgentContext,
    apiKey: string,
    apiModel: string,
    baseURL?: string
): Promise<{ content: string; toolCalls: string[] }> {
    const toolCallLog: string[] = [];
    const tools = getOpenAITools();
    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // 첫 번째 반복에서는 도구 사용 강제, 이후에는 auto
        const toolChoice = i === 0 ? 'required' : 'auto';

        const response = await fetch(`${baseURL || 'https://api.openai.com'}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: apiModel,
                messages: currentMessages,
                tools,
                tool_choice: toolChoice
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message;
        if (!assistantMessage) break;

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            return { content: assistantMessage.content || '', toolCalls: toolCallLog };
        }

        currentMessages.push(assistantMessage);

        // 병렬 도구 실행
        const toolResults = await Promise.all(
            assistantMessage.tool_calls.map(async (tc: any) => {
                const args = JSON.parse(tc.function.arguments);
                toolCallLog.push(`${tc.function.name}(${JSON.stringify(args)})`);
                const result = await executeAgentTool(tc.function.name, args, context);
                return { role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id };
            })
        );

        currentMessages.push(...toolResults);
    }

    return { content: '최대 반복 횟수 도달', toolCalls: toolCallLog };
}

// ============================================
// Anthropic Agent
// ============================================
async function runAnthropicAgent(
    messages: AgentMessage[],
    context: AgentContext,
    apiKey: string,
    apiModel: string
): Promise<{ content: string; toolCalls: string[] }> {
    const toolCallLog: string[] = [];
    const tools = getAnthropicTools();

    const systemMessages = messages.filter(m => m.role === 'system');
    let currentMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // 첫 번째 반복에서는 도구 사용 강제
        const toolChoice = i === 0 ? { type: 'any' } : { type: 'auto' };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: apiModel,
                max_tokens: 4096,
                system: systemMessages.map(m => m.content).join('\n'),
                tools,
                tool_choice: toolChoice,
                messages: currentMessages
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.content || [];

        const textParts = content.filter((c: any) => c.type === 'text');
        const toolUses = content.filter((c: any) => c.type === 'tool_use');

        if (toolUses.length === 0) {
            return { content: textParts.map((c: any) => c.text).join('\n'), toolCalls: toolCallLog };
        }

        currentMessages.push({ role: 'assistant', content: JSON.stringify(content) });

        // 병렬 도구 실행
        const toolResults = await Promise.all(
            toolUses.map(async (tu: any) => {
                toolCallLog.push(`${tu.name}(${JSON.stringify(tu.input)})`);
                const result = await executeAgentTool(tu.name, tu.input, context);
                return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) };
            })
        );

        // Anthropic expects tool results as user message with special format
        currentMessages.push({ role: 'user', content: JSON.stringify(toolResults) });
    }

    return { content: '최대 반복 횟수 도달', toolCalls: toolCallLog };
}

// ============================================
// Gemini Agent
// ============================================
async function runGeminiAgent(
    messages: AgentMessage[],
    context: AgentContext,
    apiKey: string,
    apiModel: string
): Promise<{ content: string; toolCalls: string[] }> {
    const toolCallLog: string[] = [];
    const tools = getGeminiTools();

    const systemMessages = messages.filter(m => m.role === 'system');
    let chatMessages = messages.filter(m => m.role !== 'system');

    const systemInstruction = systemMessages.length > 0
        ? { parts: [{ text: systemMessages.map(m => m.content).join('\n') }] }
        : undefined;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const contents = chatMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // 첫 번째 반복에서는 도구 사용 강제
        const toolConfig = i === 0
            ? { functionCallingConfig: { mode: 'ANY' } }
            : { functionCallingConfig: { mode: 'AUTO' } };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemInstruction, contents, tools, toolConfig })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        const functionCalls = parts.filter((p: any) => p.functionCall);
        const textParts = parts.filter((p: any) => p.text);

        if (functionCalls.length === 0) {
            return { content: textParts.map((p: any) => p.text).join('\n'), toolCalls: toolCallLog };
        }

        chatMessages.push({ role: 'assistant', content: textParts.map((p: any) => p.text).join('\n') });

        // 병렬 도구 실행
        const results = await Promise.all(
            functionCalls.map(async (fc: any) => {
                const { name, args } = fc.functionCall;
                toolCallLog.push(`${name}(${JSON.stringify(args)})`);
                const result = await executeAgentTool(name, args, context);
                return { role: 'user' as const, content: `[Tool Result for ${name}]: ${JSON.stringify(result)}` };
            })
        );

        chatMessages.push(...results);
    }

    return { content: '최대 반복 횟수 도달', toolCalls: toolCallLog };
}

// 모델 ID → API 모델명 매핑 (lib/ai/models.ts와 동기화)
const MODEL_API_MAP: Record<string, { provider: 'openai' | 'anthropic' | 'google' | 'xai'; apiModel: string }> = {
    // Anthropic
    'claude-3.5-sonnet': { provider: 'anthropic', apiModel: 'claude-3-5-sonnet-20241022' },
    'claude-3-opus': { provider: 'anthropic', apiModel: 'claude-3-opus-20240229' },
    // OpenAI
    'gpt-4o': { provider: 'openai', apiModel: 'gpt-4o' },
    // Google
    'gemini-1.5-pro': { provider: 'google', apiModel: 'gemini-1.5-pro' },
    'gemini-3-flash': { provider: 'google', apiModel: 'gemini-2.0-flash-exp' },
    // xAI
    'grok-4.1-fast': { provider: 'xai', apiModel: 'grok-3-fast' },
};

// 모델 → Provider 매핑
function getProviderFromModel(model: string): 'openai' | 'anthropic' | 'google' | 'xai' {
    // 먼저 정확한 매핑 확인
    if (MODEL_API_MAP[model]) {
        return MODEL_API_MAP[model].provider;
    }
    // 폴백: 키워드 기반
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('grok')) return 'xai';
    return 'google'; // 기본값 Gemini
}

// 모델 ID → API 모델명
function getApiModelName(model: string): string {
    if (MODEL_API_MAP[model]) {
        return MODEL_API_MAP[model].apiModel;
    }
    return model; // 매핑 없으면 그대로 사용
}

// API 키 가져오기
function getApiKey(provider: string): string | null {
    switch (provider) {
        case 'openai': return process.env.OPENAI_API_KEY || null;
        case 'anthropic': return process.env.ANTHROPIC_API_KEY || null;
        case 'google': return process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
        case 'xai': return process.env.XAI_API_KEY || null;
        default: return null;
    }
}

// Agent IPC 핸들러 - 전체 Provider 지원
ipcMain.handle('agent:execute', async (_, params: {
    messages: AgentMessage[];
    model: string;
    context: AgentContext;
}) => {
    console.log('========================================');
    console.log('[Agent] IPC 호출됨!');
    console.log('[Agent] 프로젝트 경로:', params.context.projectPath);
    console.log('[Agent] 파일 수:', params.context.files.length);
    console.log('========================================');

    try {
        const { messages, model, context } = params;

        // Provider 감지
        const provider = getProviderFromModel(model);
        console.log(`[Agent] Model: ${model}, Provider: ${provider}`);

        // API 키 가져오기
        const apiKey = getApiKey(provider);
        console.log(`[Agent] API Key 상태: ${apiKey ? '있음 (' + apiKey.slice(0, 10) + '...)' : '없음'}`);

        if (!apiKey) {
            console.error(`[Agent] API 키 없음! Provider: ${provider}`);
            return {
                success: false,
                error: `${provider.toUpperCase()} API 키가 설정되지 않았습니다. 환경변수를 확인하세요.`
            };
        }

        // 시스템 프롬프트 - 설계 → 구현 워크플로우
        const projectPath = context.projectPath || '/tmp/glowus-agent';
        const systemPrompt: AgentMessage = {
            role: 'system',
            content: `You are a professional software architect and developer for GlowUS IDE (like Cursor/Antigravity).

## 🚀 STEP 0: 프로젝트 초기화 (빈 폴더일 경우)
If the project folder is empty or user asks to create a new project:
1. Use \`check_folder_empty\` to verify
2. Use \`scaffold_project\` with appropriate template:
   - "next-app-ts": Next.js + TypeScript (풀스택 웹앱)
   - "vite-react-ts": Vite + React + TypeScript (SPA)
   - "vite-vue": Vite + Vue + TypeScript
   - "express-ts": Express + TypeScript (백엔드 API)
   - "python-fastapi": FastAPI (Python 백엔드)
   - "python-flask": Flask (Python 백엔드)
   - "electron-react": Electron + React (데스크톱 앱)
   - "empty": 빈 npm 프로젝트

## 🚨 MANDATORY DEVELOPMENT WORKFLOW (순서 엄수!)

### STEP 1: 플로우차트 (create_flowchart)
- 먼저 앱 구조를 Mermaid 다이어그램으로 시각화
- User flow, component hierarchy, state flow 등

### STEP 2: 데이터 스키마 (design_data_schema)
- TypeScript interface로 데이터 구조 정의
- 어떤 데이터가 필요한지 명확히

### STEP 3: 로직 설계 (design_logic)
- 핵심 알고리즘을 pseudocode로 작성
- 구현할 함수 목록 정리

### STEP 4: 코딩 (create_file)
- 설계가 완료된 후에만 코드 작성
- 설계 문서를 기반으로 구현

## 예시 1: "새 프로젝트 만들어" (빈 폴더)
1️⃣ check_folder_empty → isEmpty: true
2️⃣ scaffold_project: template="next-app-ts"
3️⃣ 사용자에게 완료 알림

## 예시 2: "테트리스 게임 만들어"
1️⃣ create_flowchart:
   - title: "Tetris Game Flow"
   - mermaid_code: "flowchart TD\\n  A[게임시작] --> B[블록생성]\\n  B --> C{충돌체크}..."

2️⃣ design_data_schema:
   - title: "Tetris Types"
   - schema: "interface Block { shape: number[][]; x: number; y: number; }..."

3️⃣ design_logic:
   - title: "Tetris Logic"
   - pseudocode: "1. 새 블록 생성\\n2. 타이머로 블록 하강\\n3. 충돌시 고정..."
   - functions: ["createBlock", "moveDown", "checkCollision", "clearLines"]

4️⃣ create_file:
   - path: "tetris.html"
   - content: (설계 기반 전체 코드)

## Working Directory: ${projectPath}

## ❌ 절대 하지 말 것:
- 코드를 텍스트로 출력하지 마라
- 설계 없이 바로 코딩하지 마라
- 도구 사용 안하고 설명만 하지 마라

## ✅ 반드시 할 것:
- 빈 폴더면 먼저 scaffold_project
- 4단계 순서 엄수
- 모든 작업은 도구로만
- 각 단계 완료 후 다음 단계로`
        };

        const allMessages = [systemPrompt, ...messages];
        let result: { content: string; toolCalls: string[] };

        // API 모델명 가져오기
        const apiModel = getApiModelName(model);
        console.log(`[Agent] API Model: ${apiModel}`);

        // Provider별 Agent 실행
        switch (provider) {
            case 'openai':
                result = await runOpenAIAgent(allMessages, context, apiKey, apiModel);
                break;

            case 'xai':
                result = await runOpenAIAgent(allMessages, context, apiKey, apiModel, 'https://api.x.ai');
                break;

            case 'anthropic':
                result = await runAnthropicAgent(allMessages, context, apiKey, apiModel);
                break;

            case 'google':
            default:
                result = await runGeminiAgent(allMessages, context, apiKey, apiModel);
                break;
        }

        console.log(`[Agent] Completed. Tools used: ${result.toolCalls.length}`);

        return {
            success: true,
            content: result.content,
            toolCalls: result.toolCalls
        };
    } catch (error: any) {
        console.error('[Agent] Error:', error);
        return { success: false, error: error.message };
    }
});
