"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

type SponsorItem = { id: string; name: string; tier: string; logo_url: string; website_url: string | null; description: string | null; challenge_title: string | null; challenge_description: string | null }
type PrizeItem = { id: string; name: string; description: string | null; category: string; value: string | null; rank: number | null; sponsor_id: string | null; winning_project_id: string | null; awarded_at: string | null }

const tierOrder: Record<string, number> = { title: 0, gold: 1, silver: 2, partner: 3, in_kind: 4 }
const tierLabels: Record<string, string> = { title: 'Title Sponsor', gold: 'Gold', silver: 'Silver', partner: 'Partner', in_kind: 'In-Kind' }

function SponsorsContent() {
  const t = useT()
  const { selectedId: competitionId } = useCompetitionContext()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-sponsors', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ sponsors: SponsorItem[]; prizes: PrizeItem[] }>(`/api/sponsors/portal/sponsors-view?competition_id=${competitionId}`)
      return ok && result ? result : { sponsors: [], prizes: [] }
    },
    enabled: !!competitionId,
  })

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  const sponsors = (data?.sponsors ?? []).sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99))
  const prizes = data?.prizes ?? []

  if (sponsors.length === 0 && prizes.length === 0) {
    return <PortalEmptyState title={t('sponsors.portal.empty', 'No Sponsors Yet')} description={t('sponsors.portal.emptyDesc', 'Sponsor information will appear here.')} />
  }

  return (
    <div className="space-y-8">
      {/* Sponsors */}
      {sponsors.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('sponsors.portal.ourSponsors', 'Our Sponsors')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map(sponsor => (
              <PortalCard key={sponsor.id}>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      <img src={sponsor.logo_url} alt={sponsor.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{sponsor.name}</h3>
                      <span className="text-xs text-muted-foreground">{tierLabels[sponsor.tier] ?? sponsor.tier}</span>
                    </div>
                  </div>
                  {sponsor.description && <p className="text-sm text-muted-foreground mb-3">{sponsor.description}</p>}
                  {sponsor.challenge_title && (
                    <div className="rounded-md bg-primary/5 border border-primary/10 p-3 mt-2">
                      <p className="text-xs uppercase tracking-wider text-primary font-medium mb-1">{t('sponsors.portal.challenge', 'Challenge')}</p>
                      <p className="text-sm font-medium">{sponsor.challenge_title}</p>
                      {sponsor.challenge_description && <p className="text-xs text-muted-foreground mt-1">{sponsor.challenge_description}</p>}
                    </div>
                  )}
                  {sponsor.website_url && (
                    <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-2 inline-block">
                      {t('sponsors.portal.visitWebsite', 'Visit website')}
                    </a>
                  )}
                </div>
              </PortalCard>
            ))}
          </div>
        </div>
      )}

      {/* Prizes */}
      {prizes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('sponsors.portal.prizes', 'Prizes')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {prizes.map(prize => (
              <PortalCard key={prize.id}>
                <div className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-lg shrink-0">
                    {prize.rank ? `#${prize.rank}` : '🏆'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{prize.name}</h3>
                    {prize.description && <p className="text-xs text-muted-foreground truncate">{prize.description}</p>}
                  </div>
                  {prize.value && <span className="text-sm font-semibold text-primary shrink-0">{prize.value}</span>}
                </div>
              </PortalCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SponsorsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('sponsors.portal.title', 'Sponsors & Prizes')} label={t('sponsors.portal.label', 'Our partners and awards')} />
        <SponsorsContent />
      </div>
    </CompetitionProvider>
  )
}
