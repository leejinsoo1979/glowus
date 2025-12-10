'use client'

import { motion } from 'framer-motion'
import { MessageSquare, ThumbsUp, Eye, TrendingUp, Lightbulb, HelpCircle, Megaphone, ArrowRight } from 'lucide-react'

interface ForumPost {
  id: string
  title: string
  category: 'discussion' | 'question' | 'announcement' | 'idea'
  author: string
  authorAvatar: string
  likes: number
  views: number
  replies: number
  timeAgo: string
}

const forumPosts: ForumPost[] = [
  {
    id: '1',
    title: '시리즈 A 투자 유치 경험 공유합니다',
    category: 'discussion',
    author: '김창업',
    authorAvatar: 'KC',
    likes: 128,
    views: 2340,
    replies: 45,
    timeAgo: '2시간 전',
  },
  {
    id: '2',
    title: 'B2B SaaS 가격 책정 전략 어떻게 하시나요?',
    category: 'question',
    author: '이스타트',
    authorAvatar: 'LS',
    likes: 89,
    views: 1560,
    replies: 32,
    timeAgo: '5시간 전',
  },
  {
    id: '3',
    title: '신규 기능 출시: AI 기반 팀 생산성 분석',
    category: 'announcement',
    author: 'GlowUS Team',
    authorAvatar: 'GT',
    likes: 256,
    views: 4120,
    replies: 67,
    timeAgo: '1일 전',
  },
  {
    id: '4',
    title: '원격 팀 관리를 위한 비동기 커뮤니케이션 팁',
    category: 'idea',
    author: '박원격',
    authorAvatar: 'PW',
    likes: 167,
    views: 2890,
    replies: 54,
    timeAgo: '2일 전',
  },
]

const categoryConfig = {
  discussion: { icon: MessageSquare, label: '토론', color: 'bg-accent/10 text-accent' },
  question: { icon: HelpCircle, label: '질문', color: 'bg-purple-500/10 text-purple-400' },
  announcement: { icon: Megaphone, label: '공지', color: 'bg-green-500/10 text-green-400' },
  idea: { icon: Lightbulb, label: '아이디어', color: 'bg-yellow-500/10 text-yellow-400' },
}

const stats = [
  { label: '활성 멤버', value: '2,500+' },
  { label: '게시글', value: '12,000+' },
  { label: '답변율', value: '94%' },
]

export function ForumSection() {
  return (
    <section id="forum" className="py-24 bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent mb-4"
            >
              커뮤니티
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4"
            >
              창업자들의 지식 공유 포럼
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-zinc-600 dark:text-zinc-400"
            >
              경험 많은 창업자들과 인사이트를 나누고, 성장의 기회를 발견하세요.
            </motion.p>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex gap-8"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
                <p className="text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Forum Posts Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {forumPosts.map((post, index) => {
            const config = categoryConfig[post.category]
            const Icon = config.icon

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 hover:border-accent/50 transition-colors cursor-pointer group"
              >
                {/* Category Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                  <span className="text-xs text-zinc-500">{post.timeAgo}</span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 group-hover:text-accent transition-colors line-clamp-2">
                  {post.title}
                </h3>

                {/* Author & Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/70 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{post.authorAvatar}</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {post.author}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {post.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {post.replies}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <a
            href="#"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors"
          >
            포럼 둘러보기
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="mt-4 text-sm text-zinc-500">
            회원가입 후 모든 게시글을 읽고 토론에 참여할 수 있습니다
          </p>
        </motion.div>

        {/* Trending Topics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-8 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              인기 토픽
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              '시리즈A',
              '투자유치',
              'PMF',
              'B2B SaaS',
              '팀빌딩',
              '프로덕트',
              '그로스해킹',
              '수익화',
              '피벗',
              'MVP',
              '마케팅',
              '리텐션',
            ].map((topic) => (
              <span
                key={topic}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full text-sm font-medium hover:bg-accent/10 hover:text-accent cursor-pointer transition-colors"
              >
                #{topic}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
