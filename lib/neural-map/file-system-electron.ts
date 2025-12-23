import {
    IFileSystemProvider,
    FileSystemDirectoryHandle,
    ReadDirectoryOptions,
    DirectoryContent,
    FileSystemFileHandle
} from '../../types/filesystem'

// Batch scan result type (matches electron/main.ts)
export interface ScanResult {
    path: string;
    relativePath: string;
    name: string;
    kind: 'file' | 'directory';
    size?: number;
    lastModified?: number;
    content?: string;
    children?: ScanResult[];
    childCount?: number;
}

export interface ScanTreeResult {
    tree: ScanResult;
    stats: {
        fileCount: number;
        dirCount: number;
        elapsed: number;
    };
}

export class ElectronFileSystemProvider implements IFileSystemProvider {

    private projectHandle: FileSystemDirectoryHandle | null = null;
    private fileHandleRegistry = new Map<string, any>();

    async selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
        // @ts-ignore
        const result = await window.electron.fs.selectDirectory();
        if (!result) return null;
        return result as FileSystemDirectoryHandle;
    }

    getProjectHandle(): FileSystemDirectoryHandle | null {
        return this.projectHandle;
    }

    setProjectHandle(handle: FileSystemDirectoryHandle): void {
        this.projectHandle = handle;
    }

    registerFileHandle(fileId: string, handle: FileSystemFileHandle): void {
        this.fileHandleRegistry.set(fileId, handle);
    }

    async writeFile(fileId: string, content: string): Promise<boolean> {
        const path = this.fileHandleRegistry.get(fileId);
        if (!path) throw new Error(`File path not found for ID: ${fileId}`);

        // @ts-ignore
        await window.electron.fs.writeFile(path, content);
        return true;
    }

    /**
     * Batch scan entire directory tree in a single IPC call
     * Much faster than recursive readDirectory calls
     */
    async scanTree(
        dirHandle: FileSystemDirectoryHandle,
        options: {
            includeSystemFiles?: boolean;
            maxDepth?: number;
            includeContent?: boolean;
            contentExtensions?: string[];
        } = {}
    ): Promise<ScanTreeResult> {
        // @ts-ignore
        const result = await window.electron.fs.scanTree((dirHandle as any).path, {
            includeSystemFiles: options.includeSystemFiles ?? false,
            maxDepth: options.maxDepth ?? Infinity,
            includeContent: options.includeContent ?? true,
            contentExtensions: options.contentExtensions ?? ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html']
        });

        return result as ScanTreeResult;
    }

    /**
     * Convert scan tree to flat file list (for compatibility with existing code)
     */
    flattenTree(tree: ScanResult, projectName: string): File[] {
        const files: File[] = [];

        const traverse = (node: ScanResult) => {
            if (node.kind === 'file') {
                const fakeFile = {
                    name: node.name,
                    size: node.size || 0,
                    lastModified: node.lastModified || Date.now(),
                    type: '',
                    webkitRelativePath: node.relativePath,
                    path: node.relativePath, // Use relative path for graph building
                    content: node.content || '',

                    text: async () => {
                        if (node.content) return node.content;
                        // @ts-ignore
                        return await window.electron.fs.readFile(node.path);
                    },
                    arrayBuffer: async () => {
                        const content = node.content || await (fakeFile as any).text();
                        return new TextEncoder().encode(content).buffer;
                    },
                    slice: () => new Blob([])
                };

                files.push(fakeFile as unknown as File);

                // Register for write operations
                this.fileHandleRegistry.set(node.relativePath, node.path);
            }

            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };

        traverse(tree);
        return files;
    }

    /**
     * Legacy method - kept for backward compatibility
     * Use scanTree() for better performance
     */
    async readDirectory(
        dirHandle: FileSystemDirectoryHandle,
        path: string = '',
        options: ReadDirectoryOptions = {}
    ): Promise<DirectoryContent> {
        const allFiles: File[] = [];
        const allHandles = new Map<string, FileSystemFileHandle>();

        const scan = async (currentHandle: any, relativePath: string = '') => {
            // @ts-ignore
            const result: any[] = await window.electron.fs.readDirectory(currentHandle.path, options);

            for (const entry of result) {
                const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    const fakeFile = {
                        name: entry.name,
                        size: entry.size,
                        lastModified: entry.lastModified,
                        type: '',
                        webkitRelativePath: entryRelativePath,
                        path: entry.path,

                        text: async () => {
                            // @ts-ignore
                            return await window.electron.fs.readFile(entry.path);
                        },
                        arrayBuffer: async () => {
                            // @ts-ignore
                            const content = await window.electron.fs.readFile(entry.path);
                            return new TextEncoder().encode(content).buffer;
                        },
                        slice: () => new Blob([])
                    };

                    allFiles.push(fakeFile as unknown as File);
                    allHandles.set(entryRelativePath, entry.path as any);

                } else if (entry.kind === 'directory') {
                    const subHandle = {
                        kind: 'directory',
                        name: entry.name,
                        path: entry.path
                    };
                    await scan(subHandle, entryRelativePath);
                }
            }
        };

        await scan(dirHandle, path);
        return { files: allFiles, handles: allHandles };
    }
}
