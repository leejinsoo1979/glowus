'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Link2, Palette, Bell, Shield, Loader2, Key } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'

const settingsSections = [
  {
    id: 'api-keys',
    name: 'API 키 관리',
    description: 'LLM 모델 API 키를 등록하고 관리',
    icon: Key,
    href: '/dashboard-group/settings/api-keys',
    color: 'bg-purple-500/10 text-purple-500'
  },
  {
    id: 'integrations',
    name: '통합 설정',
    description: '외부 서비스와 연동하여 워크플로우를 자동화',
    icon: Link2,
    href: '/dashboard-group/settings/integrations',
    color: 'bg-accent/10 text-accent'
  },
  {
    id: 'appearance',
    name: '테마 설정',
    description: '다크/라이트 모드 및 강조 색상 변경',
    icon: Palette,
    href: null, // 테마는 헤더의 ThemeDropdown에서 설정
    color: 'bg-accent/10 text-accent'
  },
  {
    id: 'notifications',
    name: '알림 설정',
    description: '이메일 및 푸시 알림 환경 설정',
    icon: Bell,
    href: null, // 준비 중
    color: 'bg-accent/10 text-accent',
    comingSoon: true
  },
  {
    id: 'security',
    name: '보안 설정',
    description: '비밀번호 변경 및 2단계 인증',
    icon: Shield,
    href: null, // 준비 중
    color: 'bg-accent/10 text-accent',
    comingSoon: true
  }
]

export default function SettingsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
            <Settings className={`w-6 h-6 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
          </div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            설정
          </h1>
        </div>
        <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          앱 환경 설정 및 연동 관리
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            {section.href ? (
              <button
                onClick={() => router.push(section.href)}
                className={`w-full text-left p-6 rounded-xl border transition-all hover:scale-[1.02] ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${section.color}`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      {section.name}
                    </h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </button>
            ) : section.comingSoon ? (
              <div
                className={`p-6 rounded-xl border opacity-60 cursor-not-allowed ${
                  isDark
                    ? 'bg-zinc-900/50 border-zinc-800'
                    : 'bg-zinc-100/50 border-zinc-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${section.color} opacity-50`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {section.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 bg-zinc-500/20 text-zinc-500 rounded-full">
                        준비 중
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`p-6 rounded-xl border ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800'
                    : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${section.color}`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      {section.name}
                    </h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {section.description}
                    </p>
                    <p className={`text-xs mt-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      헤더의 <span className="font-medium">설정 아이콘</span>을 클릭하세요
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
