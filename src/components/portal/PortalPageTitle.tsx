"use client"

import { cn } from '@open-mercato/shared/lib/utils'
import { SectionLabel } from './SectionLabel'

type PortalPageTitleProps = {
  /** Uppercase section label (e.g. "WORKSPACE", "COMPETITION HUB") */
  label?: string
  /** Large display headline */
  title: string
  /** Optional right-side element (e.g. countdown, button) */
  rightElement?: React.ReactNode
  className?: string
}

/**
 * Page header with section label + large serif title + optional right element.
 * Replaces the framework's PortalPageHeader with the redesign typography.
 */
export function PortalPageTitle({ label, title, rightElement, className }: PortalPageTitleProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        {label && <SectionLabel className="mb-1 block">{label}</SectionLabel>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {title}
        </h1>
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </div>
  )
}
