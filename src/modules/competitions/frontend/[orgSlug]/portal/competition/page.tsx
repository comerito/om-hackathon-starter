"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

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

export default function MyCompetitionsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-competitions'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: MyCompetition[] }>('/api/competitions/portal/my-competitions')
      if (!ok || !result) throw new Error('Failed to load')
      return result
    },
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        title={t('competitions.portal.myCompetitions.title', 'My Competitions')}
        label={t('competitions.portal.myCompetitions.label', 'Events you participate in')}
      />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : items.length === 0 ? (
        <PortalEmptyState
          title={t('competitions.portal.myCompetitions.empty', 'No competitions yet')}
          description={t('competitions.portal.myCompetitions.emptyDesc', 'You haven\'t been registered in any competition. Contact the organizer to get started.')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((comp) => (
            <PortalCard key={comp.id}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{comp.name}</h3>
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
          ))}
        </div>
      )}
    </div>
  )
}
