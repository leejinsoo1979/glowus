import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Generic IPC invoke for any channel
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

    // File system operations
    fs: {
        getCwd: () => ipcRenderer.invoke('fs:get-cwd'),
        selectDirectory: () => ipcRenderer.invoke('fs:select-directory'),
        readDirectory: (path: string, options: any) => ipcRenderer.invoke('fs:read-directory', path, options),
        scanTree: (rootPath: string, options?: {
            includeSystemFiles?: boolean;
            maxDepth?: number;
            includeContent?: boolean;
            contentExtensions?: string[];
        }) => ipcRenderer.invoke('fs:scan-tree', rootPath, options),
        readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
        writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
        fileStats: (dirPath: string) => ipcRenderer.invoke('fs:file-stats', dirPath),
        scanApiRoutes: (dirPath: string) => ipcRenderer.invoke('fs:scan-api-routes', dirPath),
        scanTypes: (dirPath: string, options?: { extensions?: string[] }) => ipcRenderer.invoke('fs:scan-types', dirPath, options),
        scanSchema: (dirPath: string) => ipcRenderer.invoke('fs:scan-schema', dirPath),
    },

    // Git operations
    git: {
        log: (dirPath: string, options?: { maxCommits?: number }) => ipcRenderer.invoke('git:log', dirPath, options),
        branches: (dirPath: string) => ipcRenderer.invoke('git:branches', dirPath),
    },

    // DevTools helper
    openWebviewDevTools: (id?: number) => ipcRenderer.invoke('app:open-webview-devtools', id),

    // Menu event listeners
    onMenuEvent: (event: string, callback: () => void) => {
        ipcRenderer.on(event, callback);
        return () => ipcRenderer.removeListener(event, callback);
    },

    // AI Viewfinder - 화면 공유
    viewfinder: {
        // Webview 캡처 (webContentsId 필요)
        captureWebview: (webContentsId: number, rect?: { x: number; y: number; width: number; height: number }) =>
            ipcRenderer.invoke('viewfinder:capture-webview', webContentsId, rect),

        // 메인 윈도우 캡처
        captureWindow: (rect?: { x: number; y: number; width: number; height: number }) =>
            ipcRenderer.invoke('viewfinder:capture-window', rect),
    },

    // Terminal (PTY) - VS Code style
    terminal: {
        create: (id: string, cwd?: string) => ipcRenderer.invoke('terminal:create', id, cwd),
        write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
        resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
        kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
        onData: (callback: (id: string, data: string) => void) => {
            const handler = (_: any, id: string, data: string) => callback(id, data);
            ipcRenderer.on('terminal:data', handler);
            return () => ipcRenderer.removeListener('terminal:data', handler);
        },
        onExit: (callback: (id: string, exitCode: number, signal?: number) => void) => {
            const handler = (_: any, id: string, exitCode: number, signal?: number) => callback(id, exitCode, signal);
            ipcRenderer.on('terminal:exit', handler);
            return () => ipcRenderer.removeListener('terminal:exit', handler);
        },
    },
});
