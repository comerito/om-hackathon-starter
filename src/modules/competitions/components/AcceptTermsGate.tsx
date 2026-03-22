"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { useCompetitionContext } from './CompetitionContext'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ParticipationStatus = {
  cocAccepted: boolean
  privacyPolicyAccepted: boolean
  cocUrl: string | null
  privacyPolicyUrl: string | null
  competitionName: string | null
}

export function AcceptTermsGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId } = useCompetitionContext()
  const [cocChecked, setCocChecked] = React.useState(false)
  const [privacyChecked, setPrivacyChecked] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-participation', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<ParticipationStatus>(
        `/api/competitions/portal/my-participation?competition_id=${selectedId}`,
      )
      return ok ? result : null
    },
    enabled: !!selectedId,
  })

  // If no competition selected, or loading, or already accepted — show children
  if (!selectedId || isLoading || !data) return <>{children}</>
  if (data.cocAccepted && data.privacyPolicyAccepted) return <>{children}</>

  async function handleAccept() {
    if (!selectedId) return
    setSubmitting(true)
    try {
      await apiCall('/api/competitions/portal/accept-terms', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: selectedId,
          accept_coc: cocChecked,
          accept_privacy: privacyChecked,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['portal-my-participation'] })
    } finally {
      setSubmitting(false)
    }
  }

  const needsCoc = !data.cocAccepted
  const needsPrivacy = !data.privacyPolicyAccepted

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-lg rounded-xl border bg-background p-8 shadow-lg">
        <h2 className="text-xl font-bold mb-1">
          {t('competitions.portal.terms.title', 'Accept Terms to Continue')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {data.competitionName
            ? t('competitions.portal.terms.subtitle', 'Before accessing {name}, please review and accept the following:', { name: data.competitionName })
            : t('competitions.portal.terms.subtitleGeneric', 'Please review and accept the following to continue:')}
        </p>

        <div className="space-y-4">
          {needsCoc && (
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={cocChecked}
                onChange={(e) => setCocChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <div>
                <span className="text-sm font-medium">{t('competitions.portal.terms.coc', 'Code of Conduct')}</span>
                {data.cocUrl && (
                  <a href={data.cocUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline mt-0.5">
                    {t('competitions.portal.terms.readDocument', 'Read the full document')} &rarr;
                  </a>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t('competitions.portal.terms.cocDesc', 'I have read and agree to follow the Code of Conduct.')}
                </p>
              </div>
            </label>
          )}

          {needsPrivacy && (
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <div>
                <span className="text-sm font-medium">{t('competitions.portal.terms.privacy', 'Privacy Policy')}</span>
                {data.privacyPolicyUrl && (
                  <a href={data.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline mt-0.5">
                    {t('competitions.portal.terms.readDocument', 'Read the full document')} &rarr;
                  </a>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t('competitions.portal.terms.privacyDesc', 'I have read and agree to the Privacy Policy (GDPR/RODO).')}
                </p>
              </div>
            </label>
          )}
        </div>

        <Button
          className="w-full mt-6"
          disabled={submitting || (needsCoc && !cocChecked) || (needsPrivacy && !privacyChecked)}
          onClick={handleAccept}
        >
          {submitting ? t('common.saving', 'Saving...') : t('competitions.portal.terms.continue', 'Continue')}
        </Button>
      </div>
    </div>
  )
}
