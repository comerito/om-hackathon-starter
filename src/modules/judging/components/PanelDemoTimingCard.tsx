"use client"
import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { DEFAULT_PRESENTATION_MINUTES, DEFAULT_QA_MINUTES } from '../lib/demoDurations'

/* Presentation + Q&A time for the demos a judging panel hears. Empty = the default. */

function toInput(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : ''
}

function parseMinutes(value: string, min: number, max: number): number | null | 'invalid' {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : 'invalid'
}

export function PanelDemoTimingCard({
  panelId,
  presentationMinutes,
  qaMinutes,
  onSaved,
}: {
  panelId: string
  presentationMinutes: number | null | undefined
  qaMinutes: number | null | undefined
  onSaved: () => void | Promise<void>
}) {
  const t = useT()
  const [presentation, setPresentation] = React.useState(toInput(presentationMinutes))
  const [qa, setQa] = React.useState(toInput(qaMinutes))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => { setPresentation(toInput(presentationMinutes)) }, [presentationMinutes])
  React.useEffect(() => { setQa(toInput(qaMinutes)) }, [qaMinutes])

  const parsedPresentation = parseMinutes(presentation, 1, 120)
  const parsedQa = parseMinutes(qa, 0, 60)
  const invalid = parsedPresentation === 'invalid' || parsedQa === 'invalid'
  const dirty = presentation.trim() !== toInput(presentationMinutes) || qa.trim() !== toInput(qaMinutes)

  async function handleSave() {
    if (invalid || !dirty) return
    setSaving(true)
    try {
      await updateCrud('judging/panels', {
        id: panelId,
        presentation_duration_minutes: parsedPresentation,
        qa_duration_minutes: parsedQa,
      })
      flash(t('judging.panelTiming.saved', 'Demo timing saved. Demos that have not started yet use the new times.'), 'success')
      await onSaved()
    } catch (error) {
      flash(error instanceof Error ? error.message : t('judging.panelTiming.saveFailed', 'Could not save demo timing'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="mb-6 rounded-lg border bg-background p-5 space-y-4"
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave() }}
    >
      <div>
        <h3 className="text-sm font-semibold">{t('judging.panelTiming.title', 'Demo timing')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('judging.panelTiming.help', 'Applies to the demos of the tracks assigned to this panel. Leave a field empty to use the default ({presentation} min presentation, {qa} min Q&A). Demos that are on stage or finished keep the times they ran with.', {
            presentation: DEFAULT_PRESENTATION_MINUTES,
            qa: DEFAULT_QA_MINUTES,
          })}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="panel-presentation-minutes">{t('judging.panelTiming.presentation', 'Presentation time (minutes)')}</Label>
          <Input
            id="panel-presentation-minutes"
            type="number"
            min={1}
            max={120}
            step={1}
            inputMode="numeric"
            value={presentation}
            placeholder={String(DEFAULT_PRESENTATION_MINUTES)}
            aria-invalid={parsedPresentation === 'invalid'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresentation(e.target.value)}
          />
          {parsedPresentation === 'invalid' && (
            <p className="text-xs text-destructive">{t('judging.panelTiming.presentationInvalid', 'Whole minutes, 1 to 120')}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="panel-qa-minutes">{t('judging.panelTiming.qa', 'Q&A time (minutes)')}</Label>
          <Input
            id="panel-qa-minutes"
            type="number"
            min={0}
            max={60}
            step={1}
            inputMode="numeric"
            value={qa}
            placeholder={String(DEFAULT_QA_MINUTES)}
            aria-invalid={parsedQa === 'invalid'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQa(e.target.value)}
          />
          {parsedQa === 'invalid' && (
            <p className="text-xs text-destructive">{t('judging.panelTiming.qaInvalid', 'Whole minutes, 0 to 60 (0 = no Q&A)')}</p>
          )}
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={!dirty || invalid || saving}>
        {saving ? t('judging.panelTiming.saving', 'Saving...') : t('judging.panelTiming.save', 'Save timing')}
      </Button>
    </div>
  )
}
