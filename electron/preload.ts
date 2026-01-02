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
        readFileAsBase64: (path: string) => ipcRenderer.invoke('fs:read-file-as-base64', path),
        writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
        fileStats: (dirPath: string) => ipcRenderer.invoke('fs:file-stats', dirPath),
        scanApiRoutes: (dirPath: string) => ipcRenderer.invoke('fs:scan-api-routes', dirPath),
        scanTypes: (dirPath: string, options?: { extensions?: string[] }) => ipcRenderer.invoke('fs:scan-types', dirPath, options),
        scanSchema: (dirPath: string) => ipcRenderer.invoke('fs:scan-schema', dirPath),
        // Check if folder is empty (for project scaffolding)
        isEmpty: (dirPath: string) => ipcRenderer.invoke('fs:is-empty', dirPath),

        // Create directory
        mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),

        // Delete file
        deleteFile: (filePath: string) => ipcRenderer.invoke('fs:delete-file', filePath),

        // Read directory (alias for readDirectory)
        readDir: (dirPath: string) => ipcRenderer.invoke('fs:read-directory', dirPath, {}),

        // Listen for file system changes (from agent or external)
        onChanged: (callback: (data: { path: string; type: 'create' | 'change' | 'delete' }) => void) => {
            const handler = (_: any, data: any) => callback(data);
            ipcRenderer.on('fs:changed', handler);
            return () => ipcRenderer.removeListener('fs:changed', handler);
        },

        // File system watcher (chokidar) - 외부 파일 변경 감지
        watchStart: (dirPath: string) => ipcRenderer.invoke('fs:watch-start', dirPath),
        watchStop: () => ipcRenderer.invoke('fs:watch-stop'),

        // Copy file
        copyFile: (src: string, dest: string) => ipcRenderer.invoke('fs:copy-file', src, dest),

        // Rename/move file or folder
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    },

    // Shell operations
    shell: {
        // Show item in Finder/Explorer
        showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),

        // Move item to trash
        trashItem: (path: string) => ipcRenderer.invoke('shell:trash-item', path),

        // Open path with default application
        openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
    },

    // Project scaffolding (Cursor/Antigravity style)
    project: {
        scaffold: (params: {
            dirPath: string;
            template: string;
            options?: { typescript?: boolean; tailwind?: boolean; eslint?: boolean };
        }) => ipcRenderer.invoke('project:scaffold', params),

        // Listen for scaffolding complete
        onScaffolded: (callback: (data: {
            template: string;
            projectName: string;
            path: string;
            results?: string[];
        }) => void) => {
            const handler = (_: any, data: any) => callback(data);
            ipcRenderer.on('project:scaffolded', handler);
            return () => ipcRenderer.removeListener('project:scaffolded', handler);
        },

        // Create project workspace folder (로컬 폴더 생성)
        createWorkspace: (projectName: string, customPath?: string) =>
            ipcRenderer.invoke('fs:create-project-workspace', projectName, customPath),

        // Get workspace root path
        getWorkspaceRoot: () => ipcRenderer.invoke('fs:get-workspace-root'),
    },

    // Git operations
    git: {
        // Existing
        log: (dirPath: string, options?: { maxCommits?: number }) => ipcRenderer.invoke('git:log', dirPath, options),
        branches: (dirPath: string) => ipcRenderer.invoke('git:branches', dirPath),
        // New operations for GitHub integration
        clone: (url: string, targetPath: string) => ipcRenderer.invoke('git:clone', url, targetPath),
        status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
        diff: (cwd: string, staged?: boolean) => ipcRenderer.invoke('git:diff', cwd, staged),
        add: (cwd: string, files: string | string[]) => ipcRenderer.invoke('git:add', cwd, files),
        commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
        push: (cwd: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', cwd, remote, branch),
        pull: (cwd: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:pull', cwd, remote, branch),
        init: (cwd: string) => ipcRenderer.invoke('git:init', cwd),
        remoteAdd: (cwd: string, name: string, url: string) => ipcRenderer.invoke('git:remote-add', cwd, name, url),
        remoteList: (cwd: string) => ipcRenderer.invoke('git:remote-list', cwd),
        config: (cwd: string, key: string, value: string) => ipcRenderer.invoke('git:config', cwd, key, value),
        fetch: (cwd: string, remote?: string) => ipcRenderer.invoke('git:fetch', cwd, remote),
        stash: (cwd: string, action?: 'push' | 'pop' | 'list') => ipcRenderer.invoke('git:stash', cwd, action),
        isRepo: (cwd: string) => ipcRenderer.invoke('git:is-repo', cwd),
        currentBranch: (cwd: string) => ipcRenderer.invoke('git:current-branch', cwd),
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

    // Project Preview - HTML 파일 팝업 미리보기
    projectPreview: {
        open: (filePath: string, title?: string) => ipcRenderer.invoke('project:preview', filePath, title),
    },

    // Project Runner - 프로젝트 실행
    projectRunner: {
        run: (id: string, cwd: string, command: string) => ipcRenderer.invoke('project:run', id, cwd, command),
        stop: (id: string) => ipcRenderer.invoke('project:stop', id),
        status: (id: string) => ipcRenderer.invoke('project:status', id),
        onOutput: (callback: (id: string, data: string) => void) => {
            const handler = (_: any, id: string, data: string) => callback(id, data);
            ipcRenderer.on('project:output', handler);
            return () => ipcRenderer.removeListener('project:output', handler);
        },
        onExit: (callback: (id: string, exitCode: number) => void) => {
            const handler = (_: any, id: string, exitCode: number) => callback(id, exitCode);
            ipcRenderer.on('project:exit', handler);
            return () => ipcRenderer.removeListener('project:exit', handler);
        },
        onError: (callback: (id: string, error: string) => void) => {
            const handler = (_: any, id: string, error: string) => callback(id, error);
            ipcRenderer.on('project:error', handler);
            return () => ipcRenderer.removeListener('project:error', handler);
        },
    },

    // AI Agent - Electron 메인 프로세스에서 직접 실행 (Cursor 스타일)
    agent: {
        execute: (params: {
            messages: Array<{ role: string; content: string }>;
            model: string;
            context: {
                files: Array<{ id: string; name: string; path?: string; content?: string; type: string }>;
                projectPath?: string;
            };
        }) => ipcRenderer.invoke('agent:execute', params),

        // Agent 설계 이벤트 리스너
        onDesign: (callback: (data: {
            type: 'flowchart' | 'schema' | 'logic';
            title: string;
            mermaidCode?: string;
            schema?: string;
            pseudocode?: string;
            functions?: string[];
            filePath: string;
        }) => void) => {
            const handler = (_: any, data: any) => callback(data);
            ipcRenderer.on('agent:design', handler);
            return () => ipcRenderer.removeListener('agent:design', handler);
        },

        // Agent 탭 전환 이벤트 리스너
        onSwitchTab: (callback: (data: { tab: string }) => void) => {
            const handler = (_: any, data: any) => callback(data);
            ipcRenderer.on('agent:switch-tab', handler);
            return () => ipcRenderer.removeListener('agent:switch-tab', handler);
        },
    },

    // 🌐 AI Browser Control - 앱 내 웹뷰를 AI가 제어
    aiBrowser: {
        // 웹뷰 등록 (BrowserView 컴포넌트에서 호출)
        register: (webContentsId: number) => ipcRenderer.invoke('ai-browser:register', webContentsId),

        // 웹뷰 해제
        unregister: () => ipcRenderer.invoke('ai-browser:unregister'),

        // 현재 URL 가져오기
        getUrl: () => ipcRenderer.invoke('ai-browser:get-url'),

        // URL로 이동
        navigate: (url: string) => ipcRenderer.invoke('ai-browser:navigate', url),

        // JavaScript 실행
        execute: (script: string) => ipcRenderer.invoke('ai-browser:execute', script),

        // 스크린샷 캡처
        screenshot: () => ipcRenderer.invoke('ai-browser:screenshot'),

        // 클릭 가능한 요소 추출
        getElements: () => ipcRenderer.invoke('ai-browser:get-elements'),

        // AI Agent Loop 실행 (자연어 태스크 → 자동 실행)
        runAgent: (task: string, maxSteps?: number) =>
            ipcRenderer.invoke('ai-browser:agent', task, maxSteps || 10),

        // 브라우저 패널 열기 이벤트 수신 (main → renderer)
        onOpenPanel: (callback: () => void) => {
            const handler = () => callback();
            ipcRenderer.on('ai-browser:open-panel', handler);
            return () => ipcRenderer.removeListener('ai-browser:open-panel', handler);
        },
    },
});

// Electron 앱 표시 - DOM 로드 후 클래스 추가
window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('electron-app');
});
