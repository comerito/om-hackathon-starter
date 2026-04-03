"use client"

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { ProgressBar } from './ProgressBar'
import {
  CheckCircle2,
  Circle,
  FileText,
  Briefcase,
  Wrench,
  Github,
  MessageCircle,
  ChevronRight,
} from 'lucide-react'

/* ---------- types ---------- */

type ProfileData = {
  id: string
  bio: string | null
  specialty: string | null
  skills: string[]
  social_links: { github?: string; discord?: string; [key: string]: string | undefined }
}

type RequiredItem = {
  key: string
  label: string
  icon: React.ElementType
  check: (p: ProfileData) => boolean
}

/* ---------- component ---------- */

export function ProfileCompletionCard({ profileLink, onAction }: { profileLink: string; onAction?: () => void }) {
  const t = useT()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal-my-profile'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ ok: boolean; profile: ProfileData | null }>(
        '/api/competitions/portal/update-profile',
      )
      return ok && result ? result.profile : null
    },
  })

  const items: RequiredItem[] = React.useMemo(() => [
    {
      key: 'bio',
      label: t('competitions.portal.profileCompletion.bio', 'Add a bio description'),
      icon: FileText,
      check: (p) => !!p.bio?.trim(),
    },
    {
      key: 'specialty',
      label: t('competitions.portal.profileCompletion.specialty', 'Set your specialty'),
      icon: Briefcase,
      check: (p) => !!p.specialty?.trim(),
    },
    {
      key: 'skills',
      label: t('competitions.portal.profileCompletion.skills', 'Add at least 3 skills'),
      icon: Wrench,
      check: (p) => (p.skills?.length ?? 0) >= 3,
    },
    {
      key: 'github',
      label: t('competitions.portal.profileCompletion.github', 'Add your GitHub username'),
      icon: Github,
      check: (p) => !!p.social_links?.github?.trim(),
    },
    {
      key: 'discord',
      label: t('competitions.portal.profileCompletion.discord', 'Add your Discord nick'),
      icon: MessageCircle,
      check: (p) => !!p.social_links?.discord?.trim(),
    },
  ], [t])

  if (isLoading || !profile) return null

  const completed = items.filter((item) => item.check(profile))
  const percentage = Math.round((completed.length / items.length) * 100)

  // Don't show when profile is fully complete
  if (percentage === 100) return null

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          {t('competitions.portal.profileCompletion.title', 'Complete Your Profile')}
        </h3>
        <span className="text-xs font-bold text-portal-primary">{percentage}%</span>
      </div>

      <ProgressBar
        value={percentage}
        label={t('competitions.portal.profileCompletion.progress', '{completed} of {total} completed', {
          completed: completed.length,
          total: items.length,
        })}
        size="sm"
      />

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const done = item.check(profile)
          return (
            <li key={item.key} className="flex items-center gap-2.5">
              {done ? (
                <CheckCircle2 className="size-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="size-4 text-gray-300 dark:text-slate-600 shrink-0" />
              )}
              <item.icon className="size-3.5 text-portal-secondary shrink-0" />
              <span
                className={`text-xs flex-1 ${
                  done
                    ? 'text-portal-secondary line-through'
                    : 'text-foreground font-medium'
                }`}
              >
                {item.label}
              </span>
            </li>
          )
        })}
      </ul>

      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-portal-primary/20 bg-portal-primary/5 px-3 py-2 text-xs font-semibold text-portal-primary hover:bg-portal-primary/10 transition-colors"
        >
          {t('competitions.portal.profileCompletion.cta', 'Complete Profile')}
          <ChevronRight className="size-3.5" />
        </button>
      ) : (
        <Link
          href={profileLink}
          className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-portal-primary/20 bg-portal-primary/5 px-3 py-2 text-xs font-semibold text-portal-primary hover:bg-portal-primary/10 transition-colors"
        >
          {t('competitions.portal.profileCompletion.cta', 'Complete Profile')}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}
