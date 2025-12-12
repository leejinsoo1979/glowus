'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberProfileSidebar, MemberProfileData } from '@/components/team/MemberProfileSidebar'
import { MemberAboutSection, MemberAboutData } from '@/components/team/MemberAboutSection'

// 더미 멤버 데이터
const dummyMembersData: Record<string, { profile: MemberProfileData; about: MemberAboutData }> = {
  '1': {
    profile: {
      id: '1',
      name: '김진수',
      title: 'CEO',
      email: 'jinsu@example.com',
      phone: '010-1234-5678',
      location: '서울, 대한민국',
      joinedAt: '2024년 3월',
      isOnline: true,
      avatarGradient: 'from-violet-500 to-purple-600',
      social: {
        github: 'https://github.com',
        twitter: 'https://twitter.com',
        linkedin: 'https://linkedin.com',
      },
    },
    about: {
      bio: [
        '스타트업의 비전을 현실로 만드는 열정적인 창업가입니다.',
        '팀을 이끌며 지속 가능한 성장을 추구합니다. 기술과 비즈니스의 교차점에서 혁신적인 솔루션을 만들어가고 있습니다.',
      ],
      role: 'admin',
      skills: ['리더십', '전략', '비즈니스', '투자 유치', '팀 빌딩'],
      stats: {
        commits: 156,
        tasksCompleted: 89,
        hoursWorked: 420,
        streak: 21,
      },
    },
  },
  '2': {
    profile: {
      id: '2',
      name: '이수진',
      title: '개발팀장',
      email: 'sujin@example.com',
      phone: '010-2345-6789',
      location: '서울, 대한민국',
      joinedAt: '2024년 4월',
      isOnline: true,
      avatarGradient: 'from-blue-500 to-cyan-500',
      social: {
        github: 'https://github.com',
      },
    },
    about: {
      bio: [
        '10년 이상의 소프트웨어 개발 경험을 보유한 개발팀장입니다.',
        '확장 가능한 시스템 아키텍처 설계와 팀원 멘토링에 집중하고 있습니다.',
      ],
      role: 'member',
      skills: ['React', 'TypeScript', 'Node.js', 'System Design', 'Team Leadership'],
      stats: {
        commits: 342,
        tasksCompleted: 127,
        hoursWorked: 580,
        streak: 14,
      },
    },
  },
  '3': {
    profile: {
      id: '3',
      name: '박민호',
      title: '프론트엔드 개발자',
      email: 'minho@example.com',
      phone: '010-3456-7890',
      location: '서울, 대한민국',
      joinedAt: '2024년 5월',
      isOnline: false,
      avatarGradient: 'from-emerald-500 to-teal-500',
      social: {
        github: 'https://github.com',
      },
    },
    about: {
      bio: [
        '사용자 경험에 집중하는 프론트엔드 개발자입니다.',
        '최신 웹 기술을 활용하여 빠르고 아름다운 UI를 구현합니다.',
      ],
      role: 'member',
      skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Framer Motion'],
      stats: {
        commits: 256,
        tasksCompleted: 78,
        hoursWorked: 320,
        streak: 7,
      },
    },
  },
  '4': {
    profile: {
      id: '4',
      name: '정유진',
      title: '디자이너',
      email: 'yujin@example.com',
      phone: '010-4567-8901',
      location: '서울, 대한민국',
      joinedAt: '2024년 5월',
      isOnline: true,
      avatarGradient: 'from-orange-500 to-amber-500',
      social: {
        twitter: 'https://twitter.com',
        linkedin: 'https://linkedin.com',
      },
    },
    about: {
      bio: [
        '사용자 중심 디자인을 추구하는 UI/UX 디자이너입니다.',
        '제품의 본질을 아름답고 직관적으로 표현하는 것을 목표로 합니다.',
      ],
      role: 'member',
      skills: ['Figma', 'UI/UX', 'Prototyping', 'Design System', 'User Research'],
      stats: {
        commits: 45,
        tasksCompleted: 92,
        hoursWorked: 380,
        streak: 12,
      },
    },
  },
  '5': {
    profile: {
      id: '5',
      name: '최서연',
      title: '마케팅',
      email: 'seoyeon@example.com',
      phone: '010-5678-9012',
      location: '서울, 대한민국',
      joinedAt: '2024년 6월',
      isOnline: false,
      avatarGradient: 'from-pink-500 to-rose-500',
      social: {
        twitter: 'https://twitter.com',
        linkedin: 'https://linkedin.com',
      },
    },
    about: {
      bio: [
        '데이터 기반 마케팅 전략을 수립하고 실행합니다.',
        '브랜드 스토리텔링과 그로스 해킹을 통해 지속적인 성장을 이끌어냅니다.',
      ],
      role: 'viewer',
      skills: ['마케팅', '데이터 분석', '콘텐츠', 'SEO', 'Growth Hacking'],
      stats: {
        commits: 12,
        tasksCompleted: 54,
        hoursWorked: 280,
        streak: 5,
      },
    },
  },
}

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const memberId = params.id as string
  const memberData = dummyMembersData[memberId]

  if (!memberData) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className={cn(
            'text-2xl font-bold mb-4',
            isDark ? 'text-white' : 'text-zinc-900'
          )}>
            멤버를 찾을 수 없습니다
          </h1>
          <button
            onClick={() => router.back()}
            className="text-accent hover:underline"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm">팀원 목록으로 돌아가기</span>
      </motion.button>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-stretch gap-6"
      >
        {/* Profile Sidebar */}
        <div className="w-full lg:w-[35%] lg:min-w-[320px] lg:max-w-[400px] lg:h-auto">
          <MemberProfileSidebar data={memberData.profile} className="lg:h-full" />
        </div>

        {/* Main Section */}
        <main className={cn(
          'flex-1 rounded-xl md:rounded-2xl border overflow-hidden',
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="p-6 md:p-8">
            <MemberAboutSection data={memberData.about} />

            {/* Action Buttons */}
            <div className={cn(
              'flex items-center gap-3 mt-8 pt-8 border-t',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}>
              <button className={cn(
                "flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2",
                "bg-accent hover:opacity-90 transition-opacity"
              )}>
                <MessageCircle className="w-5 h-5" />
                메시지 보내기
              </button>
              <button className={cn(
                "px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors",
                isDark
                  ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              )}>
                <Mail className="w-5 h-5" />
                이메일
              </button>
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  )
}
