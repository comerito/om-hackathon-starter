'use client'

import { useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalIncidentReportPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth, competition } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('MEDIUM')
  const [reportedUserId, setReportedUserId] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!description.trim() || description.trim().length < 10) {
      flash(t('incidents.portal.error.descriptionShort', 'Description must be at least 10 characters.'), 'error')
      return
    }

    const competitionId = competition?.id
    if (!competitionId) {
      flash(t('incidents.portal.error.noCompetition', 'No active competition found.'), 'error')
      return
    }

    setSubmitting(true)
    try {
      await apiCall('/api/incidents/incidents', {
        method: 'POST',
        body: JSON.stringify({
          competitionId,
          description: description.trim(),
          severity,
          reportedUserId: reportedUserId.trim() || null,
          anonymous,
        }),
      })
      flash(t('incidents.portal.success', 'Incident report submitted. Thank you.'), 'success')
      setSubmitted(true)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to submit report. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [description, severity, reportedUserId, anonymous, competition, t])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader
          title={t('incidents.portal.submitted.title', 'Report Submitted')}
        />
        <PortalCard>
          <PortalCardHeader label="Status" title="Thank You" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              'incidents.portal.submitted.message',
              'Your incident report has been submitted and will be reviewed by the event organizers. If you provided contact information, we may follow up with you.',
            )}
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setDescription('')
                setSeverity('MEDIUM')
                setReportedUserId('')
                setAnonymous(false)
              }}
            >
              {t('incidents.portal.submitted.another', 'Submit Another Report')}
            </Button>
            <Button onClick={() => router.push(`/${params.orgSlug}/portal/dashboard`)}>
              {t('incidents.portal.submitted.dashboard', 'Back to Dashboard')}
            </Button>
          </div>
        </PortalCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        label={competition?.name}
        title={t('incidents.portal.title', 'Report an Incident')}
        description={t(
          'incidents.portal.description',
          'If you have witnessed or experienced a Code of Conduct violation or any safety concern, please report it here. You may submit anonymously.',
        )}
      />

      <PortalCard>
        <PortalCardHeader label="Incident Report" title="Details" />

        <div className="mt-6 flex flex-col gap-5">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t('incidents.portal.field.description', 'What happened?')} *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[150px]"
              placeholder={t(
                'incidents.portal.field.descriptionPlaceholder',
                'Please describe the incident in as much detail as possible. Include what happened, when, where, and who was involved.',
              )}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('incidents.portal.field.descriptionHint', 'Minimum 10 characters')}
            </p>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t('incidents.portal.field.severity', 'Severity Level')}
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-md border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="LOW">{t('incidents.severity.low', 'Low - Minor issue')}</option>
              <option value="MEDIUM">{t('incidents.severity.medium', 'Medium - Needs attention')}</option>
              <option value="HIGH">{t('incidents.severity.high', 'High - Serious concern')}</option>
              <option value="CRITICAL">{t('incidents.severity.critical', 'Critical - Immediate danger')}</option>
            </select>
          </div>

          {/* Reported User (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t('incidents.portal.field.reportedUser', 'Person involved (optional)')}
            </label>
            <input
              type="text"
              value={reportedUserId}
              onChange={(e) => setReportedUserId(e.target.value)}
              className="w-full rounded-md border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t(
                'incidents.portal.field.reportedUserPlaceholder',
                'Name or identifier of the person involved (if known)',
              )}
            />
          </div>

          {/* Anonymous toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium">
                {t('incidents.portal.field.anonymous', 'Submit anonymously')}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'incidents.portal.field.anonymousHint',
                  'Your identity will not be linked to this report. Note: this may limit our ability to follow up.',
                )}
              </p>
            </div>
          </label>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            disabled={submitting || description.trim().length < 10}
            onClick={handleSubmit}
          >
            {submitting
              ? t('incidents.portal.submitting', 'Submitting...')
              : t('incidents.portal.submit', 'Submit Report')
            }
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/${params.orgSlug}/portal/dashboard`)}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </PortalCard>
    </div>
  )
}
