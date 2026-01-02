'use client'

import { useState } from 'react'
import VoiceCallButton from '@/components/voice/VoiceCallButton'
import VoiceCallPanel from '@/components/voice/VoiceCallPanel'
import { Phone, Settings } from 'lucide-react'

const VOICES = [
  { name: 'Kore', label: 'Kore (여성, 따뜻함)' },
  { name: 'Puck', label: 'Puck (남성, 친근함)' },
  { name: 'Charon', label: 'Charon (남성, 전문적)' },
  { name: 'Fenrir', label: 'Fenrir (남성, 깊음)' },
  { name: 'Aoede', label: 'Aoede (여성, 밝음)' },
  { name: 'Ara', label: 'Ara (여성, 표현력)' },
  { name: 'Eve', label: 'Eve (여성, 표현력)' },
  { name: 'Leo', label: 'Leo (남성, 표현력)' },
]

export default function TestVoicePage() {
  const [isCallOpen, setIsCallOpen] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('Kore')
  const [systemPrompt, setSystemPrompt] = useState(
    '당신은 친절하고 도움이 되는 AI 비서입니다. 한국어로 자연스럽게 대화해주세요. 사용자의 질문에 간결하고 명확하게 답변해주세요.'
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎙️ Gemini Live 음성 통화 테스트</h1>
        <p className="text-gray-400 mb-8">
          Gemini Live API를 사용한 실시간 음성 대화 기능입니다.
        </p>

        {/* 설정 섹션 */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            설정
          </h2>

          {/* 음성 선택 */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">음성 선택</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
            >
              {VOICES.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>

          {/* 시스템 프롬프트 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">시스템 프롬프트</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none resize-none"
              placeholder="AI의 성격과 역할을 정의하세요..."
            />
          </div>
        </div>

        {/* 통화 시작 버튼 */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={() => setIsCallOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all"
          >
            <Phone className="w-6 h-6" />
            음성 통화 시작
          </button>

          <p className="text-sm text-gray-500">
            또는 오른쪽 하단의 버튼을 클릭하세요
          </p>
        </div>

        {/* 사용법 */}
        <div className="mt-12 bg-gray-900/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">📖 사용 방법</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-400">
            <li>통화 시작 버튼을 클릭합니다</li>
            <li>마이크 버튼을 클릭하여 음성 인식을 시작합니다</li>
            <li>말을 하면 AI가 듣고 응답합니다</li>
            <li>채팅 모드로 전환하여 텍스트로도 대화할 수 있습니다</li>
            <li>빨간 버튼을 눌러 통화를 종료합니다</li>
          </ol>
        </div>

        {/* 기술 스택 */}
        <div className="mt-8 bg-gray-900/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">🛠️ 기술 스택</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-blue-400 font-medium">AI 모델</div>
              <div className="text-gray-400">Gemini 2.0 Flash</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-green-400 font-medium">음성 인식</div>
              <div className="text-gray-400">Web Speech API</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-purple-400 font-medium">음성 합성</div>
              <div className="text-gray-400">Web Speech TTS</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-orange-400 font-medium">비용</div>
              <div className="text-gray-400">~$0.025/분</div>
            </div>
          </div>
        </div>
      </div>

      {/* 플로팅 버튼 */}
      <div className="fixed bottom-8 right-8">
        <VoiceCallButton
          agentName="GlowUS AI"
          systemPrompt={systemPrompt}
          voice={selectedVoice}
          size="lg"
        />
      </div>

      {/* 통화 패널 */}
      <VoiceCallPanel
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        agentName="GlowUS AI"
        systemPrompt={systemPrompt}
        voice={selectedVoice}
      />
    </div>
  )
}
