"use client"

import { cn } from '@open-mercato/shared/lib/utils'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

type StatCardProps = {
  icon: LucideIcon
  value: string | number
  label: string
  /** Optional accent color variant */
  variant?: 'default' | 'primary'
  href?: string
  className?: string
}

/**
 * Stat card with icon, large number, and label.
 * Used on the dashboard for "1,248 PARTICIPANTS", "08 ACTIVE TRACKS".
 */
export function StatCard({ icon: Icon, value, label, variant = 'default', href, className }: StatCardProps) {
  const isPrimary = variant === 'primary'
  const classes = cn(
    'rounded-xl border p-3 sm:p-5',
    isPrimary
      ? 'border-portal-primary/20 bg-portal-primary/5'
      : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5',
    href ? 'block transition-all hover:border-portal-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/40' : '',
    className,
  )

  const content = (
    <>
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
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <div className={classes}>
      {content}
    </div>
  )
}
