import { app, BrowserWindow, ipcMain, dialog, shell, Menu, webContents } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { fork, ChildProcess } from 'child_process';

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

        // if (!app.isPackaged) {
        //    mainWindow.webContents.openDevTools();
        // }

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
