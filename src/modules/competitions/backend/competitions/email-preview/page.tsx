"use client"
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Input } from '@open-mercato/ui/primitives/input'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { InvitationEmail } from '../../../emails/InvitationEmail'

const ROLE_OPTIONS = [
  { value: 'participant', label: 'Participant' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
]

export default function EmailPreviewPage() {
  const t = useT()
  const [competitionName, setCompetitionName] = React.useState('HackOn Sopot 2026')
  const [displayName, setDisplayName] = React.useState('Jane Smith')
  const [role, setRole] = React.useState('participant')

  const acceptUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/acme-corp/portal/accept-invite?token=preview-token-example`

  const emailHtml = React.useMemo(() => {
    try {
      return renderToStaticMarkup(
        InvitationEmail({ competitionName, displayName, role, acceptUrl }),
      )
    } catch {
      return '<p>Error rendering template</p>'
    }
  }, [competitionName, displayName, role, acceptUrl])

  return (
    <Page>
      <PageBody>
        <div className="mb-6">
          <h1 className="text-xl font-bold">{t('competitions.emailPreview.title', 'Invitation Email Preview')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('competitions.emailPreview.description', 'Preview how the invitation email will look to recipients. Edit the sample data below.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Controls */}
          <div className="space-y-4 rounded-lg border bg-background p-5">
            <h3 className="text-sm font-semibold">Sample Data</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Competition Name</label>
              <Input
                value={competitionName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompetitionName(e.target.value)}
                placeholder="Competition name"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Recipient Name</label>
              <Input
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                placeholder="Recipient display name"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="pt-2 border-t">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                To edit the template itself, modify:<br />
                <code className="text-[10px] bg-muted px-1 rounded">src/modules/competitions/emails/InvitationEmail.tsx</code>
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            {/* Email header info */}
            <div className="rounded-lg border bg-background p-4 text-sm">
              <div className="grid grid-cols-[60px_1fr] gap-y-1.5 text-xs">
                <span className="font-medium text-muted-foreground">From:</span>
                <span>no-reply@yourdomain.com</span>
                <span className="font-medium text-muted-foreground">To:</span>
                <span>jane.smith@example.com</span>
                <span className="font-medium text-muted-foreground">Subject:</span>
                <span className="font-semibold">You're invited to {competitionName}</span>
              </div>
            </div>

            {/* Email body rendered in iframe */}
            <div className="rounded-lg border overflow-hidden bg-white">
              <iframe
                srcDoc={emailHtml}
                title="Email Preview"
                className="w-full border-0"
                style={{ height: 600 }}
                sandbox=""
              />
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
