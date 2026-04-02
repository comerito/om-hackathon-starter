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

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

/**
 * Uppercase text link with optional arrow icon.
 * Used for "VIEW PORTFOLIO →", "BOOK OFFICE HOURS", "View all assets →".
 */
export function ActionLink({ href, children, arrow = true, className }: ActionLinkProps) {
  const external = isExternalHref(href)

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-portal-primary hover:text-portal-primary-light transition-colors',
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight className="size-3.5" />}
    </Link>
  )
}
