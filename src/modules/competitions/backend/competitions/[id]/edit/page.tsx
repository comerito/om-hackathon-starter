"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'

const STAGE_ORDER = [
  'draft', 'open', 'team_formation', 'track_selection',
  'hacking', 'demos', 'deliberation', 'finished', 'archived',
]

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft', open: 'Registration Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking',
  demos: 'Demos', deliberation: 'Deliberation',
  finished: 'Finished', archived: 'Archived',
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  open: 'Participants can register and accept the Code of Conduct.',
  team_formation: 'Participants form teams and send invitations.',
  track_selection: 'Teams choose their competition track.',
  hacking: 'Teams build their projects. Draft projects auto-created for all teams. Team membership locked.',
  demos: 'Remaining draft projects auto-published. Demo presentation queue generated.',
  deliberation: 'Judges deliberate. Voting closes.',
  finished: 'Final scores calculated. Rankings published. Results visible to all.',
  archived: 'Competition archived. No further changes.',
}

type CompetitionFormValues = {
  id: string
  name: string
  slug: string
  description: string
  location: string
  starts_at: string
  ends_at: string
  timezone: string
  min_team_size: number
  max_team_size: number
  max_tracks_per_team: number
  code_of_conduct_url: string
  code_of_conduct_content: string
  rules_url: string
  rules_content: string
  privacy_policy_url: string
  privacy_policy_content: string
  cover_image_url: string
  stage: string
}

