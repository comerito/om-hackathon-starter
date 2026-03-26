"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { Trophy, Medal, Award, Star } from 'lucide-react'
import { GradientCard, PortalBadge, SectionLabel } from '@/components/portal'

type SponsorItem = { id: string; name: string; tier: string; logo_url: string; website_url: string | null; description: string | null; challenge_title: string | null; challenge_description: string | null }
type PrizeItem = { id: string; name: string; description: string | null; category: string; value: string | null; rank: number | null; sponsor_id: string | null; winning_project_id: string | null; awarded_at: string | null }

const tierOrder: Record<string, number> = { title: 0, gold: 1, silver: 2, partner: 3, in_kind: 4 }
const tierBadgeVariants: Record<string, 'primary' | 'warning' | 'muted' | 'info'> = {
  title: 'primary', gold: 'warning', silver: 'muted', partner: 'info', in_kind: 'muted',
}
const tierLabels: Record<string, string> = { title: 'TITLE SPONSOR', gold: 'GOLD TIER', silver: 'SILVER TIER', partner: 'PARTNER', in_kind: 'IN-KIND' }

const prizeIcons = [Trophy, Medal, Award, Star]

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

  if (isLoading) return <div className="text-center py-12 text-portal-secondary">Loading...</div>

  const sponsors = (data?.sponsors ?? []).sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99))
  const prizes = data?.prizes ?? []
  const totalPrizePool = prizes.reduce((sum, p) => {
    const val = p.value ? parseFloat(p.value.replace(/[^0-9.]/g, '')) : 0
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  if (sponsors.length === 0 && prizes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-portal-secondary">
        Sponsor information will appear here.
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <GradientCard className="relative overflow-hidden">
        <SectionLabel className="text-white/80">Event Rewards</SectionLabel>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
          Empowering<br />Innovation.
        </h2>
        <p className="mt-3 text-sm text-white/70 max-w-md">
          Meet the partners making this editorial evolution possible and discover the rewards for the most impactful solutions.
        </p>
        {totalPrizePool > 0 && (
          <div className="mt-4 sm:mt-0 sm:absolute sm:top-6 sm:right-6 rounded-xl bg-white/20 backdrop-blur-sm px-5 py-3 w-fit">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">Total Pool</span>
            <p className="text-2xl font-bold text-white">${totalPrizePool.toLocaleString()}</p>
          </div>
        )}
      </GradientCard>

      {/* Sponsors Section */}
      {sponsors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Our Sponsors</h2>
            <SectionLabel>Industry Partners</SectionLabel>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {sponsors.map(sponsor => (
              <div key={sponsor.id} className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className="size-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{sponsor.name}</h3>
                    <PortalBadge variant={tierBadgeVariants[sponsor.tier] ?? 'muted'}>
                      {tierLabels[sponsor.tier] ?? sponsor.tier}
                    </PortalBadge>
                  </div>
                </div>
                {sponsor.description && (
                  <p className="text-xs text-portal-secondary leading-relaxed mb-3">{sponsor.description}</p>
                )}
                {sponsor.challenge_title && (
                  <div className="border-l-3 border-l-portal-primary bg-portal-primary/5 rounded-r-lg p-3 mt-3" style={{ borderLeftWidth: '3px' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-primary">
                      Sponsor Challenge
                    </span>
                    <p className="text-sm font-semibold text-foreground mt-1">{sponsor.challenge_title}</p>
                    {sponsor.challenge_description && (
                      <p className="text-xs text-portal-secondary mt-1">{sponsor.challenge_description}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prizes Section */}
      {prizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Prizes</h2>
            <SectionLabel>Victory Rewards</SectionLabel>
          </div>
          <div className="space-y-3">
            {prizes.map((prize, i) => {
              const PrizeIcon = prizeIcons[Math.min(i, prizeIcons.length - 1)]
              const iconColors = ['text-yellow-500', 'text-blue-500', 'text-amber-600', 'text-purple-500']
              const iconBgColors = ['bg-yellow-50', 'bg-blue-50', 'bg-amber-50', 'bg-purple-50']
              const colorIdx = Math.min(i, iconColors.length - 1)

              return (
                <div key={prize.id} className="flex items-center gap-5 rounded-xl border border-gray-100 bg-white p-5">
                  <div className={`size-14 rounded-xl ${iconBgColors[colorIdx]} flex items-center justify-center shrink-0`}>
                    <PrizeIcon className={`size-7 ${iconColors[colorIdx]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground">{prize.name}</h3>
                    {prize.description && (
                      <p className="text-xs text-portal-secondary mt-0.5 line-clamp-1">{prize.description}</p>
                    )}
                  </div>
                  {prize.value && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">Value</span>
                      <p className="text-xl font-bold text-portal-primary">{prize.value}</p>
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

export default function SponsorsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <SponsorsContent />
    </PortalCompetitionLayout>
  )
}
