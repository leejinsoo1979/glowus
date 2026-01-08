'use client'

import React from 'react'
import Link from 'next/link'
import { Button, Logo } from '@/components/ui'
import { UnifiedThemePicker } from '@/components/ui/unified-theme-picker'
import { PricingSection } from '@/components/ui/pricing'
import { Footer } from '@/components/ui/footer-section'
import { AnimeNavBar } from '@/components/ui/anime-navbar'
import { Check, X, Sparkles, FileText, LayoutGrid, Calculator, Users, TrendingUp, MessageSquare, Settings, HeadphonesIcon } from 'lucide-react'

// GlowUS 구독 플랜 - 스타트업 올인원 Founders OS
const PLANS = [
  {
    name: 'Basic',
    price: '26000',
    yearlyPrice: '20800',
    period: '월',
    description: '1인당 월 ₩26,000 • 스타트업 필수 기능',
    buttonText: '구독하기',
    href: '/auth-group/signup',
    isPopular: false,
    features: [
      '월 30,000 크레딧',
      '뉴럴에디터 (500노드)',
      '정부지원사업 AI 매칭',
      'AI Apps (Docs/Sheet/Slides)',
      '기본 ERP & 회계',
    ],
  },
  {
    name: 'Pro',
    price: '65000',
    yearlyPrice: '52000',
    period: '월',
    description: '1인당 월 ₩65,000 • 성장하는 스타트업',
    buttonText: '14일 무료 체험',
    href: '/auth-group/signup',
    isPopular: true,
    features: [
      '월 100,000 크레딧',
      '뉴럴에디터 (10,000노드)',
      'ERP/HR/회계 전체 기능',
      '투자자 관리 & IR',
      '다중 에이전트 협업',
      'API 10,000콜/월',
    ],
  },
  {
    name: 'Enterprise',
    price: '260000',
    yearlyPrice: '208000',
    period: '월',
    description: '1인당 월 ₩260,000 • 스케일업 기업',
    buttonText: '문의하기',
    href: '/contact',
    isPopular: false,
    features: [
      '무제한 크레딧',
      '뉴럴에디터 무제한',
      '커스텀 에이전트 생성',
      'AI Agent Builder',
      '온프레미스 배포',
      '전담 매니저 & SLA',
    ],
  },
]

