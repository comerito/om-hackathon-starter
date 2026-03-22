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
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  is_mandatory: boolean
}

function AgendaContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-agenda', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as AgendaItem[] }
      const { ok, result } = await apiCall<{ items: AgendaItem[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=agenda`,
      )
      if (!ok || !result) throw new Error('Failed to load')
      return result
    },
    enabled: !!selectedId,
  })

  const items = data?.items ?? []

  if (!selectedId) {
    return <PortalEmptyState title={t('competitions.portal.agenda.noCompetition', 'Select a competition')} description={t('competitions.portal.agenda.noCompetitionDesc', 'Choose a competition to view its agenda.')} />
  }

  if (isLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (items.length === 0) {
    return <PortalEmptyState title={t('competitions.portal.agenda.empty', 'No agenda items yet')} description={t('competitions.portal.agenda.emptyDesc', 'The schedule will be published soon.')} />
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <PortalCard key={item.id}>
          <div className="p-4 flex gap-4">
            <div className="flex flex-col items-center text-xs text-muted-foreground min-w-[60px]">
              <span className="font-medium">{new Date(item.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>—</span>
              <span>{new Date(item.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{item.title}</h3>
                {item.is_mandatory && <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">{t('competitions.portal.agenda.mandatory', 'Required')}</span>}
                <span className="text-xs bg-muted rounded px-1.5 py-0.5 capitalize">{item.type.replace('_', ' ')}</span>
              </div>
              {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                {item.location && <span>{item.location}</span>}
                {item.speaker_name && <span>{item.speaker_name}</span>}
              </div>
            </div>
          </div>
        </PortalCard>
      ))}
    </div>
  )
}

export default function AgendaPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageHeader title={t('competitions.portal.agenda.title', 'Agenda')} label={t('competitions.portal.agenda.label', 'Schedule')} />
      <AgendaContent />
    </PortalCompetitionLayout>
  )
}
