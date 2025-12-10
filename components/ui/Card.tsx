'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'

const cardVariants = cva(
  'rounded-2xl transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900 border border-zinc-800 shadow-soft',
        elevated: 'bg-zinc-900 shadow-lg shadow-black/30',
        outline: 'bg-zinc-900/50 backdrop-blur-sm border-2 border-zinc-700',
        ghost: 'bg-zinc-800/50',
        glass: 'bg-zinc-900/70 backdrop-blur-xl border border-zinc-700/50 shadow-soft',
        gradient: 'bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-soft',
        interactive: 'bg-zinc-900 border border-zinc-800 shadow-soft hover:shadow-lg hover:shadow-black/30 hover:border-zinc-700 hover:-translate-y-1 cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  children: React.ReactNode
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

// Motion Card with animations
interface MotionCardProps extends Omit<CardProps, 'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragEnd' | 'onDragStart'> {}

const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className, variant, children }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
      >
        {children}
      </motion.div>
    )
  }
)
MotionCard.displayName = 'MotionCard'

interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const CardHeader = forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-5 border-b border-zinc-800', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, CardSectionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-lg font-semibold text-zinc-100 tracking-tight', className)}
        {...props}
      >
        {children}
      </h3>
    )
  }
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, CardSectionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('mt-1.5 text-sm text-zinc-400 leading-relaxed', className)}
        {...props}
      >
        {children}
      </p>
    )
  }
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-5', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-6 py-4 border-t border-zinc-800 bg-gradient-to-b from-zinc-800/50 to-zinc-900 rounded-b-2xl',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardFooter.displayName = 'CardFooter'

// Stat Card for dashboard metrics
interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

function StatCard({ title, value, change, changeLabel, icon, trend, className }: StatCardProps) {
  return (
    <Card variant="interactive" className={cn('overflow-hidden', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-400">{title}</p>
            <p className="text-3xl font-bold text-zinc-100 tracking-tight">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold',
                    trend === 'up' && 'bg-success-500/20 text-success-400',
                    trend === 'down' && 'bg-danger-500/20 text-danger-400',
                    trend === 'neutral' && 'bg-zinc-700 text-zinc-300'
                  )}
                >
                  {trend === 'up' && '↑'}
                  {trend === 'down' && '↓'}
                  {change > 0 ? '+' : ''}{change}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-zinc-500">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export {
  Card,
  MotionCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  cardVariants
}
