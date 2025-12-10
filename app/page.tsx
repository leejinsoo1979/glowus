import Link from 'next/link'
import { Button } from '@/components/ui'
import { 
  BarChart3, 
  Users, 
  Zap, 
  Shield, 
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-zinc-100">StartupShow</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth-group/login">
                <Button variant="ghost">로그인</Button>
              </Link>
              <Link href="/auth-group/signup">
                <Button>시작하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 rounded-full text-primary-400 text-sm font-medium mb-8 border border-primary-500/20">
            <Sparkles className="w-4 h-4" />
            AI 기반 스타트업 운영 플랫폼
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-zinc-100 mb-6 tracking-tight">
            자기 관리가 곧<br />
            <span className="text-primary-400">자기 홍보</span>가 됩니다
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            일상의 업무 기록이 자동으로 투자자에게 보여지는 IR 자료가 됩니다.
            스타트업쇼와 함께 성장하세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth-group/signup">
              <Button size="lg" className="w-full sm:w-auto">
                무료로 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              데모 보기
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-100 mb-4">
              스타트업을 위한 올인원 플랫폼
            </h2>
            <p className="text-lg text-zinc-400">
              운영 관리부터 투자 유치까지, 모든 것을 한 곳에서
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: BarChart3,
                title: 'KPI 대시보드',
                description: '핵심 지표를 실시간으로 모니터링하고 성과를 추적하세요.',
              },
              {
                icon: Zap,
                title: 'AI 인사이트',
                description: 'AI가 자동으로 프로젝트를 분석하고 병목 구간을 예측합니다.',
              },
              {
                icon: Users,
                title: '투자자 매칭',
                description: 'AI 기반 추천으로 최적의 투자자를 찾고 연결됩니다.',
              },
              {
                icon: Shield,
                title: '투명한 공유',
                description: '원하는 정보만 선택적으로 투자자에게 공개할 수 있습니다.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/50 hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20 transition-all"
              >
                <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-100 mb-4">
              어떻게 작동하나요?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: '업무를 커밋하세요',
                description: 'GitHub처럼 일상의 업무를 커밋 단위로 기록합니다. 간단한 메모 하나로 충분합니다.',
              },
              {
                step: '02',
                title: 'AI가 분석합니다',
                description: '쌓인 커밋들을 AI가 자동으로 분석하여 주간 리포트, 위험 예측, 성과 요약을 생성합니다.',
              },
              {
                step: '03',
                title: '투자자와 연결됩니다',
                description: '준비된 데이터를 기반으로 투자자에게 어필하고, AI 매칭으로 최적의 투자자를 만나세요.',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-zinc-800 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-600 to-primary-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-primary-100 mb-10">
            이미 100+ 스타트업이 StartupShow와 함께 성장하고 있습니다.
          </p>
          <Link href="/auth-group/signup">
            <Button size="lg" variant="secondary">
              무료로 시작하기
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-zinc-100">StartupShow</span>
            </div>
            <p className="text-zinc-500 text-sm">
              © 2024 StartupShow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
