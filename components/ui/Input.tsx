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
            className="block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors">
              {leftIcon}
            </div>
          )}
          <input
            type={actualType}
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex h-12 w-full rounded-xl border-2 bg-white/80 backdrop-blur-sm px-4 py-3 text-sm text-gray-900 transition-all duration-200',
              'placeholder:text-gray-400',
              'focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10',
              'hover:border-gray-300',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/10'
                : success
                  ? 'border-success-500 focus:border-success-500 focus:ring-success-500/10'
                  : 'border-gray-200',
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
                className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
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
              <span className="text-gray-400">{rightIcon}</span>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-danger-600 flex items-center gap-1.5"
            >
              {error}
            </motion.p>
          )}
          {hint && !error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-gray-500"
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
            'peer flex h-14 w-full rounded-xl border-2 bg-white/80 backdrop-blur-sm px-4 pt-5 pb-2 text-sm text-gray-900 transition-all duration-200',
            'placeholder:text-transparent',
            'focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10',
            error ? 'border-danger-500' : 'border-gray-200',
            className
          )}
          ref={ref}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'absolute left-4 top-4 text-gray-400 text-sm transition-all duration-200 pointer-events-none origin-left',
              'peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary-600',
              'peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs',
              error && 'text-danger-500 peer-focus:text-danger-500'
            )}
          >
            {label}
          </label>
        )}
        {error && (
          <p className="mt-2 text-sm text-danger-600">{error}</p>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = 'FloatingInput'

export { Input, FloatingInput }
