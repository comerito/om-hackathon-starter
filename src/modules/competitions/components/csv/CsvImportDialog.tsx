"use client"
import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { parseCSV, type CsvColumnDef } from './parseCSV'

type Competition = { id: string; name: string }

export type ImportResult = { label: string; status: 'created' | 'error'; reason?: string }
export type BulkImportResponse = {
  total: number
  created: number
  errors: Array<{ label: string; reason: string }>
  results: ImportResult[]
}

export type PreviewColumnDef<T> = {
  key: keyof T & string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
}

export type CsvImportDialogProps<TRow extends Record<string, unknown>> = {
  title: string
  onClose: () => void
  columns: CsvColumnDef[]
  previewColumns: PreviewColumnDef<TRow>[]
  validateRow: (row: TRow, idx: number) => string | null
  apiEndpoint: string
  maxRows: number
  templateCsv: string
  templateFilename: string
  entityLabel: string
}

export function CsvImportDialog<TRow extends Record<string, unknown>>({
  title, onClose, columns, previewColumns, validateRow,
  apiEndpoint, maxRows, templateCsv, templateFilename, entityLabel,
}: CsvImportDialogProps<TRow>) {
  const t = useT()
  const [step, setStep] = React.useState<'upload' | 'preview' | 'sending' | 'results'>('upload')

  const [competitions, setCompetitions] = React.useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState('')

  const [parsedRows, setParsedRows] = React.useState<TRow[]>([])
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])

  const [results, setResults] = React.useState<ImportResult[]>([])
  const [summary, setSummary] = React.useState<{ total: number; created: number; errors: number } | null>(null)

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
      const { rows, errors: parseErrors } = parseCSV<TRow>(text, columns)

      if (parseErrors.length > 0) {
        setValidationErrors(parseErrors)
        return
      }
      if (rows.length === 0) {
        setValidationErrors(['No data rows found in CSV.'])
        return
      }
      if (rows.length > maxRows) {
        setValidationErrors([`Too many rows (${rows.length}). Maximum is ${maxRows}.`])
        return
      }

      const errors: string[] = []
      for (let i = 0; i < rows.length; i++) {
        const err = validateRow(rows[i], i)
        if (err) errors.push(err)
      }

      setParsedRows(rows)
      setValidationErrors(errors)
      if (errors.length === 0) setStep('preview')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!selectedCompetitionId || parsedRows.length === 0) return
    setStep('sending')

    const { ok, result } = await apiCall<BulkImportResponse>(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition_id: selectedCompetitionId,
        items: parsedRows,
      }),
    })

    if (ok && result) {
      setResults(result.results ?? [])
      setSummary({ total: result.total, created: result.created, errors: result.errors?.length ?? 0 })
    } else {
      setSummary({ total: parsedRows.length, created: 0, errors: parsedRows.length })
    }
    setStep('results')
  }

  function handleDownloadTemplate() {
    const blob = new Blob([templateCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = templateFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
          </button>
        </div>

        {/* Competition selector */}
        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium">{t('competitions.import.competition', 'Competition')}</label>
          <select
            value={selectedCompetitionId}
            onChange={(e) => setSelectedCompetitionId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t('competitions.import.selectCompetition', 'Select competition...')}</option>
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('competitions.import.csvFile', 'CSV File')}</label>
              <p className="text-xs text-muted-foreground mb-2">
                Columns: {columns.map((c, i) => (
                  <span key={c.key}>
                    {i > 0 && ', '}
                    <code className={`bg-muted px-1 rounded ${c.required ? 'font-bold' : ''}`}>{c.csvHeaders[0]}</code>
                    {c.required && <span className="text-portal-danger">*</span>}
                  </span>
                ))}
              </p>
              <div className="flex gap-3 items-center">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  {t('competitions.import.downloadTemplate', 'Template')}
                </Button>
              </div>
            </div>
            {validationErrors.length > 0 && (
              <div className="rounded-md border border-portal-danger/20 bg-portal-danger/5 p-3">
                <p className="text-sm font-medium text-portal-danger mb-1">{t('competitions.import.validationErrors', 'Validation Errors')}</p>
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
              <span className="font-medium text-foreground">{parsedRows.length}</span> {entityLabel} parsed
              {validationErrors.length > 0 && (
                <span className="text-portal-danger">({validationErrors.length} with errors)</span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {previewColumns.map(col => (
                      <th key={col.key} className="p-2 text-left font-medium">{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const err = validateRow(row, i)
                    return (
                      <tr key={i} className={err ? 'bg-portal-danger/5' : 'border-b last:border-0'}>
                        {previewColumns.map(col => (
                          <td key={col.key} className="p-2">
                            {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsedRows([]); setValidationErrors([]) }}>
                {t('competitions.import.back', 'Back')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedCompetitionId || validationErrors.length > 0}
              >
                {t('competitions.import.importButton', `Import ${parsedRows.length} ${entityLabel}`)}
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              {t('competitions.import.importing', `Importing ${parsedRows.length} ${entityLabel}...`)}
            </p>
          </div>
        )}

        {step === 'results' && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-portal-success/10 p-3 text-center">
                <p className="text-2xl font-bold text-portal-success">{summary.created}</p>
                <p className="text-xs text-portal-success/70">{t('competitions.import.created', 'Created')}</p>
              </div>
              <div className="rounded-lg bg-portal-danger/10 p-3 text-center">
                <p className="text-2xl font-bold text-portal-danger">{summary.errors}</p>
                <p className="text-xs text-portal-danger/70">{t('competitions.import.errors', 'Errors')}</p>
              </div>
            </div>

            {results.filter(r => r.status === 'error').length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-medium">{t('competitions.import.item', 'Item')}</th>
                      <th className="p-2 text-left font-medium">{t('competitions.import.reason', 'Reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.filter(r => r.status === 'error').map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{r.label}</td>
                        <td className="p-2 text-xs text-muted-foreground">{r.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => { onClose(); flash(`${summary.created} ${entityLabel} imported`, 'success') }}>
                {t('competitions.import.done', 'Done')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
