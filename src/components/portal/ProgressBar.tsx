"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type ProgressBarProps = {
  /** Progress value between 0 and 100 */
  value: number
  /** Label text shown with the progress */
  label?: string
  /** Size variant */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Progress bar used for phase progress, capacity bars, completion tracking.
 */
export function ProgressBar({ value, label, size = 'md', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-gray-100',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className="h-full rounded-full bg-portal-primary transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && (
        <p className="mt-1.5 text-xs text-portal-secondary">{label}</p>
      )}
    </div>
  )
}
