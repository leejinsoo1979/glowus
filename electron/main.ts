import { app, BrowserWindow, ipcMain, dialog, shell, Menu, webContents } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { fork, ChildProcess, exec } from 'child_process';

// Log for debugging auto-updates in production
autoUpdater.logger = console;

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);
const writeFile = util.promisify(fs.writeFile);

if (process.platform === 'darwin') {
    app.setName('GlowUS');
}

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

        // Spoof User Agent to allows Google Login (Remove "Electron" identifier)
        const userAgent = mainWindow.webContents.getUserAgent();
        mainWindow.webContents.setUserAgent(userAgent.replace(/Electron\/[0-9\.]+\s/, ''));

        mainWindow.loadURL(startUrl);

        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }

        // Handle external links - DISABLED: This overrides webview internal popups.
        // webview internal "new-window" events should be handled by the renderer.
        /*
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
        */

        mainWindow.on('closed', () => {
            mainWindow = null;
        });

    } catch (err: any) {
        console.error('Failed to create window:', err);
        dialog.showErrorBox('Application Error', `Failed to start the application server.\n\nError: ${err.message}`);
    }
}

app.whenReady().then(() => {
    createWindow();

    // Check for updates on startup
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
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
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();

        // Detailed update lifecycle events
        autoUpdater.on('update-available', () => {
            console.log('Update available, downloading...');
        });

        autoUpdater.on('update-downloaded', (info) => {
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

        autoUpdater.on('error', (err) => {
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
            // We can emit an event here if we wanted to handle it in the main process,
            // but the renderer's <webview> 'new-window' or 'did-attach' logic 
            // is usually where we assume control. 
            // However, to strictly satisfy "NO POPUPS", we deny everything here.
            // If the renderer's listener works, it picks up the url.
            // If the renderer listener was failing because of Main process interference, this clarifies "Deny"
            // But wait, if we deny here, does the renderer still get notified?
            // Usually yes.
            // Let's allow shell.openExternal ONLY if we decide to? No, user wants internal.
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
            } catch {}
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
                            } catch {}
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

// 5. Check for Updates
ipcMain.handle('app:check-for-updates', async () => {
    if (app.isPackaged) {
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
                    } catch {}
                }
            }
        } catch {}
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
                        } catch {}
                    }
                }
            }
        } catch {}
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

// 14. Parse Supabase/Database Schema
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
            } catch {}
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
            } catch {}
        }
    }

    return tables;
});

// ============================================
// 15. Terminal (PTY) - VS Code style
// ============================================
import * as pty from 'node-pty';
import * as os from 'os';

// 터미널 인스턴스 저장소
const terminals: Map<string, pty.IPty> = new Map();

// 기본 셸 결정
function getDefaultShell(): string {
    if (process.platform === 'win32') {
        return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/zsh';
}

// 터미널 생성
ipcMain.handle('terminal:create', async (event, id: string, cwd?: string) => {
    try {
        const shell = getDefaultShell();
        const shellName = path.basename(shell);
        const workingDir = cwd || process.cwd();

        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: workingDir,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
            } as { [key: string]: string },
        });

        terminals.set(id, ptyProcess);

        // PTY 출력 → 렌더러
        ptyProcess.onData((data) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('terminal:data', id, data);
            }
        });

        // PTY 종료
        ptyProcess.onExit(({ exitCode, signal }) => {
            terminals.delete(id);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('terminal:exit', id, exitCode, signal);
            }
        });

        return {
            success: true,
            shell: shellName,
            cwd: workingDir,
            pid: ptyProcess.pid,
        };
    } catch (err: any) {
        console.error('Terminal create error:', err);
        return { success: false, error: err.message };
    }
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
