"use client"

import { CountdownWidget } from './CountdownWidget'

type CompetitionCountdownProps = {
  stage?: string | null
  startsAt?: string | null
  endsAt?: string | null
  size?: 'sm' | 'lg'
  tone?: 'default' | 'inverse'
  align?: 'start' | 'end'
  className?: string
}

function isPreStartStage(stage?: string | null) {
  return stage === 'draft' || stage === 'open'
}

export function CompetitionCountdown({
  stage,
  startsAt,
  endsAt,
  size = 'lg',
  tone = 'default',
  align = 'end',
  className,
}: CompetitionCountdownProps) {
  const useStartsAt = isPreStartStage(stage)
  const targetDate = useStartsAt ? startsAt : endsAt

  if (!targetDate) return null

  return (
    <CountdownWidget
      targetDate={targetDate}
      mode={useStartsAt ? 'starts_in' : 'remaining'}
      size={size}
      tone={tone}
      align={align}
      className={className}
    />
  )
}
