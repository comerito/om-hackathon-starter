"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-portal-primary/10 text-portal-primary',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  muted: 'bg-gray-50 text-gray-500',
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
