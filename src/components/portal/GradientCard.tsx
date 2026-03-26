"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type GradientCardProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Purple/primary gradient background card.
 * Used for prize pool, hackathon progress, resources guide, sponsors hero.
 */
export function GradientCard({ children, className }: GradientCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-portal-primary to-portal-primary-light p-4 sm:p-6 text-white shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
