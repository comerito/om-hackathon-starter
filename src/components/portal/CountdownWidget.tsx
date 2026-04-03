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
  tone?: 'default' | 'inverse'
  align?: 'start' | 'end'
  className?: string
}

function getTimeRemaining(target: Date): { hours: number; minutes: number } {
  const diff = Math.max(0, target.getTime() - Date.now())
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  }
}

/**
 * Large countdown number display with label.
 */
export function CountdownWidget({
  targetDate,
  label,
  mode = 'remaining',
  size = 'lg',
  tone = 'default',
  align = 'end',
  className,
}: CountdownWidgetProps) {
  const t = useT()
  const target = React.useMemo(() => (typeof targetDate === 'string' ? new Date(targetDate) : targetDate), [targetDate])
  const [timeLeft, setTimeLeft] = React.useState(() => getTimeRemaining(target))
  const defaultLabel = mode === 'starts_in'
    ? t('common.countdown.startsIn', 'STARTS IN')
    : t('common.countdown.hoursLeft', 'HOURS LEFT')
  const resolvedLabel = label ?? defaultLabel

  React.useEffect(() => {
    setTimeLeft(getTimeRemaining(target))
    const interval = setInterval(() => setTimeLeft(getTimeRemaining(target)), 60_000)
    return () => clearInterval(interval)
  }, [target])

  return (
    <div className={cn('flex flex-col', align === 'end' ? 'items-end text-right' : 'items-start text-left', className)}>
      <span
        className={cn(
          'font-mono font-bold leading-none tracking-tight',
          tone === 'inverse' ? 'text-white' : 'text-portal-primary',
          size === 'lg' ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}
      </span>
      <span className={cn('mt-1 text-[10px] font-semibold uppercase tracking-widest', tone === 'inverse' ? 'text-white/70' : 'text-portal-secondary')}>
        {resolvedLabel}
      </span>
    </div>
  )
}