export default function EditCompetitionPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<CompetitionFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [advancing, setAdvancing] = React.useState(false)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('competitions.fields.name', 'Name'), type: 'text', required: true },
    { id: 'slug', label: t('competitions.fields.slug', 'Slug'), type: 'text', required: true },
    { id: 'description', label: t('competitions.fields.description', 'Description'), type: 'textarea' },
    { id: 'location', label: t('competitions.fields.location', 'Location'), type: 'text' },
    { id: 'starts_at', label: t('competitions.fields.startsAt', 'Starts At'), type: 'datetime', required: true },
    { id: 'ends_at', label: t('competitions.fields.endsAt', 'Ends At'), type: 'datetime', required: true },
    { id: 'timezone', label: t('competitions.fields.timezone', 'Timezone'), type: 'text' },
    { id: 'min_team_size', label: t('competitions.fields.minTeamSize', 'Min Team Size'), type: 'number' },
    { id: 'max_team_size', label: t('competitions.fields.maxTeamSize', 'Max Team Size'), type: 'number' },
    { id: 'max_tracks_per_team', label: t('competitions.fields.maxTracksPerTeam', 'Max Tracks per Team'), type: 'number' },
    { id: 'code_of_conduct_url', label: t('competitions.fields.cocUrl', 'Code of Conduct URL'), type: 'text', required: true },
    { id: 'code_of_conduct_content', label: t('competitions.fields.cocContent', 'Code of Conduct Content (Markdown)'), type: 'textarea' },
    { id: 'rules_url', label: t('competitions.fields.rulesUrl', 'Rules URL'), type: 'text' },
    { id: 'rules_content', label: t('competitions.fields.rulesContent', 'Rules Content (Markdown)'), type: 'textarea' },
    { id: 'privacy_policy_url', label: t('competitions.fields.privacyPolicyUrl', 'Privacy Policy URL'), type: 'text' },
    { id: 'privacy_policy_content', label: t('competitions.fields.privacyPolicyContent', 'Privacy Policy Content (Markdown)'), type: 'textarea' },
    { id: 'cover_image_url', label: t('competitions.fields.coverImageUrl', 'Cover Image URL'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('competitions.groups.general', 'General'), column: 1, fields: ['name', 'slug', 'description', 'location'] },
    { id: 'schedule', title: t('competitions.groups.schedule', 'Schedule'), column: 2, fields: ['starts_at', 'ends_at', 'timezone'] },
    { id: 'teams', title: t('competitions.groups.teams', 'Team Settings'), column: 1, fields: ['min_team_size', 'max_team_size', 'max_tracks_per_team'] },
    {
      id: 'legal',
      title: t('competitions.groups.legal', 'Legal & Media'),
      column: 2,
      fields: [
        'code_of_conduct_url',
        'code_of_conduct_content',
        'rules_url',
        'rules_content',
        'privacy_policy_url',
        'privacy_policy_content',
        'cover_image_url',
      ],
    },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('competitions/competitions', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Competition not found')
        if (!cancelled) {
          // Convert ISO dates to datetime-local format (YYYY-MM-DDTHH:MM)
          const toLocal = (iso: unknown) => {
            if (!iso) return ''
            const s = String(iso)
            try { return new Date(s).toISOString().slice(0, 16) } catch { return s.slice(0, 16) }
          }
          setInitial({
            id: String(item.id),
            name: String(item.name ?? ''),
            slug: String(item.slug ?? ''),
            description: String(item.description ?? ''),
            location: String(item.location ?? ''),
            starts_at: toLocal(item.starts_at),
            ends_at: toLocal(item.ends_at),
            timezone: String(item.timezone ?? 'Europe/Warsaw'),
            min_team_size: Number(item.min_team_size ?? 2),
            max_team_size: Number(item.max_team_size ?? 5),
            max_tracks_per_team: Number(item.max_tracks_per_team ?? 1),
            code_of_conduct_url: String(item.code_of_conduct_url ?? ''),
            code_of_conduct_content: String(item.code_of_conduct_content ?? ''),
            rules_url: String(item.rules_url ?? ''),
            rules_content: String(item.rules_content ?? ''),
            privacy_policy_url: String(item.privacy_policy_url ?? ''),
            privacy_policy_content: String(item.privacy_policy_content ?? ''),
            cover_image_url: String(item.cover_image_url ?? ''),
            stage: String(item.stage ?? 'draft'),
          })
        }
      } catch (error: unknown) {
        if (!cancelled) setErr(error instanceof Error ? error.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const fallback = React.useMemo<CompetitionFormValues>(() => ({
    id: id ?? '', name: '', slug: '', description: '', location: '',
    starts_at: '', ends_at: '', timezone: 'Europe/Warsaw',
    min_team_size: 2, max_team_size: 5, max_tracks_per_team: 1,
    code_of_conduct_url: '', code_of_conduct_content: '', rules_url: '', rules_content: '',
    privacy_policy_url: '', privacy_policy_content: '', cover_image_url: '', stage: 'draft',
  }), [id])

  const currentStage = initial?.stage ?? 'draft'
  const currentStageIdx = STAGE_ORDER.indexOf(currentStage)
  const nextStage = currentStageIdx >= 0 && currentStageIdx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[currentStageIdx + 1]
    : null

  async function handleAdvanceStage() {
    if (!id || !nextStage) return
    const description = STAGE_DESCRIPTIONS[nextStage] ?? ''
    const confirmTitle = description
      ? `Advance to ${STAGE_LABELS[nextStage]}?\n\n${description}\n\nThis action cannot be undone.`
      : `Advance to ${STAGE_LABELS[nextStage]}? This action cannot be undone.`
    const confirmed = await confirm({
      title: confirmTitle,
      variant: 'default',
    })
    if (!confirmed) return

    setAdvancing(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string; competition?: { stage: string } }>(
        '/api/competitions/advance-stage',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ competition_id: id, target_stage: nextStage }),
        },
      )
      if (ok && result?.competition) {
        flash(`Stage advanced to ${STAGE_LABELS[result.competition.stage] ?? result.competition.stage}`, 'success')
        setInitial(prev => prev ? { ...prev, stage: result.competition!.stage } : prev)
      } else {
        flash(result?.error ?? 'Failed to advance stage', 'error')
      }
    } catch (advErr) {
      flash(advErr instanceof Error ? advErr.message : 'Failed to advance stage', 'error')
    } finally {
      setAdvancing(false)
    }
  }

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <>
          {/* Stage Control Panel */}
          {!loading && initial && (
            <div className="mb-6 rounded-lg border bg-card p-6">
              <h3 className="text-sm font-semibold mb-4">{t('competitions.edit.stageControl', 'Stage Control')}</h3>

              {/* Stage progress bar */}
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
                {STAGE_ORDER.map((stage, idx) => {
                  const isCurrent = stage === currentStage
                  const isPast = idx < currentStageIdx
                  const isFuture = idx > currentStageIdx
                  return (
                    <React.Fragment key={stage}>
                      {idx > 0 && (
                        <div className={`h-0.5 w-4 shrink-0 ${isPast ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                      <div
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                            : isPast
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        title={STAGE_DESCRIPTIONS[stage] ?? ''}
                      >
                        {STAGE_LABELS[stage] ?? stage}
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Advance button */}
              {nextStage ? (
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleAdvanceStage}
                    disabled={advancing}
                    variant={nextStage === 'finished' || nextStage === 'demos' ? 'destructive' : 'default'}
                  >
                    {advancing
                      ? t('competitions.edit.advancing', 'Advancing...')
                      : `${t('competitions.edit.advanceTo', 'Advance to')} ${STAGE_LABELS[nextStage] ?? nextStage}`
                    }
                  </Button>
                  {STAGE_DESCRIPTIONS[nextStage] && (
                    <p className="text-xs text-muted-foreground max-w-md">
                      {STAGE_DESCRIPTIONS[nextStage]}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('competitions.edit.finalStage', 'This competition has reached its final stage.')}
                </p>
              )}
            </div>
          )}

          {!loading && initial && (
            <div className="mb-6 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t('competitions.edit.infoCards.title', 'Portal Info Cards')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('competitions.edit.infoCards.description', 'Manage competition info cards as separate localized records instead of JSON.')}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/backend/competitions/info-cards?competitionId=${encodeURIComponent(initial.id)}`}>
                    {t('competitions.edit.infoCards.manage', 'Manage Info Cards')}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <CrudForm<CompetitionFormValues>
            title={t('competitions.edit.title', 'Edit Competition')}
            backHref="/backend/competitions"
            entityId="competitions:competition"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('competitions.edit.submit', 'Save')}
            cancelHref="/backend/competitions"
            successRedirect={`/backend/competitions?flash=${encodeURIComponent(t('competitions.flash.saved', 'Competition saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('competitions.edit.loading', 'Loading competition...')}
            onSubmit={async (vals) => {
              // Convert datetime-local to ISO and empty URLs to null
              const cleaned = {
                ...vals,
                starts_at: vals.starts_at ? new Date(vals.starts_at).toISOString() : undefined,
                ends_at: vals.ends_at ? new Date(vals.ends_at).toISOString() : undefined,
                code_of_conduct_url: vals.code_of_conduct_url,
                code_of_conduct_content: vals.code_of_conduct_content || null,
                rules_url: vals.rules_url || null,
                rules_content: vals.rules_content || null,
                privacy_policy_url: vals.privacy_policy_url || null,
                privacy_policy_content: vals.privacy_policy_content || null,
                cover_image_url: vals.cover_image_url || null,
              }
              await updateCrud('competitions/competitions', cleaned)
            }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('competitions/competitions', String(id))
                pushWithFlash(router, '/backend/competitions', t('competitions.flash.deleted', 'Competition deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : 'Delete failed')
              }
            }}
          />
          </>
        )}
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
