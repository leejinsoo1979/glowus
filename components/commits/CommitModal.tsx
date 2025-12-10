'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, Sparkles } from 'lucide-react'

type ImpactLevel = 'low' | 'medium' | 'high'

export function CommitModal() {
  const { commitModalOpen, closeCommitModal } = useUIStore()
  const { user, currentTeam } = useAuthStore()
  const [description, setDescription] = useState('')
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>('medium')
  const [nextAction, setNextAction] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')

  if (!commitModalOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('commits')
        .insert({
          user_id: user?.id,
          team_id: currentTeam?.id,
          description: description.trim(),
          impact_level: impactLevel,
          next_action: nextAction.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      // Reset form and close modal
      setDescription('')
      setImpactLevel('medium')
      setNextAction('')
      setAiSuggestion('')
      closeCommitModal()
    } catch (error) {
      console.error('Error creating commit:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAiSuggest = () => {
    // Mock AI suggestion - replace with actual API call
    setAiSuggestion('이 커밋은 사용자 인증 보안 강화에 기여할 것으로 보입니다. 다음 단계로 2FA 구현을 고려해보세요.')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={closeCommitModal}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">새 커밋</h2>
            <button
              onClick={closeCommitModal}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  무엇을 했나요? *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="오늘 완료한 작업을 간단히 설명해주세요..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  required
                />
              </div>

              {/* Impact Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  영향도
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as ImpactLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setImpactLevel(level)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        impactLevel === level
                          ? level === 'low'
                            ? 'bg-gray-100 text-gray-700 ring-2 ring-gray-300'
                            : level === 'medium'
                            ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                            : 'bg-red-100 text-red-700 ring-2 ring-red-300'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {level === 'low' ? '낮음' : level === 'medium' ? '보통' : '높음'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  다음 할 일 (선택)
                </label>
                <Input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="다음에 진행할 작업이 있다면..."
                />
              </div>

              {/* AI Suggestion */}
              {aiSuggestion && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary-700 mb-1">AI 제안</p>
                      <p className="text-sm text-primary-600">{aiSuggestion}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Button */}
              {!aiSuggestion && description.length > 10 && (
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  <Sparkles className="w-4 h-4" />
                  AI로 인사이트 받기
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <Button type="button" variant="outline" onClick={closeCommitModal}>
                취소
              </Button>
              <Button type="submit" isLoading={isLoading} disabled={!description.trim()}>
                커밋 저장
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
