"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

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

type AttachmentInfo = {
  id: string
  file_name: string
  mime_type: string
  file_size: number
  created_at: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EditProjectPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const id = params?.id
  const [initial, setInitial] = React.useState<ProjectFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [screenshots, setScreenshots] = React.useState<AttachmentInfo[]>([])
  const [attachments, setAttachments] = React.useState<AttachmentInfo[]>([])
  const [projectStatus, setProjectStatus] = React.useState<string>('draft')

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
          setProjectStatus(String(item.status ?? 'draft'))
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

          // Fetch attachment details from core attachments API
          const screenshotIdList = Array.isArray(item.screenshot_ids) ? item.screenshot_ids as string[] : []
          const attachmentIdList = Array.isArray(item.attachment_ids) ? item.attachment_ids as string[] : []

          if (screenshotIdList.length > 0 || attachmentIdList.length > 0) {
            try {
              const res = await apiCall(`/api/attachments/attachments?entityId=projects:project&recordId=${item.id}`)
              const attItems: Array<{ id: string; fileName: string; mimeType: string | null; fileSize: number; createdAt: string; tags?: string[] }> = res?.items ?? []
              const ssSet = new Set(screenshotIdList)
              const atSet = new Set(attachmentIdList)
              if (!cancelled) {
                setScreenshots(attItems.filter(a => ssSet.has(a.id)).map(a => ({
                  id: a.id, file_name: a.fileName, mime_type: a.mimeType ?? 'application/octet-stream',
                  file_size: a.fileSize, created_at: a.createdAt,
                })))
                setAttachments(attItems.filter(a => atSet.has(a.id)).map(a => ({
                  id: a.id, file_name: a.fileName, mime_type: a.mimeType ?? 'application/octet-stream',
                  file_size: a.fileSize, created_at: a.createdAt,
                })))
              }
            } catch {
              // Attachments are supplementary — don't block the page
            }
          }
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

  async function handleUnpublish() {
    if (!id) return
    const confirmed = await confirm({
      title: t('projects.table.confirmUnpublish', 'Unpublish this project?'),
      description: t('projects.table.confirmUnpublishDesc', 'This will revert the project to Draft status. The team will need to re-submit.'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await updateCrud('projects/projects', { id, status: 'draft', submitted_at: null })
      setProjectStatus('draft')
      flash(t('projects.flash.unpublished', 'Project unpublished — reverted to Draft'), 'success')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Unpublish failed', 'error')
    }
  }

  if (!id) return null

  const hasFiles = screenshots.length > 0 || attachments.length > 0

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <>
            {/* Emergency unpublish banner */}
            {projectStatus === 'published' && (
              <div className="mb-4 rounded-lg border border-orange-500/50 bg-orange-50 p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-orange-800">
                    {t('projects.edit.publishedWarning', 'This project is Published')}
                  </h3>
                  <p className="text-xs text-orange-700 mt-0.5">
                    {t('projects.edit.unpublishHint', 'Use the button to revert it to Draft. The team will need to re-submit.')}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={handleUnpublish}>
                  {t('projects.edit.unpublish', 'Unpublish')}
                </Button>
              </div>
            )}

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

            {/* Attachments section */}
            {hasFiles && (
              <div className="mt-6 rounded-lg border bg-card p-4">
                <h3 className="text-base font-semibold mb-4">{t('projects.edit.attachments', 'Attachments')}</h3>

                {screenshots.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {t('projects.edit.screenshots', 'Screenshots')} ({screenshots.length})
                    </h4>
                    <div className="space-y-1">
                      {screenshots.map((file) => (
                        <div key={file.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 text-muted-foreground">🖼</span>
                            <span className="truncate">{file.file_name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                          </div>
                          <a
                            href={`/api/attachments/file/${file.id}?download=1`}
                            className="shrink-0 ml-2 text-xs font-medium text-primary hover:underline"
                            download
                          >
                            {t('projects.edit.download', 'Download')}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {t('projects.edit.files', 'Files')} ({attachments.length})
                    </h4>
                    <div className="space-y-1">
                      {attachments.map((file) => (
                        <div key={file.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 text-muted-foreground">📄</span>
                            <span className="truncate">{file.file_name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                          </div>
                          <a
                            href={`/api/attachments/file/${file.id}?download=1`}
                            className="shrink-0 ml-2 text-xs font-medium text-primary hover:underline"
                            download
                          >
                            {t('projects.edit.download', 'Download')}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
