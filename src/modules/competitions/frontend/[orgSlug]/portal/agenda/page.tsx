"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  is_mandatory: boolean
}

export default function AgendaPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-agenda'],
    queryFn: () => fetchCrudList<AgendaItem>('competitions/agenda', { pageSize: '100', sortField: 'starts_at', sortDir: 'asc' }),
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('competitions.portal.agenda.title', 'Agenda')} label={t('competitions.portal.agenda.label', 'Schedule')} />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : items.length === 0 ? (
        <PortalEmptyState title={t('competitions.portal.agenda.empty', 'No agenda items yet')} description={t('competitions.portal.agenda.emptyDesc', 'The schedule will be published soon. Check back later.')} />
      ) : (
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
      )}
    </div>
  )
}
