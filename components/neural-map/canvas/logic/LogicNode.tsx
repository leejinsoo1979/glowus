import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
// 🔥 react-icons 완전 제거 - lucide-react로 통일 (번들 사이즈 대폭 절약)
import {
    Folder,
    GitBranch,
    FileText,
    FileCode,
    FileJson,
    FileImage,
    FileVideo,
    FileArchive,
} from 'lucide-react'

// 🔥 react-icons → lucide-react 별칭 (기존 코드 호환성)
const BsFiletypePdf = FileText
const BsFiletypeJsx = FileCode
const BsFiletypeTsx = FileCode
const BsFiletypeJs = FileCode
const BsFiletypeHtml = FileCode
const BsFiletypeCss = FileCode
const BsFiletypeScss = FileCode
const BsFiletypeJson = FileJson
const BsFiletypeMd = FileText
const BsFiletypePy = FileCode
const BsFiletypeJava = FileCode
const BsFiletypeRb = FileCode
const BsFiletypePhp = FileCode
const BsFiletypeXml = FileJson
const BsFiletypeYml = FileJson
const BsFiletypeSql = FileCode
const BsFileEarmarkCode = FileCode
const BsFileEarmarkText = FileText
const BsFileEarmarkImage = FileImage
const BsFileEarmarkPlay = FileVideo
const BsFileEarmarkZip = FileArchive
import { cn } from '@/lib/utils'

export interface LogicNodeData {
    label: string
    type: string
    isExpanded?: boolean
    hasChildren?: boolean
    onToggle?: (id: string) => void
}

function getIcon(type: string, name: string) {
    if (type === 'project') return GitBranch
    if (type === 'folder') return Folder

    const ext = name.split('.').pop()?.toLowerCase() || ''

    switch (ext) {
        case 'pdf': return BsFiletypePdf
        case 'tsx': return BsFiletypeTsx
        case 'ts': return BsFileEarmarkCode
        case 'jsx': return BsFiletypeJsx
        case 'js': return BsFiletypeJs
        case 'html': return BsFiletypeHtml
        case 'css': return BsFiletypeCss
        case 'scss': return BsFiletypeScss
        case 'json': return BsFiletypeJson
        case 'md': return BsFiletypeMd
        case 'py': return BsFiletypePy
        case 'java': return BsFiletypeJava
        case 'go': return BsFileEarmarkCode
        case 'rb': return BsFiletypeRb
        case 'php': return BsFiletypePhp
        case 'xml': return BsFiletypeXml
        case 'yaml': case 'yml': return BsFiletypeYml
        case 'sql': return BsFiletypeSql
        case 'zip': case 'rar': case '7z': return BsFileEarmarkZip
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return BsFileEarmarkImage
        case 'mp4': case 'webm': case 'mov': return BsFileEarmarkPlay
        case 'txt': return BsFileEarmarkText
        default:
            if (type === 'config') return BsFiletypeJson
            if (type === 'doc') return BsFileEarmarkText
            return BsFileEarmarkCode
    }
}

