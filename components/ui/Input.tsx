'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  success?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  showPasswordToggle?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
    label,
    error,
    hint,
    success,
    leftIcon,
    rightIcon,
    showPasswordToggle,
    id,
    disabled,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-')
    const isPasswordType = type === 'password'
    const actualType = isPasswordType && showPassword ? 'text' : type

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-zinc-300"
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors">
              {leftIcon}
            </div>
          )}
          <input
            type={actualType}
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex h-12 w-full rounded-xl border-2 bg-zinc-800/80 backdrop-blur-sm px-4 py-3 text-sm text-zinc-100 transition-all duration-200',
              'placeholder:text-zinc-500',
              'focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10',
              'hover:border-zinc-600',
              'disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:opacity-60',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/10'
                : success
                  ? 'border-success-500 focus:border-success-500 focus:ring-success-500/10'
                  : 'border-zinc-700',
              leftIcon && 'pl-11',
              (rightIcon || (isPasswordType && showPasswordToggle) || error || success) && 'pr-11',
              className
            )}
            ref={ref}
            {...props}
          />
          {/* Right side icons */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {error && <AlertCircle className="w-5 h-5 text-danger-500" />}
            {success && !error && <CheckCircle2 className="w-5 h-5 text-success-500" />}
            {isPasswordType && showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            )}
            {rightIcon && !error && !success && !(isPasswordType && showPasswordToggle) && (
              <span className="text-zinc-500">{rightIcon}</span>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-danger-400 flex items-center gap-1.5"
            >
              {error}
            </motion.p>
          )}
          {hint && !error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-zinc-500"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  }
)
Input.displayName = 'Input'

// Floating label variant
const FloatingInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="relative w-full">
        <input
          type={type}
          id={inputId}
          placeholder=" "
          className={cn(
            'peer flex h-14 w-full rounded-xl border-2 bg-zinc-800/80 backdrop-blur-sm px-4 pt-5 pb-2 text-sm text-zinc-100 transition-all duration-200',
            'placeholder:text-transparent',
            'focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10',
            error ? 'border-danger-500' : 'border-zinc-700',
            className
          )}
          ref={ref}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'absolute left-4 top-4 text-zinc-500 text-sm transition-all duration-200 pointer-events-none origin-left',
              'peer-focus:top-2 peer-focus:text-xs peer-focus:text-accent',
              'peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs',
              error && 'text-danger-500 peer-focus:text-danger-500'
            )}
          >
            {label}
          </label>
        )}
        {error && (
          <p className="mt-2 text-sm text-danger-400">{error}</p>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = 'FloatingInput'

export { Input, FloatingInput }
