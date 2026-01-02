"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload,
  File,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  Trash2,
  Download,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Cloud,
  CloudOff,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useProjectFileSync } from "@/lib/hooks/useProjectFileSync"
import type { NeuralFile } from "@/lib/neural-map/types"

interface WebFileManagerProps {
  projectId: string
  projectName: string
}

const fileTypeIcons: Record<string, typeof File> = {
  code: FileCode,
  text: FileText,
  markdown: FileText,
  image: FileImage,
  video: FileVideo,
  pdf: FileText,
  binary: File,
}

export function WebFileManager({ projectId, projectName }: WebFileManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    files,
    refresh,
    uploadFile,
    deleteFile,
    isLoading,
    error,
    environment,
  } = useProjectFileSync({
    projectId,
    projectName,
    enabled: true,
    debounceMs: 300,
  })

  // 파일 업로드 핸들러 - hooks는 조건부 리턴 전에 선언해야 함
  const handleFileUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      await uploadFile(file)
    }
  }, [uploadFile])

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  // 파일 삭제 핸들러
  const handleDelete = useCallback(async (file: NeuralFile) => {
    if (!file.path) return
    if (window.confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) {
      await deleteFile(file.path)
    }
  }, [deleteFile])

  // 파일 다운로드
  const handleDownload = useCallback((file: NeuralFile) => {
    if (!file.url) return
    window.open(file.url, '_blank')
  }, [])

  // Electron 환경에서는 렌더링하지 않음 - 모든 hooks 선언 후에 조건부 리턴
  if (environment === 'electron' || environment === 'unknown') {
    return null
  }

  const FileIcon = (type: string) => {
    const Icon = fileTypeIcons[type] || File
    return Icon
  }

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${files.length > 0 ? "bg-blue-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
          <Cloud className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">클라우드 파일</span>
          <span className="text-xs text-zinc-500">({files.length}개)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
          >
            <Upload className="w-3 h-3 mr-1.5" />
            업로드
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              refresh()
            }}
            className="h-7 px-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Drop Zone */}
            <div
              className={`mx-4 mb-3 border-2 border-dashed rounded-lg transition-colors ${isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="py-6 text-center">
                <FolderOpen className={`w-8 h-8 mx-auto mb-2 ${isDragging ? "text-blue-500 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500"}`} />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {isDragging ? "파일을 놓으세요" : "파일을 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-1">
                  코드, 이미지, 문서 등 모든 파일 지원
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mb-3 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* File List */}
            <div className="border-t border-zinc-200 dark:border-zinc-800/50">
              <div className="max-h-64 overflow-y-auto">
                {isLoading && files.length === 0 ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto text-zinc-400 animate-spin" />
                    <p className="text-xs text-zinc-500 mt-2">파일 로딩 중...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-8 text-center">
                    <CloudOff className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">아직 업로드된 파일이 없습니다</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">위의 드롭존에 파일을 업로드하세요</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                    {files.map((file) => {
                      const Icon = FileIcon(file.type)
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${file.type === 'code' ? 'text-emerald-500 dark:text-emerald-400' :
                              file.type === 'image' ? 'text-purple-500 dark:text-purple-400' :
                                file.type === 'video' ? 'text-pink-500 dark:text-pink-400' :
                                  file.type === 'markdown' ? 'text-blue-500 dark:text-blue-400' :
                                    'text-zinc-400'
                              }`} />
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-900 dark:text-zinc-200 truncate">{file.name}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-600">
                                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                                {file.createdAt && ` • ${new Date(file.createdAt).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {file.url && (
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                title="다운로드"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(file)}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Stats */}
            {files.length > 0 && (
              <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    총 {files.length}개 파일
                  </span>
                  <span>
                    Supabase Storage
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
