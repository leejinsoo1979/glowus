import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Generic IPC invoke for any channel
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

    // File system operations
    fs: {
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
    },

    // DevTools helper
    openWebviewDevTools: (id?: number) => ipcRenderer.invoke('app:open-webview-devtools', id),

    // Menu event listeners
    onMenuEvent: (event: string, callback: () => void) => {
        ipcRenderer.on(event, callback);
        return () => ipcRenderer.removeListener(event, callback);
    },
});
