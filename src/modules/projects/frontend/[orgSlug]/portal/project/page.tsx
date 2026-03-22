"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'
import Link from 'next/link'

/* ---------- types ---------- */

type ProjectData = {
  id: string
  title: string
  tagline: string | null
  description: string | null
  problem_statement: string | null
  solution: string | null
  tech_stack: string[]
  demo_url: string | null
  repo_url: string | null
  video_url: string | null
  presentation_url: string | null
  screenshot_ids: string[]
  attachment_ids: string[]
  uses_preexisting_code: boolean
  preexisting_code_description: string | null
  built_during_hackathon_description: string | null
  flagged_for_reuse: boolean
  flagged_reason: string | null
  status: string
  submitted_at: string | null
  track_id: string
  team_id: string
  competition_id: string
  updated_at: string
}

type MyProjectResponse = {
  project: ProjectData | null
  team: { id: string; name: string; track_id: string | null } | null
  trackName: string | null
  submissionDeadline: string | null
  hasTeam: boolean
  isOwner: boolean
}

/* ========== Project Editor ========== */

function ProjectEditorContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId: competitionId } = useCompetitionContext()

  // Form state
  const [title, setTitle] = React.useState('')
  const [tagline, setTagline] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [problemStatement, setProblemStatement] = React.useState('')
  const [solution, setSolution] = React.useState('')
  const [techStackInput, setTechStackInput] = React.useState('')
  const [techStack, setTechStack] = React.useState<string[]>([])
  const [demoUrl, setDemoUrl] = React.useState('')
  const [repoUrl, setRepoUrl] = React.useState('')
  const [videoUrl, setVideoUrl] = React.useState('')
  const [presentationUrl, setPresentationUrl] = React.useState('')
  const [usesPreexistingCode, setUsesPreexistingCode] = React.useState(false)
  const [preexistingCodeDescription, setPreexistingCodeDescription] = React.useState('')
  const [builtDuringDescription, setBuiltDuringDescription] = React.useState('')

  // File upload state
  const [uploadingScreenshot, setUploadingScreenshot] = React.useState(false)
  const [screenshotIds, setScreenshotIds] = React.useState<string[]>([])
  const screenshotInputRef = React.useRef<HTMLInputElement>(null)

  const [saving, setSaving] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<string | null>(null)
  const [autoSaveFailed, setAutoSaveFailed] = React.useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = React.useState(false)
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  // Live countdown timer
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch project data
  const { data, isLoading } = useQuery<MyProjectResponse>({
    queryKey: ['portal-my-project', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<MyProjectResponse>(
        `/api/projects/portal/my-project?competition_id=${competitionId}`,
      )
      if (ok && result) return result
      return { project: null, team: null, trackName: null, submissionDeadline: null, hasTeam: false, isOwner: false }
    },
    enabled: !!competitionId,
  })

  // Populate form when data loads
  React.useEffect(() => {
    if (!data?.project) return
    const p = data.project
    setTitle(p.title ?? '')
    setTagline(p.tagline ?? '')
    setDescription(p.description ?? '')
    setProblemStatement(p.problem_statement ?? '')
    setSolution(p.solution ?? '')
    setTechStack(p.tech_stack ?? [])
    setDemoUrl(p.demo_url ?? '')
    setRepoUrl(p.repo_url ?? '')
    setVideoUrl(p.video_url ?? '')
    setPresentationUrl(p.presentation_url ?? '')
    setUsesPreexistingCode(p.uses_preexisting_code ?? false)
    setPreexistingCodeDescription(p.preexisting_code_description ?? '')
    setBuiltDuringDescription(p.built_during_hackathon_description ?? '')
    setLastSaved(p.updated_at ?? null)
    setScreenshotIds(p.screenshot_ids ?? [])
  }, [data?.project])

  const project = data?.project
  const isPublished = project?.status === 'published'
  const isDraft = project?.status === 'draft'

  // Deadline handling — uses live `now` that ticks every second
  const deadline = data?.submissionDeadline ? new Date(data.submissionDeadline) : null
  const deadlinePassed = deadline ? now > deadline : false
  const secondsUntilDeadline = deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000)) : null
  const minutesUntilDeadline = secondsUntilDeadline !== null ? Math.floor(secondsUntilDeadline / 60) : null
  const isUrgent = minutesUntilDeadline !== null && minutesUntilDeadline <= 15

  // Preserve unsaved work to localStorage when deadline passes
  React.useEffect(() => {
    if (deadlinePassed && project && isDraft) {
      try {
        localStorage.setItem(`project-draft-${project.id}`, JSON.stringify({
          title, tagline, description, problemStatement, solution, techStack,
          demoUrl, repoUrl, videoUrl, presentationUrl,
          usesPreexistingCode, preexistingCodeDescription, builtDuringDescription,
        }))
      } catch { /* ignore */ }
    }
  }, [deadlinePassed, project, isDraft, title, tagline, description, problemStatement, solution, techStack, demoUrl, repoUrl, videoUrl, presentationUrl, usesPreexistingCode, preexistingCodeDescription, builtDuringDescription])

  // Format countdown display
  function formatCountdown(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // Auto-save function
  const doAutoSave = React.useCallback(async () => {
    if (!project || isPublished) return
    setSaving(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; updated_at?: string }>('/api/projects/portal/update-project', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          title: title.trim() || project.title,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          problem_statement: problemStatement.trim() || null,
          solution: solution.trim() || null,
          tech_stack: techStack,
          demo_url: demoUrl.trim() || null,
          repo_url: repoUrl.trim() || null,
          video_url: videoUrl.trim() || null,
          presentation_url: presentationUrl.trim() || null,
          uses_preexisting_code: usesPreexistingCode,
          preexisting_code_description: preexistingCodeDescription.trim() || null,
          built_during_hackathon_description: builtDuringDescription.trim() || null,
          screenshot_ids: screenshotIds,
        }),
      })
      if (ok && result?.updated_at) {
        setLastSaved(result.updated_at)
        setAutoSaveFailed(false)
      }
    } catch (err) {
      console.error('[project-editor] Auto-save failed:', err)
      setAutoSaveFailed(true)
      // Fallback: save to localStorage so work is not lost
      try {
        localStorage.setItem(`project-draft-${project.id}`, JSON.stringify({
          title, tagline, description, problemStatement, solution, techStack,
          demoUrl, repoUrl, videoUrl, presentationUrl,
          usesPreexistingCode, preexistingCodeDescription, builtDuringDescription,
          screenshotIds,
        }))
      } catch (lsErr) {
        console.error('[project-editor] localStorage fallback failed:', lsErr)
      }
    } finally {
      setSaving(false)
    }
  }, [project, isPublished, title, tagline, description, problemStatement, solution, techStack, demoUrl, repoUrl, videoUrl, presentationUrl, usesPreexistingCode, preexistingCodeDescription, builtDuringDescription, screenshotIds])

  // Auto-save every 30 seconds
  React.useEffect(() => {
    if (!project || isPublished) return
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setInterval(doAutoSave, 30000)
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current) }
  }, [doAutoSave, project, isPublished])

  // Save manually
  async function handleSave() {
    await doAutoSave()
    flash(t('projects.portal.saved', 'Project saved'), 'success')
  }

  // Submit project
  async function handleSubmit() {
    if (!project) return
    setSubmitting(true)
    try {
      // Save first
      await doAutoSave()

      const { ok, result } = await apiCall<{ ok: boolean; error?: string; details?: string[] }>('/api/projects/portal/submit-project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      })
      if (ok) {
        flash(t('projects.portal.submitted', 'Project submitted successfully!'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-my-project'] })
        setShowSubmitConfirm(false)
      } else {
        const errorMsg = result?.details?.join(', ') ?? result?.error ?? 'Submission failed'
        flash(errorMsg, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Add tech stack tag
  function handleAddTech(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && techStackInput.trim()) {
      e.preventDefault()
      const tag = techStackInput.trim()
      if (!techStack.includes(tag)) {
        setTechStack([...techStack, tag])
      }
      setTechStackInput('')
    }
  }

  function handleRemoveTech(tag: string) {
    setTechStack(techStack.filter(t => t !== tag))
  }

  // Screenshot upload handler
  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length || !project) return
    setUploadingScreenshot(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set('entityId', 'projects:project')
        formData.set('recordId', project.id)
        formData.set('file', file)
        formData.set('fieldKey', 'screenshots')
        const { ok, result } = await apiCall<{ ok: boolean; item?: { id: string } }>('/api/attachments', {
          method: 'POST',
          body: formData,
        })
        if (ok && result?.item?.id) {
          setScreenshotIds(prev => [...prev, result.item!.id])
        }
      }
      flash(t('projects.portal.screenshotUploaded', 'Screenshot uploaded'), 'success')
    } catch {
      flash(t('projects.portal.uploadFailed', 'Upload failed'), 'error')
    } finally {
      setUploadingScreenshot(false)
      if (screenshotInputRef.current) screenshotInputRef.current.value = ''
    }
  }

  function handleRemoveScreenshot(id: string) {
    setScreenshotIds(prev => prev.filter(s => s !== id))
  }

  // Completeness check
  const requiredFields = [
    { label: 'Title', filled: !!title.trim() },
    { label: 'Description', filled: !!description.trim() },
    { label: 'Originality disclosure', filled: !usesPreexistingCode || !!preexistingCodeDescription.trim() },
  ]
  const filledCount = requiredFields.filter(f => f.filled).length
  const totalRequired = requiredFields.length

  /* ── No team state ── */
  if (!isLoading && !data?.hasTeam) {
    return (
      <PortalEmptyState
        title={t('projects.portal.noTeam', 'No Team Yet')}
        description={t('projects.portal.noTeamDesc', 'You need to join a team before you can work on a project.')}
        action={
          <Button asChild>
            <Link href={`/${orgSlug}/portal/team`}>
              {t('projects.portal.goToTeam', 'Go to My Team')}
            </Link>
          </Button>
        }
      />
    )
  }

  /* ── No project yet ── */
  if (!isLoading && data?.hasTeam && !project) {
    return (
      <PortalEmptyState
        title={t('projects.portal.noProject', 'No Project Yet')}
        description={t('projects.portal.noProjectDesc', 'Your project will be created when the hacking phase begins.')}
      />
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>
  }

  /* ── Published state (read-only) ── */
  if (isPublished) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="font-medium text-green-800">
              {t('projects.portal.submittedBanner', 'Your project has been submitted!')}
            </span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {t('projects.portal.submittedDesc', 'Submitted on')} {project?.submitted_at ? new Date(project.submitted_at).toLocaleString() : ''}
          </p>
        </div>

        <PortalCard>
          <PortalCardHeader title={project?.title ?? ''} />
          <div className="p-6 space-y-4">
            {project?.tagline && <p className="text-lg text-muted-foreground italic">{project.tagline}</p>}
            {project?.description && <div><h4 className="font-medium mb-1">{t('projects.fields.description', 'Description')}</h4><p className="text-sm whitespace-pre-wrap">{project.description}</p></div>}
            {project?.problem_statement && <div><h4 className="font-medium mb-1">{t('projects.fields.problemStatement', 'Problem Statement')}</h4><p className="text-sm whitespace-pre-wrap">{project.problem_statement}</p></div>}
            {project?.solution && <div><h4 className="font-medium mb-1">{t('projects.fields.solution', 'Solution')}</h4><p className="text-sm whitespace-pre-wrap">{project.solution}</p></div>}
            {project?.tech_stack && project.tech_stack.length > 0 && (
              <div>
                <h4 className="font-medium mb-1">{t('projects.fields.techStack', 'Tech Stack')}</h4>
                <div className="flex flex-wrap gap-1.5">{project.tech_stack.map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{tag}</span>
                ))}</div>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {project?.demo_url && <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Demo</a>}
              {project?.repo_url && <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Repository</a>}
              {project?.video_url && <a href={project.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Video</a>}
              {project?.presentation_url && <a href={project.presentation_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Presentation</a>}
            </div>
          </div>
        </PortalCard>

        {project?.flagged_for_reuse && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <span className="font-medium text-orange-800">{t('projects.portal.flaggedBanner', 'This project has been flagged for code reuse review.')}</span>
            {project.flagged_reason && <p className="text-sm text-orange-700 mt-1">{project.flagged_reason}</p>}
          </div>
        )}
      </div>
    )
  }

  /* ── Draft editor ── */
  return (
    <div className="space-y-6">
      {/* Deadline warning */}
      {deadline && !deadlinePassed && (
        <div className={`rounded-lg border p-4 ${isUrgent ? 'border-red-300 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isUrgent ? 'text-red-600' : 'text-yellow-600'}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={`font-medium ${isUrgent ? 'text-red-800 text-lg' : 'text-yellow-800 text-sm'}`}>
              {t('projects.portal.deadline', 'Submission deadline')}: {deadline.toLocaleString()}
            </span>
            {secondsUntilDeadline !== null && (
              <span className={`font-mono font-bold ${isUrgent ? 'text-red-900 text-xl' : 'text-yellow-900 text-sm'}`}>
                {formatCountdown(secondsUntilDeadline)} {t('projects.portal.remaining', 'remaining')}
              </span>
            )}
          </div>
        </div>
      )}

      {deadlinePassed && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <span className="text-sm font-medium text-red-800">
            {t('projects.portal.deadlinePassed', 'Submission deadline has passed. Contact an organizer for an extension.')}
          </span>
        </div>
      )}

      {/* Completeness checklist */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('projects.portal.completeness', 'Completeness')}</span>
          <span className="text-sm text-muted-foreground">{filledCount} / {totalRequired}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted mb-3">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(filledCount / totalRequired) * 100}%` }} />
        </div>
        <ul className="space-y-1">
          {requiredFields.map(f => (
            <li key={f.label} className="flex items-center gap-2 text-xs">
              {f.filled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><circle cx="12" cy="12" r="10" /></svg>
              )}
              <span className={f.filled ? 'text-muted-foreground line-through' : ''}>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Save indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {saving ? t('projects.portal.saving', 'Saving...') : autoSaveFailed ? <span className="text-destructive">{t('projects.portal.saveFailed', 'Auto-save failed — your work is backed up locally')}</span> : lastSaved ? `${t('projects.portal.lastSaved', 'Last saved')}: ${new Date(lastSaved).toLocaleTimeString()}` : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || isPublished}>
            {t('projects.portal.saveBtn', 'Save Draft')}
          </Button>
        </div>
      </div>

      {/* Content section */}
      <PortalCard>
        <PortalCardHeader title={t('projects.portal.contentSection', 'Project Details')} />
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.title', 'Title')} *</label>
            <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} maxLength={255} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.tagline', 'Tagline')}</label>
            <Input value={tagline} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagline(e.target.value)} maxLength={140} placeholder="A short summary (max 140 chars)" />
            <span className="text-xs text-muted-foreground">{tagline.length}/140</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.description', 'Description')} *</label>
            <textarea className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.problemStatement', 'Problem Statement')}</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.solution', 'Solution')}</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={solution} onChange={(e) => setSolution(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.techStack', 'Tech Stack')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {techStack.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTech(tag)} className="ml-0.5 hover:text-destructive">×</button>
                </span>
              ))}
            </div>
            <Input
              value={techStackInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTechStackInput(e.target.value)}
              onKeyDown={handleAddTech}
              placeholder={t('projects.portal.techStackPlaceholder', 'Type a technology and press Enter')}
            />
          </div>
        </div>
      </PortalCard>

      {/* Links section */}
      <PortalCard>
        <PortalCardHeader title={t('projects.portal.linksSection', 'Links')} />
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.demoUrl', 'Demo URL')}</label>
            <Input value={demoUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDemoUrl(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.repoUrl', 'Repository URL')}</label>
            <Input value={repoUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.videoUrl', 'Video URL')}</label>
            <Input value={videoUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVideoUrl(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.presentationUrl', 'Presentation URL')}</label>
            <Input value={presentationUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresentationUrl(e.target.value)} placeholder="https://" />
          </div>
        </div>
      </PortalCard>

      {/* Screenshots & Attachments section (3.4) */}
      <PortalCard>
        <PortalCardHeader title={t('projects.portal.mediaSection', 'Screenshots & Media')} />
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('projects.portal.mediaHelp', 'Upload screenshots of your project. Images help judges understand your work. Accepted formats: PNG, JPG, GIF, WebP.')}
          </p>

          {/* Uploaded screenshots */}
          {screenshotIds.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {screenshotIds.map((id, idx) => (
                <div key={id} className="group relative rounded-lg border bg-muted/30 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate">
                      {t('projects.portal.screenshot', 'Screenshot')} {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label={t('projects.portal.removeScreenshot', 'Remove screenshot')}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 h-20 rounded bg-muted flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <div className="flex items-center gap-3">
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              onChange={handleScreenshotUpload}
              className="hidden"
              id="screenshot-upload"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => screenshotInputRef.current?.click()}
              disabled={uploadingScreenshot || isPublished}
            >
              {uploadingScreenshot ? t('projects.portal.uploading', 'Uploading...') : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  {t('projects.portal.uploadScreenshots', 'Upload Screenshots')}
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">{screenshotIds.length} {t('projects.portal.filesUploaded', 'file(s) uploaded')}</span>
          </div>
        </div>
      </PortalCard>

      {/* Originality Disclosure section (3.5) */}
      <PortalCard>
        <PortalCardHeader title={t('projects.portal.originalitySection', 'Originality Disclosure')} />
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 p-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <p className="text-sm text-blue-800">
              {t('projects.portal.originalityHelp', 'Transparency about pre-existing code is valued and does not penalize your team. Judges use this to assess what was built during the hackathon. Using existing code is allowed but must be declared.')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={usesPreexistingCode}
              onClick={() => setUsesPreexistingCode(!usesPreexistingCode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usesPreexistingCode ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usesPreexistingCode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm">{t('projects.fields.usesPreexistingCode', 'This project uses pre-existing code')}</span>
          </div>
          {usesPreexistingCode && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('projects.fields.preexistingCodeDesc', 'Describe the pre-existing code used')} *</label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={preexistingCodeDescription} onChange={(e) => setPreexistingCodeDescription(e.target.value)} placeholder="e.g., Started from a React template, used open-source auth library..." />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.fields.builtDuringDesc', 'What was built during the hackathon')}</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={builtDuringDescription} onChange={(e) => setBuiltDuringDescription(e.target.value)} placeholder="Describe what your team built from scratch during the event..." />
          </div>
        </div>
      </PortalCard>

      {/* Flag warning */}
      {project?.flagged_for_reuse && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <span className="font-medium text-orange-800">{t('projects.portal.flaggedBanner', 'This project has been flagged for code reuse review.')}</span>
          {project.flagged_reason && <p className="text-sm text-orange-700 mt-1">{project.flagged_reason}</p>}
        </div>
      )}

      {/* Submit section */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-2">{t('projects.portal.readyToSubmit', 'Ready to Submit?')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('projects.portal.submitWarning', 'Once submitted, your project will be locked and visible to judges. Make sure all fields are complete.')}
        </p>

        {!showSubmitConfirm ? (
          <Button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={deadlinePassed || filledCount < totalRequired || !data?.isOwner}
            className="w-full sm:w-auto"
          >
            {t('projects.portal.submitBtn', 'Submit Project')}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800 font-medium">
                {t('projects.portal.submitConfirmMsg', 'Are you sure? This action cannot be undone. Your project will be locked for editing.')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} variant="default">
                {submitting ? t('common.submitting', 'Submitting...') : t('projects.portal.confirmSubmit', 'Yes, Submit')}
              </Button>
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
        {!data?.isOwner && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('projects.portal.ownerOnly', 'Only the team owner can submit the project.')}
          </p>
        )}
      </div>
    </div>
  )
}

/* ========== Page Component ========== */

export default function MyProjectPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title={t('projects.portal.title', 'My Project')}
          label={t('projects.portal.label', 'Your team project')}
        />
        <ProjectEditorContent orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
