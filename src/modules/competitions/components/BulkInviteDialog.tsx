"use client"
import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ParsedRow = { email: string; display_name: string; role: string }
type InviteResult = { email: string; status: 'sent' | 'skipped' | 'error'; reason?: string }

const VALID_ROLES = ['participant', 'mentor', 'judge']

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const emailIdx = header.findIndex(h => h === 'email')
  const nameIdx = header.findIndex(h => ['displayname', 'display_name', 'name'].includes(h))
  const roleIdx = header.findIndex(h => h === 'role')

  if (emailIdx < 0) return []

  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Simple CSV parse (handles quoted fields)
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())

    return {
      email: (values[emailIdx] ?? '').toLowerCase().trim(),
      display_name: nameIdx >= 0 ? (values[nameIdx] ?? '').trim() : '',
      role: roleIdx >= 0 ? (values[roleIdx] ?? 'participant').toLowerCase().trim() : 'participant',
    }
  })
}

function validateRow(row: ParsedRow, idx: number): string | null {
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return `Row ${idx + 1}: Invalid email "${row.email}"`
  if (!row.display_name) return `Row ${idx + 1}: Display name is empty`
  if (!VALID_ROLES.includes(row.role)) return `Row ${idx + 1}: Invalid role "${row.role}" (must be participant, mentor, or judge)`
  return null
}

type Competition = { id: string; name: string }

export function BulkInviteDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [step, setStep] = React.useState<'upload' | 'preview' | 'sending' | 'results'>('upload')

  // Competition selector
  const [competitions, setCompetitions] = React.useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState('')
  const [selectedCompetitionName, setSelectedCompetitionName] = React.useState('')

  // CSV data
  const [parsedRows, setParsedRows] = React.useState<ParsedRow[]>([])
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])

  // Results
  const [results, setResults] = React.useState<InviteResult[]>([])
  const [summary, setSummary] = React.useState<{ total: number; sent: number; skipped: number; errors: number } | null>(null)

  // Load competitions
  React.useEffect(() => {
    fetchCrudList<Competition>('competitions/competitions', { pageSize: '50' }).then(data => {
      setCompetitions(data?.items ?? [])
    })
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setValidationErrors(['Could not parse CSV. Ensure the first row is a header with at least an "email" column.'])
        return
      }

      // De-duplicate by email
      const seen = new Set<string>()
      const unique: ParsedRow[] = []
      for (const row of rows) {
        if (seen.has(row.email)) continue
        seen.add(row.email)
        unique.push(row)
      }

      // Validate
      const errors: string[] = []
      for (let i = 0; i < unique.length; i++) {
        const err = validateRow(unique[i], i)
        if (err) errors.push(err)
      }

      setParsedRows(unique)
      setValidationErrors(errors)
      if (errors.length === 0) setStep('preview')
    }
    reader.readAsText(file)
  }

  async function handleSend() {
    if (!selectedCompetitionId || parsedRows.length === 0) return
    setStep('sending')

    // Get orgSlug from URL
    const orgSlug = window.location.pathname.split('/')[1] || 'default'

    const { ok, result } = await apiCall<{
      total: number; sent: number; skipped: number
      errors: Array<{ email: string; reason: string }>
      results: InviteResult[]
    }>('/api/competitions/admin/bulk-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition_id: selectedCompetitionId,
        org_slug: orgSlug,
        invitees: parsedRows,
      }),
    })

    if (ok && result) {
      setResults(result.results ?? [])
      setSummary({ total: result.total, sent: result.sent, skipped: result.skipped, errors: result.errors?.length ?? 0 })
    } else {
      setSummary({ total: parsedRows.length, sent: 0, skipped: 0, errors: parsedRows.length })
    }
    setStep('results')
  }

  const validRows = parsedRows.filter((_, i) => !validateRow(parsedRows[i], i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{t('competitions.bulkInvite.title', 'Bulk Invite Participants')}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
          </button>
        </div>

        {/* Competition selector (always visible) */}
        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium">Competition</label>
          <select
            value={selectedCompetitionId}
            onChange={(e) => {
              setSelectedCompetitionId(e.target.value)
              setSelectedCompetitionName(competitions.find(c => c.id === e.target.value)?.name ?? '')
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select competition...</option>
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">CSV File</label>
              <p className="text-xs text-muted-foreground mb-2">
                Columns: <code className="bg-muted px-1 rounded">email</code>, <code className="bg-muted px-1 rounded">displayname</code> (or <code className="bg-muted px-1 rounded">name</code>), <code className="bg-muted px-1 rounded">role</code> (participant/mentor/judge)
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
              />
            </div>
            {validationErrors.length > 0 && (
              <div className="rounded-md border border-portal-danger/20 bg-portal-danger/5 p-3">
                <p className="text-sm font-medium text-portal-danger mb-1">Validation Errors</p>
                <ul className="list-disc pl-5 text-xs text-portal-danger space-y-0.5">
                  {validationErrors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                  {validationErrors.length > 10 && <li>...and {validationErrors.length - 10} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{parsedRows.length}</span> invitees parsed
              {validationErrors.length > 0 && (
                <span className="text-portal-danger">({validationErrors.length} with errors)</span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-medium">Email</th>
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const err = validateRow(row, i)
                    return (
                      <tr key={i} className={err ? 'bg-portal-danger/5' : 'border-b last:border-0'}>
                        <td className="p-2">{row.email}</td>
                        <td className="p-2">{row.display_name || <span className="text-portal-danger">—</span>}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            VALID_ROLES.includes(row.role) ? 'bg-primary/10 text-primary' : 'bg-portal-danger/10 text-portal-danger'
                          }`}>{row.role}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsedRows([]); setValidationErrors([]) }}>
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={!selectedCompetitionId || validationErrors.length > 0}
              >
                Send {parsedRows.length} Invitations
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Sending invitations to {parsedRows.length} people...</p>
          </div>
        )}

        {step === 'results' && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-portal-success/10 p-3 text-center">
                <p className="text-2xl font-bold text-portal-success">{summary.sent}</p>
                <p className="text-xs text-portal-success/70">Sent</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{summary.skipped}</p>
                <p className="text-xs text-amber-600/70">Skipped</p>
              </div>
              <div className="rounded-lg bg-portal-danger/10 p-3 text-center">
                <p className="text-2xl font-bold text-portal-danger">{summary.errors}</p>
                <p className="text-xs text-portal-danger/70">Errors</p>
              </div>
            </div>

            {results.filter(r => r.status !== 'sent').length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-medium">Email</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.filter(r => r.status !== 'sent').map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'skipped' ? 'bg-amber-50 text-amber-700' : 'bg-portal-danger/10 text-portal-danger'
                          }`}>{r.status}</span>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{r.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => { onClose(); flash(`${summary.sent} invitations sent`, 'success') }}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
