"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300',
  primary: 'bg-portal-primary/10 text-portal-primary',
  success: 'bg-portal-success/10 text-portal-success',
  warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'bg-portal-danger/10 text-portal-danger',
  info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  muted: 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400',
}

type PortalBadgeProps = {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

/**
 * Colored pill badge for categories, roles, statuses, tiers.
 */
export function PortalBadge({ children, variant = 'default', className }: PortalBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
