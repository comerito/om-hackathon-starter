"use client"

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
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
  Clock3,
  type LucideIcon,
} from 'lucide-react'

const INFO_CARD_ICON_OPTIONS: Array<{ value: string; name: string; Icon: LucideIcon }> = [
  { value: 'lucide:wifi', name: 'wifi', Icon: Wifi },
  { value: 'lucide:map-pin', name: 'location', Icon: MapPin },
  { value: 'lucide:calendar-days', name: 'schedule', Icon: CalendarDays },
  { value: 'lucide:clock-3', name: 'deadline', Icon: Clock3 },
  { value: 'lucide:trophy', name: 'prize', Icon: Trophy },
  { value: 'lucide:users', name: 'team', Icon: Users },
  { value: 'lucide:help-circle', name: 'help', Icon: HelpCircle },
  { value: 'lucide:link-2', name: 'link', Icon: Link2 },
  { value: 'lucide:globe', name: 'website', Icon: Globe },
  { value: 'lucide:shield-check', name: 'rules', Icon: ShieldCheck },
  { value: 'lucide:ticket', name: 'ticket', Icon: Ticket },
  { value: 'lucide:star', name: 'highlight', Icon: Star },
]

type InfoCardIconPickerProps = {
  value: string | null | undefined
  onChange: (next: string) => void
}

export function InfoCardIconPicker({ value, onChange }: InfoCardIconPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {INFO_CARD_ICON_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.name}
            className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <opt.Icon className="size-4" />
          </button>
        ))}
      </div>
      <Input
        value={String(value || '')}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder="lucide:wifi"
        className="max-w-[280px] text-sm"
      />
    </div>
  )
}
