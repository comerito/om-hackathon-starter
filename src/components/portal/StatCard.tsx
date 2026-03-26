"use client"

import { cn } from '@open-mercato/shared/lib/utils'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  icon: LucideIcon
  value: string | number
  label: string
  /** Optional accent color variant */
  variant?: 'default' | 'primary'
  className?: string
}

/**
 * Stat card with icon, large number, and label.
 * Used on the dashboard for "1,248 PARTICIPANTS", "08 ACTIVE TRACKS".
 */
export function StatCard({ icon: Icon, value, label, variant = 'default', className }: StatCardProps) {
  const isPrimary = variant === 'primary'

  return (
    <div
      className={cn(
        'rounded-xl border p-3 sm:p-5',
        isPrimary
          ? 'border-portal-primary/20 bg-portal-primary/5'
          : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5',
        className,
      )}
    >
      <Icon
        className={cn(
          'size-5 mb-3',
          isPrimary ? 'text-portal-primary' : 'text-portal-secondary',
        )}
      />
      <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-portal-secondary">
        {label}
      </p>
    </div>
  )
}
