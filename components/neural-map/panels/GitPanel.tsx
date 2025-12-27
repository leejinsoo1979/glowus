'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Plus,
  Minus,
  File,
  RefreshCw,
  Upload,
  Download,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  User,
  ExternalLink,
  Github,
  Link2,
  FolderGit,
  X,
  Lock,
  Globe,
} from 'lucide-react'
import { useNeuralMapStore } from '@/lib/neural-map/store'

interface GitStatus {
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

interface GitCommitInfo {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
}

export default function GitPanel() {
  // linkedProjectId = 사용자가 선택한 프로젝트 ID
  // projectPath는 linkedProjectId가 있을 때만 사용해야 함
  const { projectPath, linkedProjectId, linkedProjectName } = useNeuralMapStore()
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [projectGitPath, setProjectGitPath] = useState<string | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [status, setStatus] = useState<GitStatus>({ staged: [], unstaged: [], untracked: [] })
  const [commits, setCommits] = useState<GitCommitInfo[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false)
  const [hasRemote, setHasRemote] = useState(false)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [gitHubUsername, setGitHubUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    staged: true,
    unstaged: true,
    untracked: true,
    history: false,
  })
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // GitHub 레포 생성 모달 상태
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false)
  const [repoName, setRepoName] = useState('')
  const [repoDescription, setRepoDescription] = useState('')
  const [isRepoPrivate, setIsRepoPrivate] = useState(true)
  const [isCreatingRepo, setIsCreatingRepo] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  // Check if the path looks like a dangerous directory (home, Documents, Desktop, etc.)
  const isDangerousPath = (path: string): boolean => {
    const dangerousPatterns = [
      /^\/Users\/[^/]+\/?$/i,           // User home directory
      /^\/Users\/[^/]+\/Documents\/?$/i, // Documents folder
      /^\/Users\/[^/]+\/Desktop\/?$/i,   // Desktop folder
      /^\/Users\/[^/]+\/Downloads\/?$/i, // Downloads folder (단, GlowUS 앱 제외)
      /^~\/?$/i,                          // Home shorthand
      /^\/home\/[^/]+\/?$/i,             // Linux home
      /^C:\\Users\\[^\\]+\\?$/i,         // Windows home
    ]
    // GlowUS 앱 폴더 자체도 차단 (사용자 프로젝트만 허용)
    if (path.includes('GlowUS') && !linkedProjectId) {
      return true
    }
    return dangerousPatterns.some(pattern => pattern.test(path))
  }

  // 프로젝트의 실제 Git 경로 가져오기
  const fetchProjectGitPath = useCallback(async () => {
    // 1. linkedProjectId가 있으면 DB에서 folder_path 조회
    if (linkedProjectId) {
      try {
        const response = await fetch(`/api/projects/${linkedProjectId}`)
        if (response.ok) {
          const project = await response.json()
          const folderPath = project.folder_path

          if (folderPath) {
            setProjectGitPath(folderPath)
            console.log('[GitPanel] Using project folder_path:', folderPath)
            return
          }
        }
      } catch (err) {
        console.error('[GitPanel] Failed to fetch project:', err)
      }
    }

    // 2. linkedProjectId 없어도 projectPath가 있으면 직접 사용
    if (projectPath) {
      setProjectGitPath(projectPath)
      console.log('[GitPanel] Using direct projectPath:', projectPath)
      return
    }

    // 둘 다 없으면 비활성화
    setProjectGitPath(null)
    setIsGitRepo(false)
    setIsLoading(false)
  }, [linkedProjectId, projectPath])

  // linkedProjectId 변경 시 프로젝트 정보 가져오기
  useEffect(() => {
    fetchProjectGitPath()
  }, [fetchProjectGitPath])

  const checkGitRepo = useCallback(async () => {
    // projectGitPath가 없으면 대기 (linkedProjectId나 projectPath 둘 다 없는 경우)
    if (!projectGitPath || !window.electron?.git) {
      setIsGitRepo(false)
      setIsLoading(false)
      if (!linkedProjectId && !projectPath) {
        setError('프로젝트를 먼저 선택하세요.')
      }
      return
    }

    // Block dangerous paths
    if (isDangerousPath(projectGitPath)) {
      console.error('[GitPanel] Blocked dangerous path:', projectGitPath)
      setError('이 폴더에서는 Git을 사용할 수 없습니다.')
      setIsGitRepo(false)
      setIsLoading(false)
      return
    }

    try {
      const result = await window.electron.git.isRepo?.(projectGitPath)
      setIsGitRepo(result?.isRepo || false)

      if (result?.isRepo) {
        await refreshGitStatus()
      } else {
        setError('이 폴더는 Git 저장소가 아닙니다.')
      }
    } catch (err) {
      console.error('Failed to check git repo:', err)
      setIsGitRepo(false)
    } finally {
      setIsLoading(false)
    }
  }, [linkedProjectId, projectGitPath])

  useEffect(() => {
    checkGitRepo()
  }, [checkGitRepo])

  // Check GitHub connection status
  const checkGitHubConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/github')
      if (response.ok) {
        const data = await response.json()
        setIsGitHubConnected(data.connected)
        setGitHubUsername(data.connection?.github_username || null)
      }
    } catch (err) {
      console.error('[GitPanel] Failed to check GitHub connection:', err)
    }
  }, [])

  useEffect(() => {
    checkGitHubConnection()
  }, [checkGitHubConnection])

  // Check if remote origin exists
  const checkRemote = async () => {
    if (!projectGitPath || !window.electron?.git?.remoteList) return false

    try {
      const result = await window.electron.git.remoteList(projectGitPath)
      if (result?.success && result.output) {
        const hasOrigin = result.output.includes('origin')
        setHasRemote(hasOrigin)
        return hasOrigin
      }
    } catch (err) {
      console.error('[GitPanel] Failed to check remote:', err)
    }
    setHasRemote(false)
    return false
  }

  // Initialize git only (no GitHub)
  const handleInitGitOnly = async () => {
    if (!projectGitPath || !window.electron?.git?.init) return

    setIsInitializing(true)
    setError(null)

    try {
      const result = await window.electron.git.init(projectGitPath)
      if (result?.success) {
        await checkGitRepo()
      } else {
        setError(result?.error || 'Git 초기화 실패')
      }
    } catch (err) {
      console.error('[GitPanel] Failed to init git:', err)
      setError('Git 초기화 중 오류가 발생했습니다')
    } finally {
      setIsInitializing(false)
    }
  }

  // GitHub 연결 버튼 클릭 핸들러
  const handleConnectGitHub = async () => {
    if (!projectGitPath || !linkedProjectName) return

    // GitHub 계정이 연결되지 않았으면 OAuth로 이동
    if (!isGitHubConnected) {
      window.location.href = `/api/auth/github?returnUrl=/dashboard-group/neural-map`
      return
    }

    // GitHub 계정이 연결되어 있으면 레포 생성 모달 열기
    const defaultRepoName = linkedProjectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    setRepoName(defaultRepoName)
    setRepoDescription(`${linkedProjectName} - Created with GlowUS`)
    setIsRepoModalOpen(true)
  }

  // GitHub 레포지토리 생성 및 연결
  const handleCreateRepo = async () => {
    if (!projectGitPath || !repoName.trim()) return

    setIsCreatingRepo(true)
    setError(null)

    try {
      // 1. Git 초기화 (아직 안 되어 있으면)
      if (!isGitRepo && window.electron?.git?.init) {
        const initResult = await window.electron.git.init(projectGitPath)
        if (!initResult?.success) {
          throw new Error(initResult?.error || 'Git 초기화 실패')
        }
      }

      // 2. GitHub 레포지토리 생성
      const createResponse = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName.trim(),
          description: repoDescription.trim(),
          private: isRepoPrivate,
          auto_init: false,
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'GitHub 레포지토리 생성 실패')
      }

      const { repo } = await createResponse.json()

      // 3. Remote origin 추가
      if (window.electron?.git?.remoteAdd) {
        // 기존 origin이 있으면 제거
        try {
          const remotes = await window.electron.git.remoteList?.(projectGitPath)
          if (remotes?.output?.includes('origin')) {
            await window.electron.invoke?.('git:remote-remove', projectGitPath, 'origin')
          }
        } catch (e) {
          // 무시
        }
        await window.electron.git.remoteAdd(projectGitPath, 'origin', repo.clone_url)
      }

      // 4. Git config 설정 (GitHub 유저네임)
      if (window.electron?.git?.config && gitHubUsername) {
        await window.electron.git.config(projectGitPath, 'user.name', gitHubUsername)
      }

      // 5. 프로젝트 DB에 GitHub 정보 저장
      if (linkedProjectId) {
        await fetch(`/api/projects/${linkedProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            github_owner: repo.owner.login,
            github_repo: repo.name,
            github_clone_url: repo.clone_url,
            github_connected_at: new Date().toISOString(),
          }),
        })
      }

      // 6. 모달 닫고 상태 새로고침
      setIsRepoModalOpen(false)
      await checkGitRepo()
      await checkRemote()

      // 성공 메시지
      alert(`GitHub 레포지토리 '${repo.name}'가 생성되었습니다!`)

    } catch (err: any) {
      console.error('[GitPanel] Failed to create GitHub repo:', err)
      setError(err.message || 'GitHub 레포지토리 생성 중 오류가 발생했습니다')
    } finally {
      setIsCreatingRepo(false)
    }
  }

  const refreshGitStatus = async () => {
    // projectGitPath만 사용 (사용자 프로젝트의 실제 경로)
    if (!projectGitPath || !linkedProjectId || !window.electron?.git) return

    setIsRefreshing(true)
    setError(null)

    try {
      // Get current branch
      const branchResult = await window.electron.git.currentBranch?.(projectGitPath)
      if (branchResult?.success) {
        setCurrentBranch(branchResult.branch || 'main')
      }

      // Get status
      const statusResult = await window.electron.git.status?.(projectGitPath)
      if (statusResult?.success && statusResult.output) {
        const parsedStatus = parseGitStatus(statusResult.output)
        setStatus(parsedStatus)
      }

      // Get recent commits
      const logResult = await window.electron.git.log?.(projectGitPath, { maxCommits: 10 })
      if (logResult) {
        const parsedCommits = parseGitLog(logResult)
        setCommits(parsedCommits)
      }

      // Check remote
      await checkRemote()
    } catch (err) {
      console.error('Failed to refresh git status:', err)
      setError('Git 상태를 가져오는데 실패했습니다')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filter out sensitive files that should never be shown or committed
  const isSensitiveFile = (filename: string): boolean => {
    const sensitivePatterns = [
      /\.p12$/i,           // 공인인증서
      /\.pem$/i,           // SSL certificates
      /\.key$/i,           // Private keys
      /\.pfx$/i,           // Certificate files
      /\.cer$/i,           // Certificate files
      /\.crt$/i,           // Certificate files
      /credential/i,       // Credential files
      /secret/i,           // Secret files
      /password/i,         // Password files
      /\.env\.local$/i,    // Local env files
      /\.env\.production$/i,
      /BizBank/i,          // 은행 관련
      /npki/i,             // 공인인증서 폴더
      /signCert/i,         // 인증서
    ]
    return sensitivePatterns.some(pattern => pattern.test(filename))
  }

  const parseGitStatus = (output: string): GitStatus => {
    const lines = output.trim().split('\n').filter(Boolean)
    const staged: string[] = []
    const unstaged: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      const indexStatus = line[0]
      const workTreeStatus = line[1]
      const filename = line.substring(3)

      // Skip sensitive files
      if (isSensitiveFile(filename)) {
        console.warn('[GitPanel] Filtered sensitive file:', filename)
        continue
      }

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filename)
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(`${indexStatus} ${filename}`)
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstaged.push(`${workTreeStatus} ${filename}`)
        }
      }
    }

    return { staged, unstaged, untracked }
  }

  const parseGitLog = (output: string): GitCommitInfo[] => {
    // Parse git log --oneline --format="%H|%h|%s|%an|%ar" output
    const lines = output.trim().split('\n').filter(Boolean)
    return lines.map((line) => {
      const parts = line.split('|')
      if (parts.length >= 5) {
        return {
          hash: parts[0],
          shortHash: parts[1],
          message: parts[2],
          author: parts[3],
          date: parts[4],
        }
      }
      // Fallback for simple format
      return {
        hash: line.substring(0, 7),
        shortHash: line.substring(0, 7),
        message: line.substring(8) || line,
        author: 'Unknown',
        date: '',
      }
    })
  }

  const handleStageFile = async (filename: string) => {
    if (!projectGitPath || !window.electron?.git) return

    try {
      await window.electron.git.add?.(projectGitPath, filename)
      await refreshGitStatus()
    } catch (err) {
      console.error('Failed to stage file:', err)
      setError('파일 스테이징 실패')
    }
  }

  const handleUnstageFile = async (filename: string) => {
    if (!projectGitPath || !window.electron?.git) return

    try {
      // Reset specific file
      await window.electron.invoke?.('git:reset', projectGitPath, filename)
      await refreshGitStatus()
    } catch (err) {
      console.error('Failed to unstage file:', err)
      setError('파일 언스테이징 실패')
    }
  }

  const handleStageAll = async () => {
    if (!projectGitPath || !window.electron?.git) return

    try {
      await window.electron.git.add?.(projectGitPath, '.')
      await refreshGitStatus()
    } catch (err) {
      console.error('Failed to stage all:', err)
      setError('전체 스테이징 실패')
    }
  }

  const handleCommit = async () => {
    if (!projectGitPath || !window.electron?.git || !commitMessage.trim()) return

    setIsCommitting(true)
    setError(null)

    try {
      const result = await window.electron.git.commit?.(projectGitPath, commitMessage.trim())
      if (result?.success) {
        setCommitMessage('')
        await refreshGitStatus()
      } else {
        setError(result?.error || '커밋 실패')
      }
    } catch (err) {
      console.error('Failed to commit:', err)
      setError('커밋 실패')
    } finally {
      setIsCommitting(false)
    }
  }

  const handlePush = async () => {
    if (!projectGitPath || !window.electron?.git) return

    setIsPushing(true)
    setError(null)

    try {
      const result = await window.electron.git.push?.(projectGitPath)
      if (!result?.success) {
        setError(result?.error || 'Push 실패')
      }
      await refreshGitStatus()
    } catch (err) {
      console.error('Failed to push:', err)
      setError('Push 실패')
    } finally {
      setIsPushing(false)
    }
  }

  const handlePull = async () => {
    if (!projectGitPath || !window.electron?.git) return

    setIsPulling(true)
    setError(null)

    try {
      const result = await window.electron.git.pull?.(projectGitPath)
      if (!result?.success) {
        setError(result?.error || 'Pull 실패')
      }
      await refreshGitStatus()
    } catch (err) {
      console.error('Failed to pull:', err)
      setError('Pull 실패')
    } finally {
      setIsPulling(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const getStatusIcon = (status: string) => {
    switch (status[0]) {
      case 'M':
        return <span className="text-amber-400">M</span>
      case 'A':
        return <span className="text-green-400">A</span>
      case 'D':
        return <span className="text-red-400">D</span>
      case 'R':
        return <span className="text-blue-400">R</span>
      default:
        return <span className="text-zinc-400">?</span>
    }
  }

  if (isLoading) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  // 프로젝트가 선택되지 않은 경우 (linkedProjectId도 없고 projectPath도 없음)
  if (!linkedProjectId && !projectPath) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
        <GitBranch className={`w-12 h-12 mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
        <p className={`text-center ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          프로젝트를 먼저 선택해주세요
        </p>
        <p className={`text-center text-sm mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
          Neural Map에서 프로젝트를 연결하거나<br />로컬 폴더를 열면 Git을 사용할 수 있습니다
        </p>
      </div>
    )
  }

  // 프로젝트에 폴더가 연결되지 않은 경우
  if (!projectGitPath) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
        <GitBranch className={`w-12 h-12 mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
        <p className={`text-center ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          프로젝트에 폴더가 연결되지 않았습니다
        </p>
        <p className={`text-center text-sm mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
          프로젝트 대시보드에서 로컬 폴더를 연결하세요
        </p>
      </div>
    )
  }

  if (!isGitRepo) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
        <FolderGit className={`w-16 h-16 mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
        <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
          Git 저장소가 아닙니다
        </h3>
        <p className={`text-center text-sm mb-6 max-w-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
          이 프로젝트를 Git으로 관리하려면 초기화가 필요합니다.
          GitHub에 올리거나 로컬에서만 관리할 수 있습니다.
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          {/* GitHub 연동 버튼 */}
          <button
            onClick={handleConnectGitHub}
            disabled={isConnectingGitHub || isInitializing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnectingGitHub ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Github className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isConnectingGitHub
                ? 'GitHub 연동 중...'
                : isGitHubConnected
                  ? 'GitHub 레포지토리 생성 및 연동'
                  : 'GitHub 계정 연결하기'}
            </span>
          </button>

          {isGitHubConnected && gitHubUsername && (
            <p className={`text-xs text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              <Github className="w-3 h-3 inline mr-1" />
              {gitHubUsername}으로 연결됨
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className={`px-2 ${isDark ? 'bg-zinc-900 text-zinc-500' : 'bg-white text-zinc-400'}`}>
                또는
              </span>
            </div>
          </div>

          {/* 로컬 Git만 초기화 버튼 */}
          <button
            onClick={handleInitGitOnly}
            disabled={isInitializing || isConnectingGitHub}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {isInitializing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitBranch className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isInitializing ? '초기화 중...' : '로컬 Git만 초기화'}
            </span>
          </button>
          <p className={`text-xs text-center ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            GitHub 없이 로컬에서만 버전 관리
          </p>
        </div>
      </div>
    )
  }

  const totalChanges = status.staged.length + status.unstaged.length + status.untracked.length

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {/* Project name and path */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderGit className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
            <span className={`font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
              {linkedProjectName || '프로젝트'}
            </span>
          </div>
          <button
            onClick={refreshGitStatus}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''} ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
          </button>
        </div>
        {/* Path display */}
        <div className={`text-xs truncate mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} title={projectGitPath || ''}>
          {projectGitPath || 'No path'}
        </div>
        {/* Branch and remote status */}
        <div className="flex items-center gap-2">
          <GitBranch className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          <span className={`font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {currentBranch || 'main'}
          </span>
          {hasRemote && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <Github className="w-3 h-3" />
              연결됨
            </span>
          )}
        </div>
      </div>

      {/* No remote - show GitHub connect prompt */}
      {!hasRemote && (
        <div className={`mx-4 mt-3 p-3 rounded-lg border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Link2 className={`w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              GitHub에 연결되지 않음
            </span>
          </div>
          <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            GitHub에 연동하면 원격 저장소에 백업하고 협업할 수 있습니다.
          </p>
          <button
            onClick={handleConnectGitHub}
            disabled={isConnectingGitHub}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {isConnectingGitHub ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            {isConnectingGitHub
              ? '연동 중...'
              : isGitHubConnected
                ? 'GitHub 레포지토리 생성'
                : 'GitHub 연결하기'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Sync Actions */}
        <div className="flex gap-2">
          <button
            onClick={handlePull}
            disabled={isPulling}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            {isPulling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-sm">Pull</span>
          </button>
          <button
            onClick={handlePush}
            disabled={isPushing}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            {isPushing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span className="text-sm">Push</span>
          </button>
        </div>

        {/* Staged Changes */}
        <div>
          <button
            onClick={() => toggleSection('staged')}
            className={`flex items-center justify-between w-full py-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
          >
            <div className="flex items-center gap-2">
              {expandedSections.staged ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Staged</span>
              {status.staged.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  {status.staged.length}
                </span>
              )}
            </div>
          </button>
          {expandedSections.staged && status.staged.length > 0 && (
            <div className={`ml-6 space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {status.staged.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  {getStatusIcon(file)}
                  <span className="flex-1 truncate">{file.substring(2)}</span>
                  <button
                    onClick={() => handleUnstageFile(file.substring(2))}
                    className="p-1 hover:bg-zinc-800 rounded"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unstaged Changes */}
        <div>
          <button
            onClick={() => toggleSection('unstaged')}
            className={`flex items-center justify-between w-full py-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
          >
            <div className="flex items-center gap-2">
              {expandedSections.unstaged ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Changes</span>
              {status.unstaged.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                  {status.unstaged.length}
                </span>
              )}
            </div>
            {status.unstaged.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  status.unstaged.forEach((f) => handleStageFile(f.substring(2)))
                }}
                className={`text-xs px-2 py-1 rounded ${
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                }`}
              >
                Stage All
              </button>
            )}
          </button>
          {expandedSections.unstaged && status.unstaged.length > 0 && (
            <div className={`ml-6 space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {status.unstaged.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  {getStatusIcon(file)}
                  <span className="flex-1 truncate">{file.substring(2)}</span>
                  <button
                    onClick={() => handleStageFile(file.substring(2))}
                    className="p-1 hover:bg-zinc-800 rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Untracked Files */}
        <div>
          <button
            onClick={() => toggleSection('untracked')}
            className={`flex items-center justify-between w-full py-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
          >
            <div className="flex items-center gap-2">
              {expandedSections.untracked ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Untracked</span>
              {status.untracked.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-zinc-500/20 text-zinc-400 rounded">
                  {status.untracked.length}
                </span>
              )}
            </div>
          </button>
          {expandedSections.untracked && status.untracked.length > 0 && (
            <div className={`ml-6 space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {status.untracked.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <File className="w-3 h-3 text-zinc-500" />
                  <span className="flex-1 truncate">{file}</span>
                  <button
                    onClick={() => handleStageFile(file)}
                    className="p-1 hover:bg-zinc-800 rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commit History */}
        <div>
          <button
            onClick={() => toggleSection('history')}
            className={`flex items-center justify-between w-full py-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
          >
            <div className="flex items-center gap-2">
              {expandedSections.history ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">History</span>
            </div>
          </button>
          {expandedSections.history && commits.length > 0 && (
            <div className={`ml-2 space-y-2 mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {commits.map((commit, i) => (
                <div
                  key={commit.hash || i}
                  className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}
                >
                  <div className="flex items-start gap-2">
                    <GitCommit className="w-3 h-3 mt-1 text-zinc-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {commit.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-zinc-500">{commit.shortHash}</span>
                        {commit.date && (
                          <span className="text-[10px] text-zinc-500">{commit.date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commit Input */}
      <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <div className="space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="커밋 메시지..."
            rows={2}
            className={`w-full px-3 py-2 text-sm rounded-lg border resize-none outline-none transition-colors ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:border-zinc-500'
                : 'bg-white border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:border-zinc-400'
            }`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleStageAll}
              disabled={status.unstaged.length === 0 && status.untracked.length === 0}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 disabled:opacity-50'
              }`}
            >
              Stage All
            </button>
            <button
              onClick={handleCommit}
              disabled={isCommitting || !commitMessage.trim() || status.staged.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCommitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Commit
            </button>
          </div>
        </div>
      </div>

      {/* GitHub 레포 생성 모달 */}
      {isRepoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md mx-4 rounded-xl shadow-2xl ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            {/* 모달 헤더 */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                <Github className={`w-5 h-5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  GitHub 레포지토리 생성
                </h3>
              </div>
              <button
                onClick={() => setIsRepoModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="px-5 py-4 space-y-4">
              {/* 레포 이름 */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  레포지토리 이름 *
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                  placeholder="my-awesome-project"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:border-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-800 placeholder-zinc-400 focus:border-zinc-400'
                  }`}
                />
                <p className={`mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  영문, 숫자, 하이픈(-), 언더스코어(_)만 사용 가능
                </p>
              </div>

              {/* 설명 */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  설명 (선택)
                </label>
                <input
                  type="text"
                  value={repoDescription}
                  onChange={(e) => setRepoDescription(e.target.value)}
                  placeholder="프로젝트에 대한 간단한 설명"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:border-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-800 placeholder-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              {/* 공개/비공개 선택 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  공개 설정
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRepoPrivate(true)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                      isRepoPrivate
                        ? 'bg-zinc-800 border-zinc-600 text-white'
                        : isDark
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-medium">Private</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRepoPrivate(false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                      !isRepoPrivate
                        ? 'bg-zinc-800 border-zinc-600 text-white'
                        : isDark
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">Public</span>
                  </button>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-400">{error}</span>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className={`flex gap-3 px-5 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <button
                onClick={() => setIsRepoModalOpen(false)}
                disabled={isCreatingRepo}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                } disabled:opacity-50`}
              >
                취소
              </button>
              <button
                onClick={handleCreateRepo}
                disabled={isCreatingRepo || !repoName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingRepo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    레포지토리 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
