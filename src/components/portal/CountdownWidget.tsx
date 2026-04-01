"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

type CountdownWidgetProps = {
  /** Target date to count down to */
  targetDate: Date | string
  /** Label shown below the number */
  label?: string
  /** Countdown mode — affects default label */
  mode?: 'remaining' | 'starts_in'
  /** Size variant */
  size?: 'sm' | 'lg'
  className?: string
}

function getHoursRemaining(target: Date): number {
  const diff = target.getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
}

/**
 * Large countdown number display with label.
 */
export function CountdownWidget({ targetDate, label, mode = 'remaining', size = 'lg', className }: CountdownWidgetProps) {
  const t = useT()
  const target = React.useMemo(() => (typeof targetDate === 'string' ? new Date(targetDate) : targetDate), [targetDate])
  const [hours, setHours] = React.useState(() => getHoursRemaining(target))
  const defaultLabel = mode === 'starts_in'
    ? t('common.countdown.startsIn', 'STARTS IN')
    : t('common.countdown.hoursLeft', 'HOURS LEFT')
  const resolvedLabel = label ?? defaultLabel

  React.useEffect(() => {
    const interval = setInterval(() => setHours(getHoursRemaining(target)), 60_000)
    return () => clearInterval(interval)
  }, [target])

  return (
    <div className={cn('flex flex-col items-end', className)}>
      <span
        className={cn(
          'font-mono font-bold leading-none tracking-tight text-portal-primary',
          size === 'lg' ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {String(hours).padStart(2, '0')}:{String(Math.floor((target.getTime() - Date.now()) / 60000) % 60).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
        {resolvedLabel}
      </span>
    </div>
  )
}
