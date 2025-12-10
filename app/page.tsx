'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useScroll, useTransform } from 'framer-motion'
import { Button, Logo } from '@/components/ui'
import { UnifiedThemePicker } from '@/components/ui/unified-theme-picker'
import { SplineScene } from '@/components/ui/spline-scene'
import { Spotlight } from '@/components/ui/spotlight'
import { Footer } from '@/components/ui/footer-section'
import { GoogleGeminiEffect } from '@/components/ui/google-gemini-effect'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { MorphingCardStack } from '@/components/ui/morphing-card-stack'
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline'
import CaseStudies from '@/components/ui/case-studies'
import { AnimatedRoadmap } from '@/components/ui/animated-roadmap'
import { AnimeNavBar } from '@/components/ui/anime-navbar'
import { ForumSection } from '@/components/ui/forum-section'
import {
  BarChart3,
  Users,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  LineChart,
  Brain,
  Lightbulb,
  Rocket,
  CheckCircle
} from 'lucide-react'

export default function LandingPage() {
  const geminiRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: geminiRef,
    offset: ["start start", "end start"],
  })

  const pathLengthFirst = useTransform(scrollYProgress, [0, 0.8], [0.2, 1.2])
  const pathLengthSecond = useTransform(scrollYProgress, [0, 0.8], [0.15, 1.2])
  const pathLengthThird = useTransform(scrollYProgress, [0, 0.8], [0.1, 1.2])
  const pathLengthFourth = useTransform(scrollYProgress, [0, 0.8], [0.05, 1.2])
  const pathLengthFifth = useTransform(scrollYProgress, [0, 0.8], [0, 1.2])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex justify-between items-center h-16">
            <Logo size="lg" href="/" />

            {/* Center Navigation */}
            <AnimeNavBar
              items={[
                { name: "HOME", url: "/" },
                { name: "FUNCTION", url: "#features" },
                { name: "PRICE", url: "/pricing" },
                { name: "FORUM", url: "#forum" },
                { name: "REVIEW", url: "#case-studies" },
                { name: "CONTACT", url: "#contact" },
              ]}
              defaultActive="HOME"
            />

            <div className="flex items-center gap-4">
              <UnifiedThemePicker />
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

      {/* Hero Section with 3D Spline */}
      <section className="relative min-h-screen w-full bg-gray-50 dark:bg-zinc-950 overflow-hidden">
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="white"
        />

        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 h-screen pt-16">
          <div className="flex flex-col lg:flex-row h-full">
            {/* Left Content */}
            <div className="flex-1 relative z-10 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 border bg-accent/10 text-accent border-accent/20 w-fit">
                <Sparkles className="w-4 h-4" />
                AI 기반 스타트업 운영 플랫폼
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 to-neutral-500 dark:from-neutral-50 dark:to-neutral-400 leading-tight">
                Founders OS
                <br />
                <span className="text-accent">Real-Time Growth</span>
              </h1>

              <p className="mt-6 text-lg md:text-xl text-neutral-600 dark:text-neutral-300 max-w-lg">
                일상의 업무 기록이 자동으로 투자자에게 보여지는 IR 자료가 됩니다.
                <span className="font-semibold text-accent">GlowUS</span>와 함께 성장하세요.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <Link href="/auth-group/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    무료로 시작하기
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-accent text-accent hover:bg-accent/10">
                  데모 보기
                </Button>
              </div>
            </div>

            {/* Right Content - 3D Spline */}
            <div className="flex-1 relative hidden lg:block">
              <SplineScene
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards with Morphing Stack */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-gray-100 dark:bg-zinc-900/30">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text Content */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-100">
                스타트업 성장을 위한
                <br />
                <span className="text-accent">핵심 기능들</span>
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-md">
                카드를 스와이프하거나 레이아웃을 변경해서 GlowUS의 다양한 기능을 살펴보세요.
              </p>
              <div className="flex gap-4">
                <Link href="/auth-group/signup">
                  <Button>
                    지금 시작하기
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right - Morphing Card Stack */}
            <div className="flex justify-center">
              <MorphingCardStack
                cards={[
                  {
                    id: "1",
                    title: "실시간 KPI 추적",
                    description: "매출, MAU, 성장률 등 핵심 지표를 실시간으로 모니터링하고 트렌드를 분석하세요.",
                    icon: <LineChart className="h-5 w-5" />,
                  },
                  {
                    id: "2",
                    title: "AI 인사이트",
                    description: "GPT-4 기반 AI가 데이터를 분석하고 성장 전략과 리스크를 예측합니다.",
                    icon: <Brain className="h-5 w-5" />,
                  },
                  {
                    id: "3",
                    title: "목표 설정",
                    description: "팀과 개인의 OKR을 설정하고 달성률을 추적하여 동기를 부여하세요.",
                    icon: <Target className="h-5 w-5" />,
                  },
                  {
                    id: "4",
                    title: "투자자 매칭",
                    description: "AI가 스타트업에 맞는 최적의 투자자를 추천하고 연결해드립니다.",
                    icon: <TrendingUp className="h-5 w-5" />,
                  },
                ]}
                defaultLayout="stack"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview with Scroll Animation */}
      <section className="bg-gradient-to-b from-gray-100 to-white dark:from-black dark:to-zinc-950">
        <ContainerScroll
          titleComponent={
            <>
              <h2 className="text-4xl font-semibold text-zinc-800 dark:text-zinc-100">
                강력한 대시보드로 <br />
                <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-accent">
                  성과를 한눈에
                </span>
              </h2>
            </>
          }
        >
          <div className="h-full w-full bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-950 p-4 md:p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800">
            {/* Mock Dashboard UI */}
            <div className="grid grid-cols-4 gap-4 h-full">
              {/* Sidebar */}
              <div className="col-span-1 bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-4 hidden md:block">
                <div className="w-8 h-8 bg-accent rounded-lg mb-6" />
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`h-8 rounded-lg ${i === 0 ? 'bg-accent/20' : 'bg-gray-200 dark:bg-zinc-700/50'}`} />
                  ))}
                </div>
              </div>
              {/* Main Content */}
              <div className="col-span-4 md:col-span-3 space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['매출', 'MAU', '성장률', 'MRR'].map((stat, i) => (
                    <div key={stat} className="bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-3 md:p-4 border border-gray-200 dark:border-transparent">
                      <div className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">{stat}</div>
                      <div className="text-lg md:text-2xl font-bold text-zinc-800 dark:text-zinc-100">
                        {['₩2.4B', '12.5K', '+34%', '₩180M'][i]}
                      </div>
                      <div className={`text-xs mt-1 ${i === 2 ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                        {i === 2 ? '↑ 12% 전월대비' : '최근 30일'}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Chart Area */}
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-4 flex-1 min-h-[200px] border border-gray-200 dark:border-transparent">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">월별 성장 추이</div>
                  <div className="flex items-end justify-between h-32 gap-2">
                    {[40, 55, 45, 70, 65, 85, 90, 75, 95, 88, 100, 110].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-accent/60 rounded-t-sm transition-all hover:bg-accent"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                {/* Bottom Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-transparent">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">최근 활동</div>
                    <div className="space-y-2">
                      {['새 투자자 미팅 예약', 'KPI 업데이트 완료', '팀원 피드백 수신'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-transparent">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">AI 인사이트</div>
                    <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      &quot;이번 달 성장률이 전월 대비 12% 상승했습니다. 현재 추세라면 Q4 목표 달성 가능성이 높습니다.&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-gray-50 dark:bg-zinc-950">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">
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
                <div className="text-6xl font-bold text-zinc-300 dark:text-zinc-800 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Animated Roadmap - 올인원 플랫폼 */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-white dark:bg-zinc-950">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">
              스타트업을 위한 <span className="text-accent">올인원 플랫폼</span>
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              운영 관리부터 투자 유치까지, GlowUS와 함께 성장 로드맵을 그려보세요
            </p>
          </div>
          <AnimatedRoadmap
            milestones={[
              {
                id: 1,
                name: "팀 셋업",
                description: "팀 구성 및 역할 배정",
                status: "complete",
                position: { top: "75%", left: "3%" },
              },
              {
                id: 2,
                name: "KPI 설정",
                description: "핵심 지표 정의",
                status: "complete",
                position: { top: "25%", left: "18%" },
              },
              {
                id: 3,
                name: "AI 분석",
                description: "데이터 기반 인사이트",
                status: "in-progress",
                position: { top: "50%", left: "48%" },
              },
              {
                id: 4,
                name: "투자 유치",
                description: "투자자 매칭 & IR",
                status: "pending",
                position: { top: "15%", right: "8%" },
              },
            ]}
            aria-label="스타트업 성장 로드맵"
          />
        </div>
      </section>

      {/* Radial Orbital Timeline - Startup Journey */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-white dark:bg-black">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">
              스타트업 <span className="text-accent">성장 여정</span>
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              노드를 클릭해서 각 단계의 세부 정보를 확인하세요. 자동 회전하는 오비탈 뷰로 전체 여정을 한눈에 파악할 수 있습니다.
            </p>
          </div>
          <RadialOrbitalTimeline
            timelineData={[
              {
                id: 1,
                title: "아이디어",
                date: "1단계",
                content: "문제 정의와 솔루션 구상. 시장 조사와 고객 인터뷰를 통해 아이디어를 검증합니다.",
                category: "Planning",
                icon: Lightbulb,
                relatedIds: [2],
                status: "completed" as const,
                energy: 100,
              },
              {
                id: 2,
                title: "MVP 개발",
                date: "2단계",
                content: "최소 기능 제품을 빠르게 개발하여 시장에 출시합니다.",
                category: "Development",
                icon: Rocket,
                relatedIds: [1, 3],
                status: "completed" as const,
                energy: 85,
              },
              {
                id: 3,
                title: "PMF 검증",
                date: "3단계",
                content: "Product-Market Fit을 찾기 위한 반복적인 테스트와 피벗.",
                category: "Validation",
                icon: Target,
                relatedIds: [2, 4],
                status: "in-progress" as const,
                energy: 65,
              },
              {
                id: 4,
                title: "시드 투자",
                date: "4단계",
                content: "첫 투자 유치. 팀 확장과 제품 고도화를 위한 자금 확보.",
                category: "Funding",
                icon: TrendingUp,
                relatedIds: [3, 5],
                status: "pending" as const,
                energy: 40,
              },
              {
                id: 5,
                title: "성장 가속",
                date: "5단계",
                content: "스케일업 단계. 마케팅 확대와 팀 빌딩으로 급성장을 추구합니다.",
                category: "Growth",
                icon: Zap,
                relatedIds: [4, 6],
                status: "pending" as const,
                energy: 20,
              },
              {
                id: 6,
                title: "시리즈 A",
                date: "6단계",
                content: "본격적인 성장을 위한 대규모 투자 유치와 시장 확장.",
                category: "Scale",
                icon: CheckCircle,
                relatedIds: [5],
                status: "pending" as const,
                energy: 10,
              },
            ]}
          />
        </div>
      </section>

      {/* Gemini Scroll Effect */}
      <div
        className="h-[300vh] bg-gray-100 dark:bg-zinc-950 w-full relative overflow-clip"
        ref={geminiRef}
      >
        <GoogleGeminiEffect
          pathLengths={[
            pathLengthFirst,
            pathLengthSecond,
            pathLengthThird,
            pathLengthFourth,
            pathLengthFifth,
          ]}
          title="성장의 여정"
          description="스크롤하면서 GlowUS가 어떻게 스타트업의 성장을 이끄는지 경험하세요"
        />
      </div>

      {/* Forum Section */}
      <ForumSection />

      {/* Case Studies */}
      <section id="case-studies">
        <CaseStudies />
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-accent/90">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-white/80 mb-10">
            이미 100+ 스타트업이 GlowUS와 함께 성장하고 있습니다.
          </p>
          <Link href="/auth-group/signup">
            <Button size="lg" variant="secondary" className="bg-white text-zinc-900 hover:bg-zinc-100">
              무료로 시작하기
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
