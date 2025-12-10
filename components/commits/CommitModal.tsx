'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Input } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { X, Sparkles, GitCommit, Zap, AlertTriangle, Info } from 'lucide-react'

type ImpactLevel = 'low' | 'medium' | 'high'

const impactOptions = [
  { level: 'low' as const, label: '낮음', icon: Info, color: 'zinc' },
  { level: 'medium' as const, label: '보통', icon: Zap, color: 'yellow' },
  { level: 'high' as const, label: '높음', icon: AlertTriangle, color: 'red' },
]

export function CommitModal() {
  const { commitModalOpen, closeCommitModal } = useUIStore()
  const { user, currentStartup } = useAuthStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>('medium')
  const [isLoading, setIsLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsLoading(true)
    try {
      const supabase = createClient()

      // tasks 테이블에 커밋 저장 (commits 역할)
      const { error } = await supabase
        .from('tasks')
        .insert({
          startup_id: currentStartup?.id,
          author_id: user?.id,
          title: title.trim(),
          description: description.trim() || null,
          status: 'DONE',
          priority: impactLevel === 'high' ? 'HIGH' : impactLevel === 'medium' ? 'MEDIUM' : 'LOW',
          completed_at: new Date().toISOString(),
        } as any)

      if (error) throw error

      // Reset form and close modal
      setTitle('')
      setDescription('')
      setImpactLevel('medium')
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
    setAiSuggestion('이 커밋은 프로젝트 진행에 중요한 기여를 합니다. 다음 단계로 테스트 코드 작성을 권장합니다.')
  }

  return (
    <AnimatePresence>
      {commitModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCommitModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                    <GitCommit className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">새 커밋</h2>
                    <p className="text-sm text-zinc-500">오늘의 작업을 기록하세요</p>
                  </div>
                </div>
                <button
                  onClick={closeCommitModal}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      무엇을 했나요? *
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="작업 내용을 한 줄로 요약해주세요"
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      상세 설명 (선택)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="더 자세한 내용이 있다면 적어주세요..."
                      className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
                    />
                  </div>

                  {/* Impact Level */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      영향도
                    </label>
                    <div className="flex gap-2">
                      {impactOptions.map((option) => {
                        const Icon = option.icon
                        const isSelected = impactLevel === option.level
                        return (
                          <button
                            key={option.level}
                            type="button"
                            onClick={() => setImpactLevel(option.level)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                              isSelected
                                ? option.color === 'zinc'
                                  ? 'bg-zinc-700 text-zinc-100 ring-2 ring-zinc-500'
                                  : option.color === 'yellow'
                                  ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50'
                                  : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* AI Suggestion */}
                  <AnimatePresence>
                    {aiSuggestion && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-accent/10 border border-accent/30 rounded-xl"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-accent mb-1">AI 제안</p>
                            <p className="text-sm text-zinc-300">{aiSuggestion}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AI Button */}
                  {!aiSuggestion && title.length > 5 && (
                    <button
                      type="button"
                      onClick={handleAiSuggest}
                      className="flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI로 인사이트 받기
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl">
                  <Button type="button" variant="ghost" onClick={closeCommitModal}>
                    취소
                  </Button>
                  <Button type="submit" isLoading={isLoading} disabled={!title.trim()}>
                    <GitCommit className="w-4 h-4 mr-2" />
                    커밋 저장
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
