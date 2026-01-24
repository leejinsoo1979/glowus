'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Input } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, AlertCircle, ArrowRight, Github, Code2 } from 'lucide-react'

const GoogleIcon = (props: React.ComponentProps<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDevLoading, setIsDevLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/dashboard-group/works')
      router.refresh()
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard-group/works`,
        },
      })
      if (error) {
        setError(`OAuth 로그인 실패: ${error.message}`)
      }
    } catch (e) {
      setError(`OAuth 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    }
  }

  const handleDevLogin = async () => {
    setError('')
    setIsDevLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: 'dev@glowus.app',
        password: 'dev123456',
      })

      if (error) {
        setError('개발자 계정 로그인 실패: ' + error.message)
        return
      }

      router.push('/dashboard-group/works')
      router.refresh()
    } catch {
      setError('개발자 계정 로그인 중 오류가 발생했습니다.')
    } finally {
      setIsDevLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-wide text-zinc-100">
          로그인
        </h1>
        <p className="text-zinc-400 text-base">
          <span className="font-semibold text-accent">GlowUS</span> 계정으로 로그인하세요
        </p>
      </div>

      {/* Error Message */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
          >
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-100"
          onClick={() => handleOAuthLogin('google')}
        >
          <GoogleIcon className="me-2 size-4" />
          Google로 계속하기
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-100"
          onClick={() => handleOAuthLogin('github')}
        >
          <Github strokeWidth={2.5} className="me-2 size-4" />
          GitHub로 계속하기
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full border-amber-600/50 bg-amber-950/30 hover:bg-amber-900/40 text-amber-200"
          onClick={handleDevLogin}
          isLoading={isDevLoading}
        >
          <Code2 strokeWidth={2.5} className="me-2 size-4" />
          개발자 계정 접속
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-950 px-3 text-zinc-500">또는 이메일로</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-5 h-5" />}
          required
        />
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-5 h-5" />}
          showPasswordToggle
          required
        />

        <div className="flex justify-end">
          <Link
            href="/auth-group/forgot-password"
            className="text-sm text-accent hover:text-accent/80 font-medium transition-colors"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full h-12"
          size="lg"
          isLoading={isLoading}
          rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
        >
          로그인
        </Button>
      </form>

      {/* Sign Up Link */}
      <p className="text-sm text-zinc-400 text-center">
        계정이 없으신가요?{' '}
        <Link
          href="/auth-group/signup"
          className="text-accent hover:text-accent/80 font-semibold transition-colors"
        >
          회원가입
        </Link>
      </p>
    </div>
  )
}
