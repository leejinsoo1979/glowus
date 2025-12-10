'use client'

import Link from 'next/link'
import { Button, Logo } from '@/components/ui'
import { UnifiedThemePicker } from '@/components/ui/unified-theme-picker'
import { PricingSection } from '@/components/ui/pricing-section'
import { Footer } from '@/components/ui/footer-section'
import { AnimeNavBar } from '@/components/ui/anime-navbar'
import { ArrowRight, ArrowLeft } from 'lucide-react'

export default function PricingPage() {
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
                { name: "FUNCTION", url: "/#features" },
                { name: "PRICE", url: "/pricing" },
                { name: "FORUM", url: "/#forum" },
                { name: "REVIEW", url: "/#case-studies" },
                { name: "CONTACT", url: "/#contact" },
              ]}
              defaultActive="PRICE"
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

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 sm:px-10 lg:px-16 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-950 dark:to-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            팀 규모와 필요에 맞는 요금제를 선택하세요.
            모든 플랜에서 14일 무료 체험이 가능합니다.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* FAQ Section */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-gray-50 dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 text-center mb-12">
            자주 묻는 질문
          </h2>
          <div className="space-y-6">
            {[
              {
                question: '무료 체험은 어떻게 시작하나요?',
                answer: '회원가입만 하면 14일간 Pro 플랜의 모든 기능을 무료로 체험할 수 있습니다. 신용카드 정보 없이도 시작 가능합니다.',
              },
              {
                question: '언제든지 플랜을 변경할 수 있나요?',
                answer: '네, 언제든지 업그레이드 또는 다운그레이드가 가능합니다. 변경 시점부터 새로운 요금이 적용됩니다.',
              },
              {
                question: '환불 정책은 어떻게 되나요?',
                answer: '결제 후 7일 이내에 요청하시면 전액 환불해드립니다. 7일 이후에는 일할 계산으로 환불됩니다.',
              },
              {
                question: 'Enterprise 플랜은 어떻게 이용하나요?',
                answer: '영업팀에 문의해 주시면 기업 맞춤 견적과 함께 전담 매니저가 배정됩니다.',
              },
            ].map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800"
              >
                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                  {faq.question}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 bg-accent-gradient">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-white/80 mb-10">
            14일 무료 체험으로 GlowUS의 모든 기능을 경험해보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth-group/signup">
              <Button size="lg" variant="secondary" className="bg-white text-zinc-900 hover:bg-zinc-100">
                무료로 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <ArrowLeft className="mr-2 w-5 h-5" />
                홈으로 돌아가기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
