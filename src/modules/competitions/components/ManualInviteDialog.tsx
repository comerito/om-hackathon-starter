"use client"
import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type InviteResult = { email: string; status: 'sent' | 'skipped' | 'error'; reason?: string }

const VALID_ROLES = ['participant', 'mentor', 'judge'] as const

type Competition = { id: string; name: string }

export function ManualInviteDialog({ onClose }: { onClose: () => void }) {
  const t = useT()

  // Competition selector
  const [competitions, setCompetitions] = React.useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState('')

  // Form fields
  const [email, setEmail] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [role, setRole] = React.useState<string>('participant')

  // State
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState<InviteResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Load competitions
  React.useEffect(() => {
    fetchCrudList<Competition>('competitions/competitions', { pageSize: '50' }).then(data => {
      setCompetitions(data?.items ?? [])
    })
  }, [])

  function validate(): string | null {
    if (!selectedCompetitionId) return 'Please select a competition'
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address'
    if (!displayName.trim()) return 'Please enter a display name'
    return null
  }

  async function handleSend() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSending(true)

    const orgSlug = window.location.pathname.split('/')[1] || 'default'

    const { ok, result: apiResult } = await apiCall<{
      total: number; sent: number; skipped: number
      errors: Array<{ email: string; reason: string }>
      results: InviteResult[]
    }>('/api/competitions/admin/bulk-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition_id: selectedCompetitionId,
        org_slug: orgSlug,
        invitees: [{
          email: email.trim().toLowerCase(),
          display_name: displayName.trim(),
          role,
        }],
      }),
    })

    setSending(false)

    if (ok && apiResult?.results?.[0]) {
      setResult(apiResult.results[0])
    } else {
      setResult({ email: email.trim(), status: 'error', reason: 'Request failed' })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !sending && !result) {
      handleSend()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{t('competitions.manualInvite.title', 'Invite Participant')}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            {/* Competition */}
            <div>
              <label className="mb-1 block text-sm font-medium">Competition</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select competition...</option>
                {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@example.com"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                autoFocus
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="mb-1 block text-sm font-medium">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            {/* Role */}
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {VALID_ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-portal-danger">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result.status === 'sent' ? (
              <div className="rounded-lg bg-portal-success/10 p-4 text-center">
                <p className="text-sm font-medium text-portal-success">Invitation sent to {result.email}</p>
              </div>
            ) : result.status === 'skipped' ? (
              <div className="rounded-lg bg-amber-50 p-4 text-center">
                <p className="text-sm font-medium text-amber-600">Skipped: {result.reason}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-portal-danger/10 p-4 text-center">
                <p className="text-sm font-medium text-portal-danger">Error: {result.reason}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => {
                onClose()
                if (result.status === 'sent') flash(`Invitation sent to ${result.email}`, 'success')
              }}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
