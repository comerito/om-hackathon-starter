"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CompetitionProvider, useCompetitionContext } from '../../../../components/CompetitionContext'
import { CompetitionSelector } from '../../../../components/CompetitionSelector'

function QRContent() {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId, selected } = useCompetitionContext()

  const { data } = useQuery({
    queryKey: ['portal-my-participation-qr', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{ id: string }>(`/api/competitions/portal/my-participation?competition_id=${selectedId}`)
      return ok ? result : null
    },
    enabled: !!selectedId,
  })

  if (!selectedId || !data) {
    return (
      <PortalCard>
        <div className="p-6 text-sm text-muted-foreground">
          {t('competitions.portal.qr.selectCompetition', 'Select a competition to see your QR code.')}
        </div>
      </PortalCard>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <PortalCard>
        <div className="p-8 flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">
            {selected?.name ?? t('competitions.portal.qr.competition', 'Competition')}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {auth.user?.displayName ?? auth.user?.email}
          </p>

          {/* QR Code Display */}
          <div className="bg-white p-4 rounded-lg border-2 border-black mb-4">
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-white relative">
              <div className="text-center">
                <div className="font-mono text-[10px] leading-tight break-all max-w-[230px] p-2 bg-gray-50 rounded border">
                  {data.id}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t('competitions.portal.qr.showToAdmin', 'Show this code to the organizer for check-in')}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {t('competitions.portal.qr.instructions', 'Present this screen at the registration desk. The organizer will scan or enter your code to check you in.')}
          </p>
        </div>
      </PortalCard>
    </div>
  )
}

export default function QRCodePage({ params }: { params: { orgSlug: string } }) {
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
        <PortalPageHeader
          title={t('competitions.portal.qr.title', 'My QR Code')}
          label={t('competitions.portal.qr.label', 'Check-in')}
        />
        <QRContent />
      </div>
    </CompetitionProvider>
  )
}