const getNodeStyles = (type: string, name: string, isDark: boolean) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''

    // Default Style
    let style = isDark
        ? { bg: 'bg-zinc-800', border: 'border-zinc-700', text: 'text-zinc-300', icon: 'text-zinc-400' }
        : { bg: 'bg-white', border: 'border-zinc-200', text: 'text-zinc-700', icon: 'text-zinc-500' }

    if (type === 'folder') {
        style = isDark
            ? { bg: 'bg-emerald-950/30', border: 'border-emerald-800/50', text: 'text-emerald-200', icon: 'text-emerald-400' }
            : { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'text-emerald-600' }
    } else if (type === 'project') {
        style = isDark
            ? { bg: 'bg-blue-950/30', border: 'border-blue-800/50', text: 'text-blue-200', icon: 'text-blue-400' }
            : { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' }
    } else {
        switch (ext) {
            case 'tsx':
            case 'ts':
            case 'jsx':
            case 'js':
                style = isDark
                    ? { bg: 'bg-blue-950/20', border: 'border-blue-800/30', text: 'text-slate-200', icon: 'text-blue-400' }
                    : { bg: 'bg-slate-50', border: 'border-blue-200', text: 'text-slate-700', icon: 'text-blue-500' }
                break
            case 'css':
            case 'scss':
                style = isDark
                    ? { bg: 'bg-pink-950/20', border: 'border-pink-800/30', text: 'text-pink-100', icon: 'text-pink-400' }
                    : { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', icon: 'text-pink-500' }
                break
            case 'json':
            case 'yml':
            case 'yaml':
            case 'config':
                style = isDark
                    ? { bg: 'bg-amber-950/20', border: 'border-amber-800/30', text: 'text-amber-100', icon: 'text-amber-400' }
                    : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-500' }
                break
            case 'md':
            case 'txt':
                style = isDark
                    ? { bg: 'bg-violet-950/20', border: 'border-violet-800/30', text: 'text-violet-100', icon: 'text-violet-400' }
                    : { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', icon: 'text-violet-500' }
                break
            case 'png':
            case 'jpg':
            case 'svg':
                style = isDark
                    ? { bg: 'bg-rose-950/20', border: 'border-rose-800/30', text: 'text-rose-100', icon: 'text-rose-400' }
                    : { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', icon: 'text-rose-500' }
                break
        }
    }
    return style
}

const LogicNode = ({ id, data, selected }: NodeProps<LogicNodeData>) => {
    const Icon = getIcon(data.type, data.label)
    // We need to use a hook to get the dark mode correctly if classList check isn't reactive enough, 
    // but typically explicit generic approach is safer. 
    // Ideally useNeuralMapStore or next-themes should be passed down or used here.
    // For now we assume 'dark' class is on html.
    // To make it reactive without hooks we can use context or just rely on CSS variables, 
    // but for specific color tokens via JS, we'll use a simple check or CSS classes.
    // Actually, using Tailwind classes (bg-..., text-...) handles dark mode automatically via `dark:` prefix!
    // So we don't need `isDark` variable logic inside JS if we map to Tailwind classes.
    // Let's refactor `getNodeStyles` to return string of classes using `dark:` prefix.

    // RE-REFACTOR: returning Tailwind classes directly
    const ext = data.label.split('.').pop()?.toLowerCase() || ''

    let colorClasses = "bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
    let iconColor = "text-zinc-500 dark:text-zinc-400"

    if (data.type === 'folder') {
        colorClasses = "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-200"
        iconColor = "text-emerald-600 dark:text-emerald-400"
    } else if (data.type === 'project') {
        colorClasses = "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-200"
        iconColor = "text-blue-600 dark:text-blue-400"
    } else {
        switch (ext) {
            case 'tsx':
            case 'ts':
            case 'jsx':
            case 'js':
                colorClasses = "bg-slate-50 border-blue-200 text-slate-700 dark:bg-blue-950/20 dark:border-blue-800/30 dark:text-slate-200"
                iconColor = "text-blue-500 dark:text-blue-400"
                break
            case 'css':
            case 'scss':
                colorClasses = "bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-950/20 dark:border-pink-800/30 dark:text-pink-100"
                iconColor = "text-pink-500 dark:text-pink-400"
                break
            case 'json':
            case 'yml':
            case 'yaml':
            case 'config':
                colorClasses = "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-100"
                iconColor = "text-amber-500 dark:text-amber-400"
                break
            case 'md':
            case 'txt':
                colorClasses = "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-950/20 dark:border-violet-800/30 dark:text-violet-100"
                iconColor = "text-violet-500 dark:text-violet-400"
                break
            case 'png':
            case 'jpg':
            case 'svg':
                colorClasses = "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800/30 dark:text-rose-100"
                iconColor = "text-rose-500 dark:text-rose-400"
                break
        }
    }

    return (
        <div
            className={cn(
                'min-w-[180px] h-[44px] rounded-lg border shadow-sm transition-all flex items-center px-3 gap-2',
                colorClasses,
                selected && 'ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-zinc-900',
                // Add subtle glow or stronger border for better visibility
                'border-[1.5px]'
            )}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-2 !h-2 !bg-zinc-300 dark:!bg-zinc-600"
            />

            <div className={cn("flex-shrink-0", iconColor)}>
                <Icon size={18} />
            </div>

            <div className="flex-1 truncate text-sm font-medium">
                {data.label}
            </div>

            {/* Toggle Button for Folders/Parents */}
            {data.hasChildren && (
                <button
                    className={cn(
                        "w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors",
                        "hover:bg-black/5 dark:hover:bg-white/10", // generic hover
                        data.isExpanded ? "opacity-50" : "bg-black/5 dark:bg-white/10"
                    )}
                    onClick={(e) => {
                        e.stopPropagation()
                        data.onToggle?.(id)
                    }}
                >
                    {data.isExpanded ? '-' : '+'}
                </button>
            )}

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-2 !h-2 !bg-zinc-300 dark:!bg-zinc-600"
            />
        </div>
    )
}

export default memo(LogicNode)
