"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type SectionLabelProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Uppercase small text label in primary color.
 * Used for section headers like "WORKSPACE", "COMPETITION HUB", "NETWORK HUB".
 */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <span className={cn('text-xs font-semibold uppercase tracking-[0.15em] text-portal-primary', className)}>
      {children}
    </span>
  )
}
