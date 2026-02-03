'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bot, Save, Loader2, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/authStore'

interface JarvisPersona {
  name: string           // 자비스 이름 (예: "자비스", "J.A.R.V.I.S", "프라이데이")
  gender: string         // 성별/페르소나 (예: "남성", "여성", "중성")
  userTitle: string      // 사용자를 뭐라고 부를지 (예: "사장님", "보스", "대표님")
  personality: string    // 성격 (예: "친절하고 전문적인", "유머러스한", "차분한")
  language: string       // 응답 언어 (예: "한국어", "영어", "한영 혼합")
  greeting: string       // 첫 인사말 템플릿
  customInstructions: string // 추가 지시사항
}

const defaultPersona: JarvisPersona = {
  name: 'Jarvis',
  gender: '남성',
  userTitle: '사장님',
  personality: '친절하고 전문적이며, 약간의 유머 감각을 갖춘',
  language: '한국어',
  greeting: '{userTitle}, 안녕하세요! 무엇을 도와드릴까요?',
  customInstructions: '',
}

export default function JarvisSettingsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { user } = useAuthStore()

  const [persona, setPersona] = useState<JarvisPersona>(defaultPersona)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')

  // 저장된 설정 불러오기 (localStorage 사용)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jarvis_persona')
      if (saved) {
        setPersona({ ...defaultPersona, ...JSON.parse(saved) })
      }
    } catch (e) {
      console.error('Failed to load Jarvis settings:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 설정 저장 (localStorage 사용)
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')

    try {
      localStorage.setItem('jarvis_persona', JSON.stringify(persona))
      setSaveMessage('저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (e) {
      console.error('Failed to save Jarvis settings:', e)
      setSaveMessage('저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 기본값으로 초기화
  const handleReset = () => {
    setPersona(defaultPersona)
  }

  // 미리보기 생성
  const generatePreview = () => {
    const greeting = persona.greeting
      .replace('{userTitle}', persona.userTitle)
      .replace('{userName}', user?.full_name || '사용자')

    return `[${persona.name}] ${greeting}`
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className={`flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-800'}`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>설정으로 돌아가기</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg bg-blue-500/10`}>
            <Bot className="w-6 h-6 text-blue-500" />
          </div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            Jarvis 페르소나 설정
          </h1>
        </div>
        <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          자비스가 당신을 어떻게 부르고, 어떤 성격으로 응답할지 설정하세요
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* 자비스 이름 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            AI 비서 이름
          </label>
          <input
            type="text"
            value={persona.name}
            onChange={(e) => setPersona({ ...persona, name: e.target.value })}
            placeholder="Jarvis"
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {['Jarvis', 'J.A.R.V.I.S', 'Friday', '프라이데이', 'Alfred', '알프레드'].map((name) => (
              <button
                key={name}
                onClick={() => setPersona({ ...persona, name })}
                className={`px-3 py-1 rounded-full text-sm ${
                  persona.name === name
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 성별/페르소나 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            성별 / 페르소나
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '남성', label: '남성 (Jarvis, Alfred 스타일)' },
              { value: '여성', label: '여성 (Friday 스타일)' },
              { value: '중성', label: '중성 (성별 무관)' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPersona({ ...persona, gender: value })}
                className={`px-4 py-2 rounded-lg ${
                  persona.gender === value
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={`text-sm mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            AI 비서의 말투와 표현 스타일에 영향을 줍니다
          </p>
        </motion.div>

        {/* 사용자 호칭 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            사용자 호칭
          </label>
          <input
            type="text"
            value={persona.userTitle}
            onChange={(e) => setPersona({ ...persona, userTitle: e.target.value })}
            placeholder="사장님, 보스, 대표님..."
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          />
          <p className={`text-sm mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            자비스가 당신을 부를 때 사용할 호칭
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {['사장님', '보스', '대표님', '선생님', user?.full_name + '님'].filter(Boolean).map((title) => (
              <button
                key={title}
                onClick={() => setPersona({ ...persona, userTitle: title || '' })}
                className={`px-3 py-1 rounded-full text-sm ${
                  persona.userTitle === title
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 성격 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            성격
          </label>
          <input
            type="text"
            value={persona.personality}
            onChange={(e) => setPersona({ ...persona, personality: e.target.value })}
            placeholder="친절하고 전문적인..."
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              '친절하고 전문적인',
              '유머러스하고 활기찬',
              '차분하고 신뢰감 있는',
              '짧고 간결한',
              '아이언맨의 자비스처럼',
            ].map((p) => (
              <button
                key={p}
                onClick={() => setPersona({ ...persona, personality: p })}
                className={`px-3 py-1 rounded-full text-sm ${
                  persona.personality === p
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 언어 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            응답 언어
          </label>
          <div className="flex flex-wrap gap-2">
            {['한국어', '영어', '한영 혼합'].map((lang) => (
              <button
                key={lang}
                onClick={() => setPersona({ ...persona, language: lang })}
                className={`px-4 py-2 rounded-lg ${
                  persona.language === lang
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 인사말 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            인사말 템플릿
          </label>
          <input
            type="text"
            value={persona.greeting}
            onChange={(e) => setPersona({ ...persona, greeting: e.target.value })}
            placeholder="{userTitle}, 안녕하세요!"
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          />
          <p className={`text-sm mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {'{userTitle}'} = 호칭, {'{userName}'} = 실제 이름
          </p>
        </motion.div>

        {/* 추가 지시사항 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
        >
          <label className={`block font-medium mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            추가 지시사항 (선택)
          </label>
          <textarea
            value={persona.customInstructions}
            onChange={(e) => setPersona({ ...persona, customInstructions: e.target.value })}
            placeholder="예: 코드 설명할 때는 항상 예제를 포함해줘..."
            rows={4}
            className={`w-full px-4 py-3 rounded-lg border resize-none ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          />
        </motion.div>

        {/* 미리보기 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-blue-50 border-blue-200'}`}
        >
          <label className={`block font-medium mb-3 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            미리보기
          </label>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
            <p className={`${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              {generatePreview()}
            </p>
          </div>
        </motion.div>

        {/* 버튼들 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            저장
          </button>

          <button
            onClick={handleReset}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            기본값으로
          </button>

          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes('실패') ? 'text-red-500' : 'text-green-500'}`}>
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
