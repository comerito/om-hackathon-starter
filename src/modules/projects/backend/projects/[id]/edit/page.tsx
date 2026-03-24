"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

async function loadTracks(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/tracks', params)
  return (res?.items ?? []).map((tr) => ({ value: tr.id, label: tr.name }))
}

async function loadTeams(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('teams/teams', params)
  return (res?.items ?? []).map((t) => ({ value: t.id, label: t.name }))
}

type ProjectFormValues = {
  id: string
  title: string
  tagline: string
  description: string
  problem_statement: string
  solution: string
  demo_url: string
  repo_url: string
  video_url: string
  presentation_url: string
  uses_preexisting_code: boolean
  preexisting_code_description: string
  built_during_hackathon_description: string
  flagged_for_reuse: boolean
  flagged_reason: string
  status: string
}

export default function EditProjectPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<ProjectFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'title', label: t('projects.fields.title', 'Title'), type: 'text', required: true },
    { id: 'tagline', label: t('projects.fields.tagline', 'Tagline'), type: 'text', placeholder: 'A short summary (max 140 chars)' },
    { id: 'description', label: t('projects.fields.description', 'Description'), type: 'textarea' },
    { id: 'problem_statement', label: t('projects.fields.problemStatement', 'Problem Statement'), type: 'textarea' },
    { id: 'solution', label: t('projects.fields.solution', 'Solution'), type: 'textarea' },
    { id: 'demo_url', label: t('projects.fields.demoUrl', 'Demo URL'), type: 'text' },
    { id: 'repo_url', label: t('projects.fields.repoUrl', 'Repository URL'), type: 'text' },
    { id: 'video_url', label: t('projects.fields.videoUrl', 'Video URL'), type: 'text' },
    { id: 'presentation_url', label: t('projects.fields.presentationUrl', 'Presentation URL'), type: 'text' },
    { id: 'uses_preexisting_code', label: t('projects.fields.usesPreexistingCode', 'Uses Pre-existing Code'), type: 'checkbox' },
    { id: 'preexisting_code_description', label: t('projects.fields.preexistingCodeDesc', 'Pre-existing Code Description'), type: 'textarea' },
    { id: 'built_during_hackathon_description', label: t('projects.fields.builtDuringDesc', 'Built During Hackathon Description'), type: 'textarea' },
    { id: 'flagged_for_reuse', label: t('projects.fields.flagged', 'Flagged for Reuse'), type: 'checkbox' },
    { id: 'flagged_reason', label: t('projects.fields.flaggedReason', 'Flag Reason'), type: 'textarea' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'content', title: t('projects.groups.content', 'Content'), column: 1, fields: ['title', 'tagline', 'description', 'problem_statement', 'solution'] },
    { id: 'links', title: t('projects.groups.links', 'Links'), column: 2, fields: ['demo_url', 'repo_url', 'video_url', 'presentation_url'] },
    { id: 'originality', title: t('projects.groups.originality', 'Originality Disclosure'), column: 1, fields: ['uses_preexisting_code', 'preexisting_code_description', 'built_during_hackathon_description'] },
    { id: 'flags', title: t('projects.groups.flags', 'Admin Flags'), column: 2, fields: ['flagged_for_reuse', 'flagged_reason'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('projects/projects', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Project not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            title: String(item.title ?? ''),
            tagline: String(item.tagline ?? ''),
            description: String(item.description ?? ''),
            problem_statement: String(item.problem_statement ?? ''),
            solution: String(item.solution ?? ''),
            demo_url: String(item.demo_url ?? ''),
            repo_url: String(item.repo_url ?? ''),
            video_url: String(item.video_url ?? ''),
            presentation_url: String(item.presentation_url ?? ''),
            uses_preexisting_code: Boolean(item.uses_preexisting_code),
            preexisting_code_description: String(item.preexisting_code_description ?? ''),
            built_during_hackathon_description: String(item.built_during_hackathon_description ?? ''),
            flagged_for_reuse: Boolean(item.flagged_for_reuse),
            flagged_reason: String(item.flagged_reason ?? ''),
            status: String(item.status ?? 'draft'),
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

  const fallback = React.useMemo<ProjectFormValues>(() => ({
    id: id ?? '', title: '', tagline: '', description: '', problem_statement: '', solution: '',
    demo_url: '', repo_url: '', video_url: '', presentation_url: '',
    uses_preexisting_code: false, preexisting_code_description: '', built_during_hackathon_description: '',
    flagged_for_reuse: false, flagged_reason: '', status: 'draft',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<ProjectFormValues>
            title={t('projects.edit.title', 'Edit Project')}
            backHref="/backend/projects"
            entityId="projects:project"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('projects.edit.submit', 'Save')}
            cancelHref="/backend/projects"
            successRedirect={`/backend/projects?flash=${encodeURIComponent(t('projects.flash.saved', 'Project saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('projects.edit.loading', 'Loading project...')}
            onSubmit={async (vals) => { await updateCrud('projects/projects', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('projects/projects', String(id))
                pushWithFlash(router, '/backend/projects', t('projects.flash.deleted', 'Project deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : 'Delete failed')
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
