"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'

type MyCompetition = {
  id: string; name: string; slug: string; stage: string; role: string
  starts_at: string; ends_at: string; location: string | null; timezone: string
}

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Registration Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking', demos: 'Demos',
  deliberation: 'Deliberation', finished: 'Finished', archived: 'Archived',
}

const roleLabels: Record<string, string> = {
  participant: 'Participant', mentor: 'Mentor', judge: 'Judge',
}

function CompetitionsContent() {
  const t = useT()
  const { competitions, selectedId, setSelectedId } = useCompetitionContext()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-competitions'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: MyCompetition[] }>('/api/competitions/portal/my-competitions')
      if (!ok || !result) throw new Error('Failed to load')
      return result
    },
  })

  const items = data?.items ?? []

  if (isLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (items.length === 0) {
    return (
      <PortalEmptyState
        title={t('competitions.portal.myCompetitions.empty', 'No competitions yet')}
        description={t('competitions.portal.myCompetitions.emptyDesc', 'You haven\'t been registered in any competition. Contact the organizer to get started.')}
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((comp) => {
        const isSelected = comp.id === selectedId
        return (
          <button
            key={comp.id}
            type="button"
            onClick={() => setSelectedId(comp.id)}
            className="text-left w-full"
          >
            <PortalCard className={isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50 transition-colors'}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{comp.name}</h3>
                    {isSelected && (
                      <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        {t('competitions.portal.myCompetitions.active', 'Active')}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {stageLabels[comp.stage] ?? comp.stage}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                  <span>{t('competitions.portal.myCompetitions.role', 'Role')}: <strong className="text-foreground">{roleLabels[comp.role] ?? comp.role}</strong></span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{new Date(comp.starts_at).toLocaleDateString()} — {new Date(comp.ends_at).toLocaleDateString()}</span>
                  {comp.location && <span>{comp.location}</span>}
                </div>
              </div>
            </PortalCard>
          </button>
        )
      })}
    </div>
  )
}

export default function MyCompetitionsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('competitions.portal.myCompetitions.label', 'Click to select active competition')}
        title={t('competitions.portal.myCompetitions.title', 'My Competitions')}
      />
      <CompetitionsContent />
    </PortalCompetitionLayout>
  )
}
