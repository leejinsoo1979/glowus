'use client'

import { Mail, Phone, Calendar, MapPin } from 'lucide-react'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

export interface MemberProfileData {
  id: string
  name: string
  title: string
  avatar?: string
  avatarGradient?: string
  email: string
  phone?: string
  birthday?: string
  location?: string
  joinedAt?: string
  isOnline?: boolean
  social?: {
    github?: string
    twitter?: string
    linkedin?: string
  }
}

interface MemberProfileSidebarProps {
  data: MemberProfileData
  className?: string
}

export function MemberProfileSidebar({ data, className }: MemberProfileSidebarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <aside className={cn(
      'w-full rounded-2xl border p-6 md:p-8',
      isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200',
      className
    )}>
      {/* Profile Image */}
      <div className="flex flex-col items-center">
        <div className="relative mb-5 md:mb-8">
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/20 via-accent/5 to-transparent animate-pulse" />
            <div className={cn(
              'absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              {data.avatar ? (
                <img
                  src={data.avatar}
                  alt={data.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={cn(
                  "w-full h-full flex items-center justify-center text-3xl md:text-4xl font-bold text-white",
                  "bg-gradient-to-br",
                  data.avatarGradient || "from-violet-500 to-purple-600"
                )}>
                  {getInitials(data.name)}
                </div>
              )}
            </div>
            {/* Online indicator */}
            {data.isOnline !== undefined && (
              <div className={cn(
                "absolute bottom-1 right-1 w-5 h-5 rounded-full border-3 border-white dark:border-zinc-950",
                data.isOnline ? "bg-green-500" : "bg-zinc-400"
              )} />
            )}
          </div>
        </div>

        <h1 className={cn(
          'text-2xl md:text-3xl font-bold mb-2',
          isDark ? 'text-white' : 'text-zinc-900'
        )}>
          {data.name}
        </h1>
        <p className={cn(
          'text-sm px-4 py-1.5 rounded-lg',
          isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
        )}>
          {data.title}
        </p>
      </div>

      {/* Divider */}
      <div className={cn('h-px my-6 md:my-8', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />

      {/* Contact Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>이메일</p>
            <a
              href={`mailto:${data.email}`}
              className={cn(
                'text-sm hover:text-accent transition-colors break-all',
                isDark ? 'text-zinc-200' : 'text-zinc-700'
              )}
            >
              {data.email}
            </a>
          </div>
        </div>

        {data.phone && (
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <Phone className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>연락처</p>
              <a
                href={`tel:${data.phone.replace(/\s/g, '')}`}
                className={cn(
                  'text-sm hover:text-accent transition-colors',
                  isDark ? 'text-zinc-200' : 'text-zinc-700'
                )}
              >
                {data.phone}
              </a>
            </div>
          </div>
        )}

        {data.birthday && (
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>생년월일</p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{data.birthday}</p>
            </div>
          </div>
        )}

        {data.location && (
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>위치</p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{data.location}</p>
            </div>
          </div>
        )}

        {data.joinedAt && (
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>가입일</p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{data.joinedAt}</p>
            </div>
          </div>
        )}
      </div>

      {/* Social Links */}
      {data.social && (data.social.github || data.social.twitter || data.social.linkedin) && (
        <div className={cn(
          'flex items-center justify-center gap-4 mt-6 md:mt-8 pt-6 md:pt-8 border-t',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}>
          {data.social.github && (
            <a
              href={data.social.github}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
                  : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
              )}
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          )}
          {data.social.twitter && (
            <a
              href={data.social.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
                  : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
              )}
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
          )}
          {data.social.linkedin && (
            <a
              href={data.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
                  : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
              )}
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          )}
        </div>
      )}
    </aside>
  )
}
