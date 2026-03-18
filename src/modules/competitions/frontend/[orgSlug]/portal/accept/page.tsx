'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  codeOfConductUrl: string
  privacyPolicyUrl: string | null
}

interface Participation {
  id: string
  competitionId: string
  cocAccepted: boolean
  privacyPolicyAccepted: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalAcceptPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [cocChecked, setCocChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (comp) {
        const partRes = await apiCall(`/api/competitions/portal/data?type=participations&competitionId=${comp.id}`)
        const part: Participation | null = partRes?.data?.[0] ?? null
        setParticipation(part)

        // Pre-check if already accepted
        if (part) {
          if (part.cocAccepted) setCocChecked(true)
          if (part.privacyPolicyAccepted) setPrivacyChecked(true)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const handleSubmit = async () => {
    if (!participation || !cocChecked || !privacyChecked) return
    setSubmitting(true)
    try {
      await apiCall('/api/competitions/participations', {
        method: 'PUT',
        body: JSON.stringify({
          id: participation.id,
          cocAccepted: true,
          privacyPolicyAccepted: true,
        }),
      })
      flash(t('competitions.portal.accept.submit'), 'success')
      router.push(`/${params.orgSlug}/portal/dashboard`)
    } catch {
      flash('Failed to save acceptance. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!competition || !participation) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.accept.title')} />
        <PortalEmptyState
          title="No participation found"
          description="You need to be registered for an active competition to accept terms."
        />
      </div>
    )
  }

  // Already accepted both — redirect
  if (participation.cocAccepted && participation.privacyPolicyAccepted) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.accept.title')} />
        <PortalCard>
          <PortalCardHeader label="Status" title="All terms accepted" />
          <p className="mt-2 text-sm text-muted-foreground">
            You have already accepted all required terms.{' '}
            <a
              href={`/${params.orgSlug}/portal/dashboard`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to Dashboard
            </a>
          </p>
        </PortalCard>
      </div>
    )
  }

  const canSubmit = cocChecked && privacyChecked && !submitting

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        label={competition.name}
        title={t('competitions.portal.accept.title')}
        description="Please review and accept the following documents to continue."
      />

      <PortalCard>
        <PortalCardHeader label="Documents" title="Required Agreements" />

        <div className="mt-6 flex flex-col gap-5">
          {/* Code of Conduct */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cocChecked}
              disabled={participation.cocAccepted}
              onChange={(e) => setCocChecked(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium">
                {t('competitions.portal.accept.coc_label')}
              </span>
              <a
                href={competition.codeOfConductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-sm text-primary underline-offset-4 hover:underline"
              >
                View document
              </a>
            </div>
          </label>

          {/* Privacy Policy */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyChecked}
              disabled={participation.privacyPolicyAccepted}
              onChange={(e) => setPrivacyChecked(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium">
                {t('competitions.portal.accept.privacy_label')}
              </span>
              {competition.privacyPolicyUrl && (
                <a
                  href={competition.privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-primary underline-offset-4 hover:underline"
                >
                  View document
                </a>
              )}
            </div>
          </label>
        </div>

        <div className="mt-8">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? 'Saving...' : t('competitions.portal.accept.submit')}
          </Button>
        </div>
      </PortalCard>
    </div>
  )
}
