'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sponsor {
  id: string
  name: string
  tier: string
  logo_url: string
  website_url: string | null
  description: string | null
  challenge_title: string | null
  challenge_description: string | null
  challenge_resources_url: string | null
}

interface Prize {
  id: string
  name: string
  description: string | null
  category: string
  value: string | null
  rank: number | null
  sponsor_id: string | null
}

// ---------------------------------------------------------------------------
// Tier ordering
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<string, number> = {
  TITLE: 0,
  GOLD: 1,
  SILVER: 2,
  PARTNER: 3,
  IN_KIND: 4,
}

const TIER_LABELS: Record<string, string> = {
  TITLE: 'Title Sponsors',
  GOLD: 'Gold Sponsors',
  SILVER: 'Silver Sponsors',
  PARTNER: 'Partners',
  IN_KIND: 'In-Kind Sponsors',
}

const TIER_LOGO_SIZES: Record<string, string> = {
  TITLE: 'h-24',
  GOLD: 'h-20',
  SILVER: 'h-16',
  PARTNER: 'h-12',
  IN_KIND: 'h-10',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalSponsorsPage() {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0]
      if (!comp) {
        setLoading(false)
        return
      }

      // Fetch sponsors
      const sponsorRes = await apiCall(`/api/sponsors/sponsors?competitionId=${comp.id}&isVisible=true&pageSize=100&sortField=order&sortDir=asc`)
      setSponsors(sponsorRes?.data ?? [])

      // Fetch prizes
      const prizeRes = await apiCall(`/api/sponsors/prizes?competitionId=${comp.id}&pageSize=100&sortField=order&sortDir=asc`)
      setPrizes(prizeRes?.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (sponsors.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('sponsors.portal.sponsors.title', 'Sponsors & Prizes')} />
        <PortalEmptyState
          title={t('sponsors.portal.sponsors.empty', 'No sponsors yet')}
          description={t('sponsors.portal.sponsors.emptyDesc', 'Sponsors will be listed here once they are added.')}
        />
      </div>
    )
  }

  // Group sponsors by tier
  const tiers = Object.keys(TIER_ORDER)
  const sponsorsByTier = tiers
    .map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      logoSize: TIER_LOGO_SIZES[tier],
      items: sponsors.filter((s) => s.tier === tier),
    }))
    .filter((group) => group.items.length > 0)

  // Sponsors with challenges
  const sponsorsWithChallenges = sponsors.filter((s) => s.challenge_title)

  return (
    <div className="flex flex-col gap-8">
      <PortalPageHeader
        title={t('sponsors.portal.sponsors.title', 'Sponsors & Prizes')}
      />

      {/* Sponsor logos by tier */}
      {sponsorsByTier.map((group) => (
        <div key={group.tier}>
          <h2 className="text-sm font-medium text-muted-foreground mb-4">{group.label}</h2>
          <div className="flex flex-wrap items-center gap-6">
            {group.items.map((sponsor) => (
              <a
                key={sponsor.id}
                href={sponsor.website_url ?? '#'}
                target={sponsor.website_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2"
                title={sponsor.name}
              >
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className={`${group.logoSize} w-auto object-contain transition-transform group-hover:scale-105`}
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground">
                  {sponsor.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Sponsor Challenges */}
      {sponsorsWithChallenges.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('sponsors.portal.sponsors.challenges', 'Sponsor Challenges')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sponsorsWithChallenges.map((sponsor) => (
              <PortalCard key={sponsor.id}>
                <div className="flex items-start gap-3">
                  <img
                    src={sponsor.logo_url}
                    alt=""
                    className="h-10 w-10 rounded object-contain bg-white border flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <PortalCardHeader
                      label={sponsor.name}
                      title={sponsor.challenge_title!}
                    />
                    {sponsor.challenge_description && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        {sponsor.challenge_description}
                      </p>
                    )}
                    {sponsor.challenge_resources_url && (
                      <a
                        href={sponsor.challenge_resources_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline mt-2 inline-block"
                      >
                        {t('sponsors.portal.sponsors.viewResources', 'View Resources')}
                      </a>
                    )}
                  </div>
                </div>
              </PortalCard>
            ))}
          </div>
        </div>
      )}

      {/* Prizes */}
      {prizes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('sponsors.portal.sponsors.prizes', 'Prizes')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prizes.map((prize) => {
              const sponsor = sponsors.find((s) => s.id === prize.sponsor_id)
              return (
                <div key={prize.id} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{prize.name}</span>
                    {prize.rank != null && (
                      <span className="text-xs text-muted-foreground">#{prize.rank}</span>
                    )}
                  </div>
                  {prize.value && (
                    <div className="text-sm text-primary font-medium">{prize.value}</div>
                  )}
                  {prize.description && (
                    <p className="text-xs text-muted-foreground mt-1">{prize.description}</p>
                  )}
                  {sponsor && (
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <img src={sponsor.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
                      {sponsor.name}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