// 기능 비교표 데이터
const FEATURE_COMPARISON = [
  {
    category: '뉴럴에디터',
    icon: 'Sparkles',
    features: [
      { name: '3D 지식 그래프 (Neural Map)', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: 'AI 실시간 문서/코드 편집', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: '자연어 명령 편집', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: '노드 자동 연결 & 클러스터링', basic: '500노드', pro: '10,000노드', enterprise: '무제한' },
      { name: '에이전트 협업 (다중 AI)', basic: false, pro: true, enterprise: true },
      { name: '커스텀 에이전트 생성', basic: false, pro: false, enterprise: true },
      { name: 'AI Agent Builder', basic: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'AI 에이전트',
    icon: 'Sparkles',
    features: [
      { name: '월간 크레딧', basic: '30,000', pro: '100,000', enterprise: '무제한' },
      { name: 'AI 에이전트 채팅', basic: true, pro: true, enterprise: true },
      { name: '에이전트 API 연동', basic: false, pro: '10,000콜/월', enterprise: '무제한' },
    ],
  },
  {
    category: '정부지원사업',
    icon: 'FileText',
    features: [
      { name: 'AI 매칭', basic: true, pro: true, enterprise: true },
      { name: '사업계획서 AI 생성', basic: '50회/월', pro: '무제한', enterprise: '무제한' },
      { name: '전문가 검토', basic: false, pro: false, enterprise: true },
      { name: '공고 북마크 & 알림', basic: true, pro: true, enterprise: true },
      { name: '실시간 알림 (카카오/SMS)', basic: false, pro: true, enterprise: true },
      { name: '지원서류 자동 생성', basic: false, pro: true, enterprise: true },
    ],
  },
  {
    category: 'AI Apps',
    icon: 'LayoutGrid',
    features: [
      { name: 'AI Docs (문서 작성)', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: 'AI Sheet (스프레드시트)', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: 'AI Slides (프레젠테이션)', basic: true, pro: '무제한', enterprise: '무제한' },
      { name: 'AI 이미지 생성', basic: false, pro: true, enterprise: '무제한' },
      { name: 'AI 요약 & 분석', basic: false, pro: true, enterprise: '무제한' },
    ],
  },
  {
    category: 'ERP / 회계',
    icon: 'Calculator',
    features: [
      { name: '매출/매입 관리', basic: '기본', pro: '전체', enterprise: '전체' },
      { name: '세금계산서 발행', basic: '10건/월', pro: '무제한', enterprise: '무제한' },
      { name: '카드 매출 연동', basic: false, pro: true, enterprise: true },
      { name: '거래처 관리', basic: '50개', pro: '무제한', enterprise: '무제한' },
      { name: '손익 분석', basic: false, pro: true, enterprise: true },
      { name: '재무제표 자동 생성', basic: false, pro: false, enterprise: true },
      { name: '다중 법인 관리', basic: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'HR / 급여',
    icon: 'Users',
    features: [
      { name: '직원 관리', basic: false, pro: true, enterprise: true },
      { name: '급여 관리', basic: false, pro: true, enterprise: true },
      { name: '근태 관리', basic: false, pro: true, enterprise: true },
      { name: '휴가 관리', basic: false, pro: true, enterprise: true },
      { name: '경비 청구', basic: false, pro: true, enterprise: true },
      { name: '예산 관리', basic: false, pro: true, enterprise: true },
    ],
  },
  {
    category: '투자자 관리',
    icon: 'TrendingUp',
    features: [
      { name: '투자자 탐색', basic: false, pro: true, enterprise: true },
      { name: 'IR 자료 생성', basic: false, pro: true, enterprise: true },
      { name: '투자 파이프라인', basic: false, pro: true, enterprise: true },
    ],
  },
  {
    category: '협업 도구',
    icon: 'MessageSquare',
    features: [
      { name: '캘린더 & 일정관리', basic: true, pro: true, enterprise: true },
      { name: '메신저', basic: false, pro: true, enterprise: true },
      { name: '화상회의', basic: false, pro: true, enterprise: true },
    ],
  },
  {
    category: '고급 기능',
    icon: 'Settings',
    features: [
      { name: 'AI Agent Builder', basic: false, pro: false, enterprise: true },
      { name: '커스텀 워크플로우', basic: false, pro: false, enterprise: true },
      { name: 'API 액세스', basic: false, pro: '10,000콜/월', enterprise: '무제한' },
      { name: 'SSO/SAML 인증', basic: false, pro: false, enterprise: true },
      { name: '온프레미스 배포', basic: false, pro: false, enterprise: true },
    ],
  },
  {
    category: '지원',
    icon: 'HeadphonesIcon',
    features: [
      { name: '이메일 지원', basic: true, pro: true, enterprise: true },
      { name: '우선 지원', basic: false, pro: true, enterprise: true },
      { name: '전담 매니저', basic: false, pro: false, enterprise: true },
      { name: 'SLA 보장', basic: false, pro: false, enterprise: '99.9%' },
      { name: '맞춤 교육 & 온보딩', basic: false, pro: false, enterprise: true },
    ],
  },
]

// 아이콘 매핑
const iconMap: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  LayoutGrid: <LayoutGrid className="w-5 h-5" />,
  Calculator: <Calculator className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  MessageSquare: <MessageSquare className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
  HeadphonesIcon: <HeadphonesIcon className="w-5 h-5" />,
}

// 값 렌더링 헬퍼
function renderValue(value: boolean | string) {
  if (value === true) return <Check className="w-5 h-5 text-green-500 mx-auto" />
  if (value === false) return <X className="w-5 h-5 text-muted-foreground/30 mx-auto" />
  return <span className="text-sm font-medium">{value}</span>
}

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

      {/* Pricing Section */}
      <div className="pt-16">
        <PricingSection
          plans={PLANS}
          title="GlowUS 요금제"
          description="스타트업을 위한 올인원 Founders OS"
        />
      </div>

      {/* 기능 비교표 */}
      <div className="container mx-auto px-4 py-20 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">
            플랜별 기능 비교
          </h2>
          <p className="text-muted-foreground text-center mb-4">
            모든 요금제는 1인당 과금이며, 추가 사용자도 동일 요금이 적용됩니다
          </p>
          <p className="text-sm text-muted-foreground text-center mb-12">
            예) Pro 플랜 5명 사용 시 → ₩65,000 × 5 = ₩325,000/월
          </p>

          {/* 플랜 헤더 - sticky */}
          <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-4 mb-8">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-sm font-medium text-muted-foreground">기능</div>
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">Basic</div>
                <div className="text-sm text-muted-foreground">₩26,000/월</div>
              </div>
              <div className="text-center relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-medium">
                  추천
                </div>
                <div className="text-lg font-bold text-foreground">Pro</div>
                <div className="text-sm text-muted-foreground">₩65,000/월</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">Enterprise</div>
                <div className="text-sm text-muted-foreground">₩260,000/월</div>
              </div>
            </div>
          </div>

          {/* 카테고리별 섹션 */}
          <div className="space-y-0">
            {FEATURE_COMPARISON.map((section, sectionIdx) => {
              return (
                <div
                  key={`section-${sectionIdx}`}
                  className="border-t border-border/50 pt-6 pb-4"
                >
                  {/* 카테고리 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-emerald-400">
                      {iconMap[section.icon]}
                    </span>
                    <h3 className="text-base font-bold text-emerald-400">
                      {section.category}
                    </h3>
                  </div>

                  {/* 기능 목록 */}
                  <div className="space-y-1">
                    {section.features.map((feature, featureIdx) => (
                      <div
                        key={`feature-${sectionIdx}-${featureIdx}`}
                        className="grid grid-cols-4 gap-4 py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-sm text-muted-foreground">
                          {feature.name}
                        </div>
                        <div className="text-center text-sm">
                          {renderValue(feature.basic)}
                        </div>
                        <div className="text-center text-sm">
                          {renderValue(feature.pro)}
                        </div>
                        <div className="text-center text-sm">
                          {renderValue(feature.enterprise)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="container mx-auto px-4 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">자주 묻는 질문</h2>
          <p className="text-muted-foreground text-center mb-12">궁금한 점이 있으시면 언제든 문의해주세요</p>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                q: 'GlowUS가 뭔가요?',
                a: '스타트업을 위한 올인원 Founders OS입니다. 뉴럴에디터, 정부지원사업 매칭, ERP/회계, HR/급여, 투자자 관리, AI Apps까지 창업에 필요한 모든 기능을 하나의 플랫폼에서 제공합니다.',
                highlight: true,
              },
              {
                q: '뉴럴에디터가 뭔가요?',
                a: '옵시디언 + 커서 + 에이전트빌더가 합쳐진 AI 에디터입니다. 3D 지식 그래프로 문서를 시각화하고, AI가 자연어 명령으로 편집합니다.',
              },
              {
                q: '14일 무료 체험이 있나요?',
                a: '네, Pro 플랜을 14일간 무료로 체험할 수 있습니다. 신용카드 없이 시작 가능하며, 언제든 취소할 수 있습니다.',
              },
              {
                q: 'ERP/HR 기능은 뭐가 있나요?',
                a: '매출/매입 관리, 세금계산서, 재무제표, 직원/급여/근태 관리, 휴가/경비 청구까지 스타트업 운영에 필요한 전체 기능을 제공합니다.',
              },
              {
                q: '크레딧은 어떻게 사용되나요?',
                a: 'AI 에이전트 채팅, 사업계획서 생성, AI Apps 사용 시 차감됩니다. ERP, HR 등 기본 기능은 크레딧 없이 이용 가능합니다.',
              },
              {
                q: '구독은 언제든 취소할 수 있나요?',
                a: '네, 언제든지 취소 가능합니다. 취소 후에도 결제 기간 끝까지 이용 가능하며, 데이터는 30일간 보관됩니다.',
              },
              {
                q: '투자자 관리 기능은요?',
                a: '투자자 탐색, IR 자료 자동 생성, 투자 파이프라인 관리까지 펀드레이징에 필요한 기능을 Pro 플랜부터 사용할 수 있습니다.',
              },
              {
                q: 'API 연동은 어떻게 하나요?',
                a: 'Pro 플랜에서 월 10,000콜, Enterprise에서 무제한 API 호출이 가능합니다. 자체 시스템과 GlowUS 에이전트를 연동할 수 있습니다.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className={`rounded-xl p-5 transition-all hover:shadow-md ${
                  faq.highlight
                    ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20'
                    : 'bg-muted/30 border border-border/50 hover:border-border'
                }`}
              >
                <h3 className={`font-semibold mb-2 ${faq.highlight ? 'text-emerald-400' : 'text-foreground'}`}>
                  {faq.q}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
