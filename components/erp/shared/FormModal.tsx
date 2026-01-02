'use client'

import React from 'react'
import { X, Save, Loader2 } from 'lucide-react'

interface FormModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  onSubmit?: () => void
  submitLabel?: string
  loading?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

export function FormModal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = '저장',
  loading = false,
  size = 'md',
  footer,
}: FormModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full ${sizeClasses[size]} mx-4 bg-theme-card border border-theme rounded-xl shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme">
          <h2 className="text-lg font-semibold text-theme">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-theme-muted hover:text-theme transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme">
          {footer || (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-theme-muted hover:text-theme transition-colors"
              >
                취소
              </button>
              {onSubmit && (
                <button
                  onClick={onSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {submitLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, children, className = '' }: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-theme-secondary">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function FormInput({ error, className = '', ...props }: FormInputProps) {
  return (
    <input
      className={`w-full px-3 py-2 bg-theme-input border ${error ? 'border-red-500' : 'border-theme'} rounded-lg text-sm text-theme placeholder-theme-muted focus:outline-none focus:border-accent ${className}`}
      {...props}
    />
  )
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export function FormSelect({ error, options, placeholder, className = '', ...props }: FormSelectProps) {
  return (
    <select
      className={`w-full px-3 py-2 bg-theme-input border ${error ? 'border-red-500' : 'border-theme'} rounded-lg text-sm text-theme focus:outline-none focus:border-accent ${className}`}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function FormTextarea({ error, className = '', ...props }: FormTextareaProps) {
  return (
    <textarea
      className={`w-full px-3 py-2 bg-theme-input border ${error ? 'border-red-500' : 'border-theme'} rounded-lg text-sm text-theme placeholder-theme-muted focus:outline-none focus:border-accent resize-none ${className}`}
      {...props}
    />
  )
}

interface FormRowProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
  className?: string
}

export function FormRow({ children, cols = 2, className = '' }: FormRowProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }

  return (
    <div className={`grid ${gridCols[cols]} gap-4 ${className}`}>
      {children}
    </div>
  )
}
