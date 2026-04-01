"use client"
import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  CalendarDays,
  Globe,
  HelpCircle,
  Link2,
  MapPin,
  ShieldCheck,
  Star,
  Ticket,
  Trophy,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { PortalBadge } from '@/components/portal'

export type CompetitionInfoCard = {
  id: string
  key: string
  icon: string | null
  label: string
  value: string
  sort_order: number
}

const infoCardIconMap: Record<string, LucideIcon> = {
  wifi: Wifi,
  location: MapPin,
  venue: MapPin,
  map_pin: MapPin,
  address: MapPin,
  deadline: CalendarDays,
  calendar: CalendarDays,
  schedule: CalendarDays,
  prize: Trophy,
  trophy: Trophy,
  award: Trophy,
  ticket: Ticket,
  badge: Ticket,
  team: Users,
  users: Users,
  support: HelpCircle,
  help: HelpCircle,
  faq: HelpCircle,
  link: Link2,
  website: Globe,
  globe: Globe,
  rules: ShieldCheck,
  safety: ShieldCheck,
  star: Star,
}

function normalizeInfoCardIconKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^lucide:/, '')
    .replace(/[\s-]+/g, '_')
}

function getInfoCardIcon(card: CompetitionInfoCard): LucideIcon {
  const iconKey = normalizeInfoCardIconKey(card.icon)
  if (iconKey && infoCardIconMap[iconKey]) return infoCardIconMap[iconKey]

  const keyHint = normalizeInfoCardIconKey(card.key)
  if (keyHint && infoCardIconMap[keyHint]) return infoCardIconMap[keyHint]

  return HelpCircle
}

type CompetitionInfoCardsProps = {
  items: CompetitionInfoCard[]
  title?: string
  description?: string
  showCountBadge?: boolean
  className?: string
  gridClassName?: string
  cardClassName?: string
}

export function CompetitionInfoCards({
  items,
  title,
  description,
  showCountBadge = false,
  className,
  gridClassName,
  cardClassName,
}: CompetitionInfoCardsProps) {
  if (items.length === 0) return null

  return (
    <div className={cn('rounded-xl border border-gray-100 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:p-5', className)}>
      {(title || description) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-bold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-portal-secondary">{description}</p>}
          </div>
          {showCountBadge && <PortalBadge variant="muted">{items.length}</PortalBadge>}
        </div>
      )}

      <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', gridClassName)}>
        {items.map((card) => {
          const Icon = getInfoCardIcon(card)
          return (
            <div
              key={card.id}
              className={cn(
                'rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]',
                cardClassName,
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-portal-primary/10">
                  <Icon className="size-4 text-portal-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-portal-secondary">
                    {card.label}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm font-bold text-foreground">
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
