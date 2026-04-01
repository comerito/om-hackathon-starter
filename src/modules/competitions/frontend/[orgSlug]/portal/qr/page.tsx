"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'
import { QRCodeSVG } from 'qrcode.react'

function QRContent() {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId, selected, isLoading: contextLoading } = useCompetitionContext()

  const { data } = useQuery({
    queryKey: ['portal-my-participation-qr', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{ id: string }>(`/api/competitions/portal/my-participation?competition_id=${selectedId}`)
      return ok ? result : null
    },
    enabled: !!selectedId,
  })

  if (contextLoading || (!selectedId && !data)) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-8 flex flex-col items-center max-w-md w-full">
          <div className="h-6 w-48 rounded bg-gray-100 dark:bg-white/10 animate-pulse mb-2" />
          <div className="h-4 w-32 rounded bg-gray-100 dark:bg-white/10 animate-pulse mb-6" />
          <div className="size-[220px] rounded-xl bg-gray-100 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!selectedId || !data) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-6 text-sm text-portal-secondary text-center">
        {t('competitions.portal.qr.selectCompetition', 'Select a competition to see your QR code.')}
      </div>
    )
  }

  // The QR code encodes the participation ID for scanning at check-in
  const qrValue = `hackon:checkin:${data.id}`

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-8 flex flex-col items-center max-w-md w-full">
        <h3 className="text-lg font-bold text-foreground">
          {selected?.name ?? t('competitions.portal.qr.fallbackCompetition', 'Competition')}
        </h3>
        <p className="text-sm text-portal-secondary mt-1">
          {auth.user?.displayName ?? auth.user?.email}
        </p>

        {/* QR Code */}
        <div className="mt-6 rounded-xl bg-white dark:bg-white p-4 shadow-sm border border-gray-100 dark:border-white/10">
          <QRCodeSVG
            value={qrValue}
            size={220}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0F172A"
          />
        </div>

        <p className="mt-4 text-xs text-portal-secondary text-center max-w-xs">
          {t('competitions.portal.qr.instructions', 'Present this screen at the registration desk. The organizer will scan or enter your code to check you in.')}
        </p>

        {/* Fallback code for manual entry */}
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-white/5 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary mb-1">
            {t('competitions.portal.qr.manualCode', 'Manual Code')}
          </p>
          <p className="font-mono text-xs text-foreground select-all">{data.id}</p>
        </div>
      </div>
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
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('competitions.portal.qr.label', 'Check-in')}
        title={t('competitions.portal.qr.title', 'My QR Code')}
      />
      <QRContent />
    </PortalCompetitionLayout>
  )
}
