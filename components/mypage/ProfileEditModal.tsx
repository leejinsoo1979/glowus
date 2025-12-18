'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import type { UserProfile } from '@/types'

type EditSection = 'profile' | 'about' | 'resume' | 'portfolio' | 'contact'

interface ProfileEditModalProps {
  section: EditSection
  isOpen: boolean
  onClose: () => void
}

export function ProfileEditModal({ section, isOpen, onClose }: ProfileEditModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [formData, setFormData] = useState<Partial<UserProfile>>({})

  useEffect(() => {
    if (profile) {
      setFormData(profile)
    }
  }, [profile])

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }

  const inputClass = cn(
    'w-full px-4 py-3 rounded-xl border text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all',
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
      : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
  )

  const labelClass = cn(
    'block text-sm font-medium mb-2',
    isDark ? 'text-zinc-300' : 'text-zinc-700'
  )

  const renderProfileForm = () => (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>직함</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className={inputClass}
          placeholder="CEO & Founder"
        />
      </div>
      <div>
        <label className={labelClass}>생년월일</label>
        <input
          type="date"
          value={formData.birthday || ''}
          onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>위치</label>
        <input
          type="text"
          value={formData.location || ''}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className={inputClass}
          placeholder="서울시 강남구"
        />
      </div>
      <div className="border-t pt-4 mt-4">
        <h4 className={cn('font-medium mb-4', isDark ? 'text-white' : 'text-zinc-900')}>소셜 링크</h4>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>GitHub</label>
            <input
              type="url"
              value={formData.github_url || ''}
              onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              className={inputClass}
              placeholder="https://github.com/username"
            />
          </div>
          <div>
            <label className={labelClass}>Twitter</label>
            <input
              type="url"
              value={formData.twitter_url || ''}
              onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
              className={inputClass}
              placeholder="https://twitter.com/username"
            />
          </div>
          <div>
            <label className={labelClass}>LinkedIn</label>
            <input
              type="url"
              value={formData.linkedin_url || ''}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              className={inputClass}
              placeholder="https://linkedin.com/in/username"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderAboutForm = () => (
    <div className="space-y-6">
      {/* Bio */}
      <div>
        <label className={labelClass}>자기소개</label>
        <textarea
          value={(formData.bio || []).join('\n\n')}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value.split('\n\n').filter(Boolean) })}
          className={cn(inputClass, 'min-h-[150px] resize-none')}
          placeholder="자기소개를 입력하세요. 문단은 빈 줄로 구분됩니다."
        />
      </div>

      {/* Achievements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass}>주요 성과</label>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              achievements: [...(formData.achievements || []), { label: '', value: '' }]
            })}
            className="text-accent text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        <div className="space-y-3">
          {(formData.achievements || []).map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={item.label}
                onChange={(e) => {
                  const newAchievements = [...(formData.achievements || [])]
                  newAchievements[idx] = { ...newAchievements[idx], label: e.target.value }
                  setFormData({ ...formData, achievements: newAchievements })
                }}
                className={cn(inputClass, 'flex-1')}
                placeholder="라벨 (예: 누적 투자)"
              />
              <input
                type="text"
                value={item.value}
                onChange={(e) => {
                  const newAchievements = [...(formData.achievements || [])]
                  newAchievements[idx] = { ...newAchievements[idx], value: e.target.value }
                  setFormData({ ...formData, achievements: newAchievements })
                }}
                className={cn(inputClass, 'w-32')}
                placeholder="값 (예: 50억+)"
              />
              <button
                type="button"
                onClick={() => {
                  const newAchievements = (formData.achievements || []).filter((_, i) => i !== idx)
                  setFormData({ ...formData, achievements: newAchievements })
                }}
                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass}>전문 분야</label>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              services: [...(formData.services || []), { icon: 'Lightbulb', title: '', description: '' }]
            })}
            className="text-accent text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        <div className="space-y-4">
          {(formData.services || []).map((item, idx) => (
            <div key={idx} className={cn('p-4 rounded-xl border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
              <div className="flex justify-between mb-3">
                <select
                  value={item.icon}
                  onChange={(e) => {
                    const newServices = [...(formData.services || [])]
                    newServices[idx] = { ...newServices[idx], icon: e.target.value }
                    setFormData({ ...formData, services: newServices })
                  }}
                  className={cn(inputClass, 'w-40')}
                >
                  <option value="Lightbulb">Lightbulb</option>
                  <option value="Code">Code</option>
                  <option value="Users">Users</option>
                  <option value="TrendingUp">TrendingUp</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const newServices = (formData.services || []).filter((_, i) => i !== idx)
                    setFormData({ ...formData, services: newServices })
                  }}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => {
                  const newServices = [...(formData.services || [])]
                  newServices[idx] = { ...newServices[idx], title: e.target.value }
                  setFormData({ ...formData, services: newServices })
                }}
                className={cn(inputClass, 'mb-2')}
                placeholder="제목"
              />
              <textarea
                value={item.description}
                onChange={(e) => {
                  const newServices = [...(formData.services || [])]
                  newServices[idx] = { ...newServices[idx], description: e.target.value }
                  setFormData({ ...formData, services: newServices })
                }}
                className={cn(inputClass, 'min-h-[80px] resize-none')}
                placeholder="설명"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderResumeForm = () => (
    <div className="space-y-6">
      {/* Experience */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass}>경력</label>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              experience: [...(formData.experience || []), { title: '', company: '', period: '', description: '' }]
            })}
            className="text-accent text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        <div className="space-y-4">
          {(formData.experience || []).map((item, idx) => (
            <div key={idx} className={cn('p-4 rounded-xl border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const newExp = (formData.experience || []).filter((_, i) => i !== idx)
                    setFormData({ ...formData, experience: newExp })
                  }}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const newExp = [...(formData.experience || [])]
                    newExp[idx] = { ...newExp[idx], title: e.target.value }
                    setFormData({ ...formData, experience: newExp })
                  }}
                  className={inputClass}
                  placeholder="직함"
                />
                <input
                  type="text"
                  value={item.company}
                  onChange={(e) => {
                    const newExp = [...(formData.experience || [])]
                    newExp[idx] = { ...newExp[idx], company: e.target.value }
                    setFormData({ ...formData, experience: newExp })
                  }}
                  className={inputClass}
                  placeholder="회사명"
                />
              </div>
              <input
                type="text"
                value={item.period}
                onChange={(e) => {
                  const newExp = [...(formData.experience || [])]
                  newExp[idx] = { ...newExp[idx], period: e.target.value }
                  setFormData({ ...formData, experience: newExp })
                }}
                className={cn(inputClass, 'mb-2')}
                placeholder="기간 (예: 2020 — 현재)"
              />
              <textarea
                value={item.description}
                onChange={(e) => {
                  const newExp = [...(formData.experience || [])]
                  newExp[idx] = { ...newExp[idx], description: e.target.value }
                  setFormData({ ...formData, experience: newExp })
                }}
                className={cn(inputClass, 'min-h-[60px] resize-none')}
                placeholder="설명"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass}>학력</label>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              education: [...(formData.education || []), { title: '', period: '', description: '' }]
            })}
            className="text-accent text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        <div className="space-y-4">
          {(formData.education || []).map((item, idx) => (
            <div key={idx} className={cn('p-4 rounded-xl border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const newEdu = (formData.education || []).filter((_, i) => i !== idx)
                    setFormData({ ...formData, education: newEdu })
                  }}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => {
                  const newEdu = [...(formData.education || [])]
                  newEdu[idx] = { ...newEdu[idx], title: e.target.value }
                  setFormData({ ...formData, education: newEdu })
                }}
                className={cn(inputClass, 'mb-2')}
                placeholder="학교/학위"
              />
              <input
                type="text"
                value={item.period}
                onChange={(e) => {
                  const newEdu = [...(formData.education || [])]
                  newEdu[idx] = { ...newEdu[idx], period: e.target.value }
                  setFormData({ ...formData, education: newEdu })
                }}
                className={cn(inputClass, 'mb-2')}
                placeholder="기간 (예: 2008 — 2012)"
              />
              <textarea
                value={item.description}
                onChange={(e) => {
                  const newEdu = [...(formData.education || [])]
                  newEdu[idx] = { ...newEdu[idx], description: e.target.value }
                  setFormData({ ...formData, education: newEdu })
                }}
                className={cn(inputClass, 'min-h-[60px] resize-none')}
                placeholder="설명"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass}>핵심 역량</label>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              skills: [...(formData.skills || []), { name: '', level: 80 }]
            })}
            className="text-accent text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        <div className="space-y-3">
          {(formData.skills || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={item.name}
                onChange={(e) => {
                  const newSkills = [...(formData.skills || [])]
                  newSkills[idx] = { ...newSkills[idx], name: e.target.value }
                  setFormData({ ...formData, skills: newSkills })
                }}
                className={cn(inputClass, 'flex-1')}
                placeholder="스킬명"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={item.level}
                onChange={(e) => {
                  const newSkills = [...(formData.skills || [])]
                  newSkills[idx] = { ...newSkills[idx], level: parseInt(e.target.value) || 0 }
                  setFormData({ ...formData, skills: newSkills })
                }}
                className={cn(inputClass, 'w-20')}
                placeholder="%"
              />
              <button
                type="button"
                onClick={() => {
                  const newSkills = (formData.skills || []).filter((_, i) => i !== idx)
                  setFormData({ ...formData, skills: newSkills })
                }}
                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderPortfolioForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <label className={labelClass}>포트폴리오 항목</label>
        <button
          type="button"
          onClick={() => setFormData({
            ...formData,
            portfolio: [...(formData.portfolio || []), { title: '', category: '프로젝트', description: '', status: '진행중' }]
          })}
          className="text-accent text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> 추가
        </button>
      </div>
      <div className="space-y-4">
        {(formData.portfolio || []).map((item, idx) => (
          <div key={idx} className={cn('p-4 rounded-xl border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  const newPortfolio = (formData.portfolio || []).filter((_, i) => i !== idx)
                  setFormData({ ...formData, portfolio: newPortfolio })
                }}
                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={item.title}
              onChange={(e) => {
                const newPortfolio = [...(formData.portfolio || [])]
                newPortfolio[idx] = { ...newPortfolio[idx], title: e.target.value }
                setFormData({ ...formData, portfolio: newPortfolio })
              }}
              className={cn(inputClass, 'mb-2')}
              placeholder="제목"
            />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={item.category}
                onChange={(e) => {
                  const newPortfolio = [...(formData.portfolio || [])]
                  newPortfolio[idx] = { ...newPortfolio[idx], category: e.target.value }
                  setFormData({ ...formData, portfolio: newPortfolio })
                }}
                className={inputClass}
              >
                <option value="프로젝트">프로젝트</option>
                <option value="성과">성과</option>
                <option value="미디어">미디어</option>
              </select>
              <select
                value={item.status}
                onChange={(e) => {
                  const newPortfolio = [...(formData.portfolio || [])]
                  newPortfolio[idx] = { ...newPortfolio[idx], status: e.target.value }
                  setFormData({ ...formData, portfolio: newPortfolio })
                }}
                className={inputClass}
              >
                <option value="운영중">운영중</option>
                <option value="개발중">개발중</option>
                <option value="완료">완료</option>
              </select>
            </div>
            <textarea
              value={item.description}
              onChange={(e) => {
                const newPortfolio = [...(formData.portfolio || [])]
                newPortfolio[idx] = { ...newPortfolio[idx], description: e.target.value }
                setFormData({ ...formData, portfolio: newPortfolio })
              }}
              className={cn(inputClass, 'min-h-[60px] resize-none')}
              placeholder="설명"
            />
          </div>
        ))}
      </div>
    </div>
  )

  const renderContactForm = () => (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>연락용 이메일</label>
        <input
          type="email"
          value={formData.contact_email || ''}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          className={inputClass}
          placeholder="contact@example.com"
        />
      </div>
      <div>
        <label className={labelClass}>연락처</label>
        <input
          type="tel"
          value={formData.contact_phone || ''}
          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
          className={inputClass}
          placeholder="+82 10-1234-5678"
        />
      </div>
      <div>
        <label className={labelClass}>상세 주소</label>
        <input
          type="text"
          value={formData.contact_address || ''}
          onChange={(e) => setFormData({ ...formData, contact_address: e.target.value })}
          className={inputClass}
          placeholder="서울시 강남구 테헤란로 123"
        />
      </div>
      <div>
        <label className={labelClass}>Calendly URL</label>
        <input
          type="url"
          value={formData.calendly_url || ''}
          onChange={(e) => setFormData({ ...formData, calendly_url: e.target.value })}
          className={inputClass}
          placeholder="https://calendly.com/username"
        />
      </div>
    </div>
  )

  const sectionTitles: Record<EditSection, string> = {
    profile: '프로필 편집',
    about: '소개 편집',
    resume: '이력 편집',
    portfolio: '포트폴리오 편집',
    contact: '연락처 편집',
  }

  const renderForm = () => {
    switch (section) {
      case 'profile': return renderProfileForm()
      case 'about': return renderAboutForm()
      case 'resume': return renderResumeForm()
      case 'portfolio': return renderPortfolioForm()
      case 'contact': return renderContactForm()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col',
        isDark ? 'bg-zinc-900' : 'bg-white'
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between p-4 border-b',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}>
          <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {sectionTitles[section]}
          </h2>
          <button onClick={onClose} className={cn(
            'p-2 rounded-lg transition-colors',
            isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
          )}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderForm()}
        </div>

        {/* Footer */}
        <div className={cn(
          'flex items-center justify-end gap-3 p-4 border-t',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}>
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium',
              isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            )}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
          >
            {updateProfile.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
