'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import {
  Mail,
  Lock,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Rocket,
  TrendingUp
} from 'lucide-react'

type UserRole = 'founder' | 'vc'

const roleOptions = [
  {
    id: 'founder' as const,
    title: '스타트업 창업자',
    description: '팀을 운영하고, 프로젝트를 관리하며, 투자자에게 어필하세요.',
    icon: Rocket,
    gradient: 'from-primary-500 to-primary-600',
    shadowColor: 'shadow-primary-500/30',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200',
    hoverBorder: 'hover:border-primary-400',
  },
  {
    id: 'vc' as const,
    title: '투자자 (VC)',
    description: '유망한 스타트업을 발굴하고 투자 파이프라인을 관리하세요.',
    icon: TrendingUp,
    gradient: 'from-success-500 to-success-600',
    shadowColor: 'shadow-success-500/30',
    bgColor: 'bg-success-50',
    borderColor: 'border-success-200',
    hoverBorder: 'hover:border-success-400',
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'role' | 'form'>('role')
  const [role, setRole] = useState<UserRole>('founder')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            company,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-2xl">
        <CardContent className="py-12 text-center">
          <motion.div
            className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-success-400 to-success-500 rounded-full flex items-center justify-center shadow-lg shadow-success-500/30"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <CheckCircle2 className="w-10 h-10 text-white" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              이메일을 확인해주세요
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              <span className="font-medium text-primary-600">{email}</span>로<br />
              확인 메일을 보냈습니다.<br />
              이메일의 링크를 클릭하여 가입을 완료해주세요.
            </p>
            <Link href="/auth-group/login">
              <Button variant="outline" size="lg">
                로그인 페이지로
              </Button>
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    )
  }

  // Role selection step
  if (step === 'role') {
    return (
      <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
          <CardDescription>
            어떤 역할로 가입하시겠습니까?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roleOptions.map((option, index) => (
            <motion.button
              key={option.id}
              onClick={() => {
                setRole(option.id)
                setStep('form')
              }}
              className={`w-full p-5 border-2 rounded-2xl text-left group transition-all duration-300 ${option.borderColor} ${option.hoverBorder} hover:shadow-lg`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center ${option.shadowColor} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <option.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-lg">{option.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {option.description}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all mt-2" />
              </div>
            </motion.button>
          ))}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/auth-group/login"
              className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </Card>
    )
  }

  // Form step
  const selectedRole = roleOptions.find(r => r.id === role)!

  return (
    <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-2xl">
      <CardHeader className="text-center space-y-3 pb-2">
        <motion.div
          className={`w-14 h-14 mx-auto bg-gradient-to-br ${selectedRole.gradient} rounded-2xl flex items-center justify-center shadow-lg ${selectedRole.shadowColor}`}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <selectedRole.icon className="w-7 h-7 text-white" />
        </motion.div>
        <div>
          <CardTitle className="text-2xl font-bold">
            {role === 'founder' ? '창업자 회원가입' : '투자자 회원가입'}
          </CardTitle>
          <CardDescription className="mt-2">
            계정을 생성하고 시작하세요
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5 pt-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="flex items-center gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-700 text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Input
              type="text"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User className="w-5 h-5" />}
              required
            />
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
              placeholder="비밀번호 (최소 6자)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-5 h-5" />}
              showPasswordToggle
              hint="영문, 숫자를 포함한 6자 이상"
              minLength={6}
              required
            />
            <Input
              type="text"
              placeholder={role === 'founder' ? '회사명' : '소속 기관'}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              leftIcon={<Building2 className="w-5 h-5" />}
            />
          </motion.div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              type="submit"
              className="w-full h-12"
              size="lg"
              isLoading={isLoading}
              rightIcon={!isLoading && <ArrowRight className="w-4 h-4" />}
            >
              회원가입
            </Button>
          </motion.div>

          <motion.button
            type="button"
            onClick={() => setStep('role')}
            className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ x: -3 }}
          >
            <ArrowLeft className="w-4 h-4" />
            역할 다시 선택
          </motion.button>
        </CardFooter>
      </form>
    </Card>
  )
}
