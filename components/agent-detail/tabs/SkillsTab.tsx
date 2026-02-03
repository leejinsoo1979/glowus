'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Zap,
  Plus,
  FileCode,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Copy,
  Check,
  FileText,
  FolderUp,
  Package,
  Power,
  PowerOff,
  ExternalLink,
  Key,
  Settings,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SKILL_MD_TEMPLATE } from '../constants'

export interface RequiredApi {
  name: string
  description?: string
  default?: string
  required?: boolean
}

export interface SkillSecret {
  id: string
  key_name: string
  description?: string
  is_required: boolean
  default_value?: string
  has_value: boolean
}

export interface Skill {
  id: string
  agent_id: string
  name: string
  description: string
  content: string
  skill_type: 'custom' | 'hub' | 'system'
  source: string
  category: string | null
  keywords: string[]
  files: Array<{ name: string; content: string; type: string }>
  enabled: boolean
  version: string
  usage_count: number
  success_count: number
  last_used_at: string | null
  metadata: Record<string, any> & { requires_api?: RequiredApi[] }
  created_at: string
  updated_at: string
}

interface SkillsTabProps {
  agent: {
    id: string
  }
  isDark: boolean
}

export function SkillsTab({ agent, isDark }: SkillsTabProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newSkillContent, setNewSkillContent] = useState(SKILL_MD_TEMPLATE)
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // API 설정 관련 상태
  const [apiSettingsSkillId, setApiSettingsSkillId] = useState<string | null>(null)
  const [skillSecrets, setSkillSecrets] = useState<SkillSecret[]>([])
  const [secretValues, setSecretValues] = useState<Record<string, string>>({})
  const [showSecretValues, setShowSecretValues] = useState<Record<string, boolean>>({})
  const [loadingSecrets, setLoadingSecrets] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // 스킬 목록 로드
  const loadSkills = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agent.id}/skills`)
      if (!res.ok) throw new Error('스킬 로드 실패')
      const data = await res.json()
      setSkills(data.skills || [])
    } catch (err) {
      console.error('Load skills error:', err)
      setError('스킬을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [agent.id])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // 새 스킬 추가
  const handleAddSkill = async (content: string, files: any[] = [], source = 'local') => {
    if (!content.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/agents/${agent.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, files, source }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '스킬 추가 실패')
      }

      const { skill } = await res.json()
      setSkills((prev) => [skill, ...prev])
      setIsAddingNew(false)
      setNewSkillContent(SKILL_MD_TEMPLATE)
      setSuccess(`스킬 "${skill.name}" 추가 완료!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 스킬 삭제
  const handleDeleteSkill = async (skillId: string) => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/agents/${agent.id}/skills?skillId=${skillId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '스킬 삭제 실패')
      }

      setSkills((prev) => prev.filter((s) => s.id !== skillId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 스킬 수정
  const handleUpdateSkill = async () => {
    if (!editingSkill) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/agents/${agent.id}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: editingSkill.id,
          content: editingSkill.content,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '스킬 수정 실패')
      }

      const { skill } = await res.json()
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? skill : s)))
      setEditingSkill(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 스킬 활성화/비활성화 토글
  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    setSaving(true)

    try {
      const res = await fetch(`/api/agents/${agent.id}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, enabled }),
      })

      if (!res.ok) throw new Error('토글 실패')

      const { skill } = await res.json()
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? skill : s)))
    } catch (err) {
      console.error('Toggle error:', err)
    } finally {
      setSaving(false)
    }
  }

  // 단일 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const content = await file.text()
    setNewSkillContent(content)
    setIsAddingNew(true)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 폴더 업로드 (스킬 허브 폴더)
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setSaving(true)
    setError(null)

    try {
      let skillMdContent = ''
      const additionalFiles: Array<{ name: string; content: string; type: string }> = []
      let detectedSource = 'skill-hub' // 기본값

      // 파일들 처리
      for (const file of Array.from(files)) {
        const relativePath = file.webkitRelativePath || file.name
        const fileName = relativePath.split('/').pop() || file.name
        const content = await file.text()

        if (fileName.toLowerCase() === 'skill.md') {
          skillMdContent = content

          // OpenClaw 스킬 감지 (frontmatter 또는 내용에서)
          const lowerContent = content.toLowerCase()
          if (
            lowerContent.includes('openclaw') ||
            lowerContent.includes('claw') ||
            lowerContent.includes('clawhub')
          ) {
            detectedSource = 'openclaw'
          }
        } else {
          // 추가 파일 저장 (예: examples, prompts 등)
          const ext = fileName.split('.').pop()?.toLowerCase()
          let type = 'text'
          if (ext === 'md') type = 'markdown'
          else if (ext === 'json') type = 'json'
          else if (ext === 'yaml' || ext === 'yml') type = 'yaml'
          else if (['js', 'ts', 'py'].includes(ext || '')) type = 'code'

          additionalFiles.push({
            name: relativePath,
            content,
            type,
          })

          // 파일명/내용에서도 OpenClaw 감지
          if (
            relativePath.toLowerCase().includes('openclaw') ||
            relativePath.toLowerCase().includes('clawhub')
          ) {
            detectedSource = 'openclaw'
          }
        }
      }

      if (!skillMdContent) {
        throw new Error('SKILL.md 파일이 폴더에 없습니다')
      }

      // 스킬 추가 (감지된 출처 사용)
      await handleAddSkill(skillMdContent, additionalFiles, detectedSource)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  // API 설정 로드
  const loadSkillSecrets = async (skillId: string) => {
    setLoadingSecrets(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/skills/${skillId}/secrets`)
      if (!res.ok) throw new Error('API 설정 로드 실패')
      const data = await res.json()
      setSkillSecrets(data.secrets || [])
      // 기존 값 초기화
      const values: Record<string, string> = {}
      for (const secret of data.secrets || []) {
        values[secret.key_name] = secret.default_value || ''
      }
      setSecretValues(values)
    } catch (err) {
      console.error('Load secrets error:', err)
      setSkillSecrets([])
    } finally {
      setLoadingSecrets(false)
    }
  }

  // API 설정 저장
  const handleSaveSecrets = async (skillId: string) => {
    setSaving(true)
    try {
      const secrets = Object.entries(secretValues).map(([key_name, key_value]) => ({
        key_name,
        key_value,
      }))

      const res = await fetch(`/api/agents/${agent.id}/skills/${skillId}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets }),
      })

      if (!res.ok) throw new Error('API 설정 저장 실패')

      const data = await res.json()
      setSkillSecrets(data.secrets || [])
      setApiSettingsSkillId(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // API 설정 모달 열기
  const openApiSettings = (skill: Skill) => {
    setApiSettingsSkillId(skill.id)
    loadSkillSecrets(skill.id)
  }

  // API 설정이 필요한 스킬인지 확인
  const skillRequiresApi = (skill: Skill) => {
    return skill.metadata?.requires_api && skill.metadata.requires_api.length > 0
  }

  // 스킬 내용 복사
  const handleCopySkill = (skillId: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopied(skillId)
    setTimeout(() => setCopied(null), 2000)
  }

  // 활성화된 스킬
  const enabledSkills = skills.filter((s) => s.enabled)
  const disabledSkills = skills.filter((s) => !s.enabled)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 성공 메시지 */}
      {success && (
        <div className={cn(
          'p-4 rounded-lg flex items-center justify-between',
          'bg-green-500/20 text-green-400 border border-green-500/30'
        )}>
          <span>✅ {success}</span>
          <button onClick={() => setSuccess(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className={cn(
          'p-4 rounded-lg flex items-center justify-between',
          'bg-red-500/20 text-red-400 border border-red-500/30'
        )}>
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 장착된 스킬 (상단 고정) */}
      {enabledSkills.length > 0 && (
        <div
          className={cn(
            'p-4 rounded-xl border',
            isDark ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <Power className="w-5 h-5 text-amber-500" />
            <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              장착된 스킬
            </h3>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-amber-500/20 text-amber-500'
            )}>
              {enabledSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledSkills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all',
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
                    : 'bg-white hover:bg-zinc-50 border border-zinc-200'
                )}
                onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
              >
                <Zap className="w-4 h-4 text-amber-500" />
                <span className={cn('font-mono text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                  /{skill.name}
                </span>
                {skill.skill_type === 'hub' && (
                  <span title="스킬 허브">
                    <Package className="w-3 h-3 text-blue-500" />
                  </span>
                )}
                {skillRequiresApi(skill) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openApiSettings(skill)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      isDark ? 'hover:bg-zinc-600' : 'hover:bg-zinc-200'
                    )}
                    title="API 설정 필요"
                  >
                    <Key className="w-3 h-3 text-orange-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            커스텀 스킬
          </h2>
          <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            SKILL.md 형식으로 에이전트 전용 스킬을 정의합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 숨겨진 파일 입력들 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore - webkitdirectory is not in types
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderUpload}
            className="hidden"
          />

          {/* 폴더 업로드 (스킬 허브) */}
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            )}
          >
            <FolderUp className="w-4 h-4" />
            스킬 폴더 업로드
          </button>

          {/* 파일 업로드 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
            )}
          >
            <FileText className="w-4 h-4" />
            파일 업로드
          </button>

          {/* 새 스킬 추가 */}
          <button
            onClick={() => {
              setNewSkillContent(SKILL_MD_TEMPLATE)
              setIsAddingNew(true)
            }}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 스킬 추가
          </button>
        </div>
      </div>

      {/* 새 스킬 추가 폼 */}
      {isAddingNew && (
        <div
          className={cn(
            'p-6 rounded-xl border',
            isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
              <FileCode className="w-5 h-5 text-amber-500" />
              새 스킬 추가
            </h3>
            <button
              onClick={() => setIsAddingNew(false)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <textarea
            value={newSkillContent}
            onChange={(e) => setNewSkillContent(e.target.value)}
            className={cn(
              'w-full px-4 py-3 rounded-lg border resize-none font-mono text-sm leading-relaxed',
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900'
            )}
            rows={15}
            placeholder="SKILL.md 형식으로 스킬을 정의하세요..."
          />

          {/* 가이드 */}
          <div className={cn(
            'mt-4 p-4 rounded-lg text-xs',
            isDark ? 'bg-zinc-900/50 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
          )}>
            <p className="font-medium mb-2">SKILL.md 형식:</p>
            <pre className={cn('p-2 rounded', isDark ? 'bg-zinc-800' : 'bg-white')}>
{`---
name: skill-name
description: 스킬 설명
user-invocable: true
---

# 스킬 제목

사용법과 설명...`}
            </pre>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setIsAddingNew(false)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm',
                isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
              )}
            >
              취소
            </button>
            <button
              onClick={() => handleAddSkill(newSkillContent)}
              disabled={saving || !newSkillContent.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              추가
            </button>
          </div>
        </div>
      )}

      {/* 스킬 목록 */}
      {skills.length === 0 && !isAddingNew ? (
        <div
          className={cn(
            'p-12 rounded-xl border text-center',
            isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
          )}
        >
          <Zap className={cn('w-12 h-12 mx-auto mb-4', isDark ? 'text-zinc-600' : 'text-zinc-300')} />
          <p className={cn('text-lg font-medium mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            등록된 스킬이 없습니다
          </p>
          <p className={cn('text-sm mb-6', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            스킬 허브에서 다운받은 폴더를 업로드하거나 직접 스킬을 추가하세요
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
            >
              <FolderUp className="w-4 h-4" />
              스킬 폴더 업로드
            </button>
            <button
              onClick={() => {
                setNewSkillContent(SKILL_MD_TEMPLATE)
                setIsAddingNew(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90"
            >
              <Plus className="w-4 h-4" />
              직접 추가하기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={cn(
                'rounded-xl border overflow-hidden',
                isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200',
                !skill.enabled && 'opacity-60'
              )}
            >
              {/* 스킬 헤더 */}
              <div
                className={cn(
                  'flex items-center gap-4 px-4 py-3 cursor-pointer',
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                )}
                onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
              >
                <div className={cn(
                  'p-2 rounded-lg',
                  skill.enabled
                    ? 'bg-amber-500/20 text-amber-500'
                    : isDark ? 'bg-zinc-700 text-zinc-500' : 'bg-zinc-200 text-zinc-400'
                )}>
                  <Zap className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'font-mono font-medium',
                      isDark ? 'text-zinc-200' : 'text-zinc-800'
                    )}>
                      /{skill.name}
                    </span>
                    {skill.skill_type === 'hub' && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        'bg-blue-500/20 text-blue-500'
                      )}>
                        허브
                      </span>
                    )}
                    {!skill.enabled && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded flex items-center gap-1',
                        isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                      )}>
                        <PowerOff className="w-3 h-3" />
                        비활성
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm truncate',
                    isDark ? 'text-zinc-500' : 'text-zinc-400'
                  )}>
                    {skill.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* 사용 통계 */}
                  {skill.usage_count > 0 && (
                    <span className={cn(
                      'text-xs',
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    )}>
                      {skill.usage_count}회 사용
                    </span>
                  )}

                  {/* 활성화 토글 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleSkill(skill.id, !skill.enabled)
                    }}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors',
                      skill.enabled
                        ? 'bg-accent'
                        : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                    )}
                  >
                    <div className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                      skill.enabled ? 'translate-x-5' : 'translate-x-1'
                    )} />
                  </button>

                  {/* 복사 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopySkill(skill.id, skill.content)
                    }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100'
                    )}
                    title="복사"
                  >
                    {copied === skill.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                    )}
                  </button>

                  {/* API 설정 (필요한 경우) */}
                  {skillRequiresApi(skill) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openApiSettings(skill)
                      }}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100'
                      )}
                      title="API 설정"
                    >
                      <Key className={cn('w-4 h-4 text-orange-500')} />
                    </button>
                  )}

                  {/* 삭제 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`"${skill.name}" 스킬을 삭제하시겠습니까?`)) {
                        handleDeleteSkill(skill.id)
                      }
                    }}
                    className={cn(
                      'p-2 rounded-lg transition-colors text-red-500',
                      isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'
                    )}
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* 확장 아이콘 */}
                  {expandedSkillId === skill.id ? (
                    <ChevronUp className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  ) : (
                    <ChevronDown className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  )}
                </div>
              </div>

              {/* 스킬 내용 (확장 시) */}
              {expandedSkillId === skill.id && (
                <div className={cn(
                  'px-4 pb-4 border-t',
                  isDark ? 'border-zinc-700' : 'border-zinc-200'
                )}>
                  {/* 추가 파일 목록 */}
                  {skill.files && skill.files.length > 0 && (
                    <div className="mt-4 mb-3">
                      <p className={cn('text-xs font-medium mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        포함된 파일 ({skill.files.length}개)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {skill.files.map((file, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'text-xs px-2 py-1 rounded flex items-center gap-1',
                              isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                            )}
                          >
                            <FileText className="w-3 h-3" />
                            {file.name.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingSkill?.id === skill.id ? (
                    <>
                      <textarea
                        value={editingSkill.content}
                        onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
                        className={cn(
                          'w-full mt-4 px-4 py-3 rounded-lg border resize-none font-mono text-sm leading-relaxed',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        )}
                        rows={12}
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={() => setEditingSkill(null)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm',
                            isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                          )}
                        >
                          취소
                        </button>
                        <button
                          onClick={handleUpdateSkill}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          저장
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className={cn(
                        'mt-4 p-4 rounded-lg font-mono text-sm overflow-x-auto',
                        isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-50 text-zinc-700'
                      )}>
                        {skill.content}
                      </pre>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => setEditingSkill(skill)}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                            isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                          )}
                        >
                          <Edit3 className="w-4 h-4" />
                          편집
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 저장 중 인디케이터 */}
      {saving && (
        <div className={cn(
          'fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg z-50',
          isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'
        )}>
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          저장 중...
        </div>
      )}

      {/* API 설정 모달 */}
      {apiSettingsSkillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={cn(
            'w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden',
            isDark ? 'bg-zinc-800' : 'bg-white'
          )}>
            {/* 모달 헤더 */}
            <div className={cn(
              'flex items-center justify-between px-6 py-4 border-b',
              isDark ? 'border-zinc-700' : 'border-zinc-200'
            )}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Key className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    API 설정
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    /{skills.find(s => s.id === apiSettingsSkillId)?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApiSettingsSkillId(null)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 컨텐츠 */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {loadingSecrets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : skillSecrets.length === 0 ? (
                <div className={cn(
                  'p-4 rounded-lg text-center',
                  isDark ? 'bg-zinc-700/50' : 'bg-zinc-100'
                )}>
                  <AlertTriangle className={cn('w-8 h-8 mx-auto mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                  <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    이 스킬은 API 설정이 필요하지만,<br />
                    아직 API 요구사항이 정의되지 않았습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={cn(
                    'p-3 rounded-lg text-sm flex items-start gap-2',
                    isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  )}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>API 키는 암호화되어 저장됩니다. 입력 후 저장 버튼을 클릭하세요.</p>
                  </div>

                  {skillSecrets.map((secret) => (
                    <div key={secret.key_name} className="space-y-2">
                      <label className={cn(
                        'flex items-center gap-2 text-sm font-medium',
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      )}>
                        {secret.key_name}
                        {secret.is_required && <span className="text-red-500">*</span>}
                        {secret.has_value && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                            설정됨
                          </span>
                        )}
                      </label>
                      {secret.description && (
                        <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {secret.description}
                        </p>
                      )}
                      <div className="relative">
                        <input
                          type={showSecretValues[secret.key_name] ? 'text' : 'password'}
                          value={secretValues[secret.key_name] || ''}
                          onChange={(e) => setSecretValues(prev => ({ ...prev, [secret.key_name]: e.target.value }))}
                          placeholder={secret.default_value || `Enter ${secret.key_name}`}
                          className={cn(
                            'w-full px-3 py-2 pr-10 rounded-lg border font-mono text-sm',
                            isDark
                              ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          )}
                        />
                        <button
                          onClick={() => setShowSecretValues(prev => ({ ...prev, [secret.key_name]: !prev[secret.key_name] }))}
                          className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded',
                            isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200'
                          )}
                        >
                          {showSecretValues[secret.key_name] ? (
                            <EyeOff className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className={cn(
              'flex justify-end gap-2 px-6 py-4 border-t',
              isDark ? 'border-zinc-700' : 'border-zinc-200'
            )}>
              <button
                onClick={() => setApiSettingsSkillId(null)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm',
                  isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                )}
              >
                취소
              </button>
              <button
                onClick={() => handleSaveSecrets(apiSettingsSkillId)}
                disabled={saving || skillSecrets.length === 0}
                className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SkillsTab
