"use client"

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'

type ActionLinkProps = {
  href: string
  children: React.ReactNode
  /** Show arrow icon after text */
  arrow?: boolean
  className?: string
}

/**
 * Uppercase text link with optional arrow icon.
 * Used for "VIEW PORTFOLIO →", "BOOK OFFICE HOURS", "View all assets →".
 */
export function ActionLink({ href, children, arrow = true, className }: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-portal-primary hover:text-portal-primary-light transition-colors',
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight className="size-3.5" />}
    </Link>
  )
}
