'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Paperclip,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  ImageIcon,
  ChevronDown,
  Loader2,
  X,
  FileText,
  File,
  FileImage,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailAccount } from '@/types/email'

interface AttachedFile {
  id: string
  file: File
  name: string
  size: number
  type: string
}

interface EmailSignature {
  id: string
  name: string
  content: string
  isDefault: boolean
}

interface EmailComposeProps {
  account: EmailAccount | null
  onBack: () => void
  onSend: (data: {
    to: string
    cc?: string
    subject: string
    body: string
    bodyHtml: string
    attachments?: AttachedFile[]
  }) => Promise<void>
  isSending: boolean
  replyTo?: {
    to: string
    subject: string
    body: string
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return FileImage
  if (type === 'application/pdf') return FileText
  if (type.includes('document') || type.includes('text')) return FileText
  return File
}

export function EmailCompose({
  account,
  onBack,
  onSend,
  isSending,
  replyTo,
}: EmailComposeProps) {
  const { accentColor } = useThemeStore()
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [to, setTo] = useState(replyTo?.to || '')
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(replyTo?.subject || '')

  // Attachments
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0)

  // Signature
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [showSignatureMenu, setShowSignatureMenu] = useState(false)

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', light: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/30' }
      case 'blue': return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' }
      case 'green': return { bg: 'bg-green-500', hover: 'hover:bg-green-600', light: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-500/30' }
      case 'orange': return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', light: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/30' }
      case 'pink': return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', light: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-500/30' }
      case 'red': return { bg: 'bg-red-500', hover: 'hover:bg-red-600', light: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-500/30' }
      case 'yellow': return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-500/30' }
      case 'cyan': return { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-500/30' }
      default: return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' }
    }
  }

  const accent = getAccentClasses()

  // Load signatures
  useEffect(() => {
    const saved = localStorage.getItem('emailSignatures')
    if (saved) setSignatures(JSON.parse(saved))
  }, [])

  // Apply replyTo body content
  useEffect(() => {
    if (replyTo?.body && editorRef.current) {
      // AI 답장 내용으로 에디터 채우기
      const defaultSig = signatures.find(s => s.isDefault)
      const sigHtml = defaultSig ? `<br><br><div class="email-signature">${defaultSig.content}</div>` : ''
      editorRef.current.innerHTML = replyTo.body.replace(/\n/g, '<br>') + sigHtml
    }
  }, [replyTo, signatures])

  // Apply default signature only if no replyTo
  useEffect(() => {
    if (replyTo?.body) return // 이미 replyTo로 채워진 경우 스킵
    const defaultSig = signatures.find(s => s.isDefault)
    if (defaultSig && editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = `<br><br><div class="email-signature">${defaultSig.content}</div>`
    }
  }, [signatures, replyTo])

  // File handling
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const newAttachments: AttachedFile[] = fileArray.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    setAttachments(prev => [...prev, ...newAttachments])
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(f => f.id !== id))
  }

  // Drag & Drop
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
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  // Editor commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  // Insert signature
  const insertSignature = (sig: EmailSignature) => {
    if (!editorRef.current) return
    const existingSig = editorRef.current.querySelector('.email-signature')
    if (existingSig) existingSig.remove()

    const sigDiv = document.createElement('div')
    sigDiv.className = 'email-signature'
    sigDiv.innerHTML = sig.content
    editorRef.current.appendChild(document.createElement('br'))
    editorRef.current.appendChild(sigDiv)
    setShowSignatureMenu(false)
  }

  // Send
  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      alert('받는 사람과 제목을 입력해주세요.')
      return
    }

    await onSend({
      to,
      cc: showCc ? cc : undefined,
      subject,
      body: editorRef.current?.innerText || '',
      bodyHtml: editorRef.current?.innerHTML || '',
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  return (
    <div
      className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl px-8 py-6 shadow-xl">
            <Paperclip className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-zinc-900 dark:text-white">파일을 여기에 놓으세요</p>
          </div>
        </div>
      )}

      {/* Form Area */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        {/* To */}
        <div className="flex items-center px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-700/50">
          <span className="w-16 text-sm text-zinc-500 flex-shrink-0">받는사람</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="이메일 주소"
            className="flex-1 bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm focus:outline-none"
          />
          <button
            onClick={() => setShowCc(!showCc)}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              showCc ? cn(accent.light, accent.text) : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            참조
          </button>
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex items-center px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-700/50">
            <span className="w-16 text-sm text-zinc-500 flex-shrink-0">참조</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="참조할 이메일 주소"
              className="flex-1 bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm focus:outline-none"
            />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center px-4 py-2.5">
          <span className="w-16 text-sm text-zinc-500 flex-shrink-0">제목</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="메일 제목"
            className="flex-1 bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm focus:outline-none font-medium"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        {/* Attachment */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn("p-2 rounded-lg transition-colors", accent.text, "hover:bg-zinc-100 dark:hover:bg-zinc-700")}
          title="파일 첨부"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Text Formatting */}
        <button onClick={() => execCommand('bold')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="굵게">
          <Bold className="w-4 h-4 text-zinc-500" />
        </button>
        <button onClick={() => execCommand('italic')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="기울임">
          <Italic className="w-4 h-4 text-zinc-500" />
        </button>
        <button onClick={() => execCommand('underline')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="밑줄">
          <Underline className="w-4 h-4 text-zinc-500" />
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Alignment */}
        <button onClick={() => execCommand('justifyLeft')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="왼쪽 정렬">
          <AlignLeft className="w-4 h-4 text-zinc-500" />
        </button>
        <button onClick={() => execCommand('justifyCenter')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="가운데 정렬">
          <AlignCenter className="w-4 h-4 text-zinc-500" />
        </button>
        <button onClick={() => execCommand('justifyRight')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="오른쪽 정렬">
          <AlignRight className="w-4 h-4 text-zinc-500" />
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Lists */}
        <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="글머리 기호">
          <List className="w-4 h-4 text-zinc-500" />
        </button>
        <button onClick={() => execCommand('insertOrderedList')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="번호 매기기">
          <ListOrdered className="w-4 h-4 text-zinc-500" />
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Insert */}
        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="링크">
          <Link2 className="w-4 h-4 text-zinc-500" />
        </button>
        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg" title="이미지">
          <ImageIcon className="w-4 h-4 text-zinc-500" />
        </button>

        <div className="flex-1" />

        {/* Signature */}
        <div className="relative">
          <button
            onClick={() => setShowSignatureMenu(!showSignatureMenu)}
            className="px-3 py-1.5 text-xs rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-1"
          >
            서명
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSignatureMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 py-1">
              {signatures.length === 0 ? (
                <p className="text-xs text-zinc-400 px-3 py-2">서명 없음</p>
              ) : (
                signatures.map(sig => (
                  <button
                    key={sig.id}
                    onClick={() => insertSignature(sig)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    {sig.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="w-4 h-4 text-zinc-400" />
            <span className="text-xs text-zinc-500">
              첨부파일 {attachments.length}개 ({formatFileSize(totalSize)})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map(file => {
              const FileIcon = getFileIcon(file.type)
              return (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                    accent.light, accent.border
                  )}
                >
                  <FileIcon className={cn("w-4 h-4", accent.text)} />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 max-w-[150px] truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded"
                  >
                    <X className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
        <div
          ref={editorRef}
          contentEditable
          className="min-h-full p-4 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
        <div className="text-xs text-zinc-400">
          {account?.email_address || '발신자 없음'}
        </div>
        <button
          onClick={handleSend}
          disabled={isSending || !to.trim() || !subject.trim()}
          className={cn(
            "px-5 py-2 rounded-xl font-medium text-white transition-all flex items-center gap-2 text-sm",
            accent.bg, accent.hover,
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          보내기
        </button>
      </div>
    </div>
  )
}
