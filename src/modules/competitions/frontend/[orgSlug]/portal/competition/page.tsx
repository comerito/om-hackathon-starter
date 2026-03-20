"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'

type Competition = {
  id: string; name: string; slug: string; description: string; stage: string
  starts_at: string; ends_at: string; location: string; timezone: string
}

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Registration Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking', demos: 'Demos',
  deliberation: 'Deliberation', finished: 'Finished', archived: 'Archived',
}

export default function CompetitionOverviewPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-competition'],
    queryFn: () => fetchCrudList<Competition>('competitions/competitions', { pageSize: '1' }),
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const competition = data?.items?.[0]

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('competitions.portal.competition.title', 'Competition')} label={t('competitions.portal.competition.label', 'Overview')} />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : !competition ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('competitions.portal.competition.none', 'No active competition found.')}</div></PortalCard>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <PortalCard>
            <PortalCardHeader title={competition.name} />
            <div className="px-6 pb-6 space-y-3">
              {competition.description && <p className="text-sm text-muted-foreground">{competition.description}</p>}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {stageLabels[competition.stage] ?? competition.stage}
                </span>
              </div>
            </div>
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('competitions.portal.competition.details', 'Details')} />
            <div className="px-6 pb-6 space-y-2 text-sm">
              {competition.location && (
                <div><span className="font-medium">{t('competitions.portal.competition.location', 'Location')}:</span> {competition.location}</div>
              )}
              <div><span className="font-medium">{t('competitions.portal.competition.starts', 'Starts')}:</span> {new Date(competition.starts_at).toLocaleDateString()}</div>
              <div><span className="font-medium">{t('competitions.portal.competition.ends', 'Ends')}:</span> {new Date(competition.ends_at).toLocaleDateString()}</div>
              <div><span className="font-medium">{t('competitions.portal.competition.timezone', 'Timezone')}:</span> {competition.timezone}</div>
            </div>
          </PortalCard>
        </div>
      )}
    </div>
  )
}
