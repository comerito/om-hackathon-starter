"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle, ProgressBar, AvatarStack, PortalBadge } from '@/components/portal'
import { cn } from '@open-mercato/shared/lib/utils'
import { Clock, Lock, Link2, Code, Video, Upload, Check, Circle, FolderCode, Sparkles, Pencil } from 'lucide-react'
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

type TrackInfo = { id: string; name: string; color: string }

type MyProjectResponse = {
  project: ProjectData | null
  projects?: ProjectData[]
  team: { id: string; name: string; track_id: string | null } | null
  tracks?: TrackInfo[]
  trackName: string | null
  submissionDeadline: string | null
  hasTeam: boolean
  isOwner: boolean
}

/* ---------- helpers ---------- */

const inputClass =
  'rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:border-portal-primary focus:ring-1 focus:ring-portal-primary/30 focus:outline-none w-full dark:placeholder:text-slate-500'
const textareaClass =
  'rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:border-portal-primary focus:ring-1 focus:ring-portal-primary/30 focus:outline-none w-full min-h-[100px] resize-y dark:placeholder:text-slate-500'
const labelClass = 'text-xs font-bold uppercase tracking-widest text-foreground block mb-1.5'

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

  // Multi-project support: track selector
  const allProjects = data?.projects ?? (data?.project ? [data.project] : [])
  const allTracks = data?.tracks ?? []
  const hasMultipleProjects = allProjects.length > 1
  const [activeTrackId, setActiveTrackId] = React.useState<string | null>(null)

  // Set initial active track when data loads
  React.useEffect(() => {
    if (allProjects.length > 0 && !activeTrackId) {
      setActiveTrackId(allProjects[0].track_id)
    }
  }, [allProjects, activeTrackId])

  // Derive active project from track selection
  const activeProject = activeTrackId
    ? allProjects.find(p => p.track_id === activeTrackId) ?? allProjects[0] ?? null
    : allProjects[0] ?? null

  // Populate form when data loads or active project changes
  React.useEffect(() => {
    const p = activeProject
    if (!p) return
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
  }, [activeProject?.id, activeProject?.updated_at])

  const project = activeProject
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
  const completionPercent = Math.round((filledCount / totalRequired) * 100)

  // Autosave label
  const autosaveLabel = React.useMemo(() => {
    if (saving) return t('projects.portal.saving', 'Saving...')
    if (autoSaveFailed) return t('projects.portal.saveFailed', 'Auto-save failed -- backed up locally')
    if (!lastSaved) return ''
    const diff = Math.round((now.getTime() - new Date(lastSaved).getTime()) / 1000)
    if (diff < 60) return t('projects.portal.autosavedJustNow', 'Autosaved just now')
    const mins = Math.floor(diff / 60)
    return `Autosaved ${mins}m ago`
  }, [saving, autoSaveFailed, lastSaved, now, t])

  /* -- No team state -- */
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

  /* -- No project yet -- */
  if (!isLoading && data?.hasTeam && !project) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 py-12 px-6">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-portal-primary/10">
              <FolderCode className="size-6 text-portal-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t('projects.portal.noProject', 'No Project Yet')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t('projects.portal.noProjectDescDetailed', 'When the hacking phase begins, a draft project will be created automatically for your team. You\'ll then be able to edit all the details — add a description, tech stack, demo links, screenshots, and more.')}
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-4 py-3">
              <Sparkles className="size-4 text-portal-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('projects.portal.noProjectStep1', 'A draft project is created automatically when the competition enters the hacking stage')}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-4 py-3">
              <Pencil className="size-4 text-portal-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('projects.portal.noProjectStep2', 'Your team can then edit the project — fill in details, upload assets, and prepare your submission')}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-4 py-3">
              <Clock className="size-4 text-portal-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('projects.portal.noProjectStep3', 'Make sure to submit before the deadline — you\'ll see a countdown timer once your project is ready to edit')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>
  }

  // Track tab switcher for multi-project teams
  const trackTabs = hasMultipleProjects ? (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
      {allProjects.map((p) => {
        const trackInfo = allTracks.find(t2 => t2.id === p.track_id)
        const isActive = p.track_id === activeTrackId
        return (
          <button
            key={p.track_id}
            type="button"
            onClick={() => {
              // Auto-save current before switching
              if (project && isDraft) doAutoSave()
              setActiveTrackId(p.track_id)
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shrink-0',
              isActive
                ? 'bg-portal-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-white/5 text-portal-secondary hover:bg-gray-200 dark:hover:bg-white/10',
            )}
          >
            {trackInfo && (
              <div className="size-2.5 rounded-full" style={{ backgroundColor: trackInfo.color || '#6366f1' }} />
            )}
            <span>{trackInfo?.name ?? 'Track'}</span>
            <PortalBadge variant={p.status === 'published' ? 'success' : p.status === 'draft' ? 'muted' : 'info'}>
              {p.status}
            </PortalBadge>
          </button>
        )
      })}
    </div>
  ) : null

  /* ======== Published state (read-only) ======== */
  if (isPublished) {
    return (
      <div className="space-y-6">
        {trackTabs}
        {/* Submitted banner */}
        <div className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-5 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <Check className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <span className="font-semibold text-green-800 dark:text-green-300">
              {t('projects.portal.submittedBanner', 'Your project has been submitted!')}
            </span>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
              {t('projects.portal.submittedDesc', 'Submitted on')} {project?.submitted_at ? new Date(project.submitted_at).toLocaleString() : ''}
            </p>
          </div>
        </div>

        {/* Project details card */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-5">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{project?.title ?? ''}</h2>
          {project?.tagline && <p className="text-lg text-portal-secondary italic">{project.tagline}</p>}

          {project?.description && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-1">{t('projects.fields.description', 'Description')}</h4>
              <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.description}</p>
            </div>
          )}
          {project?.problem_statement && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-1">{t('projects.fields.problemStatement', 'Problem Statement')}</h4>
              <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.problem_statement}</p>
            </div>
          )}
          {project?.solution && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-1">{t('projects.fields.solution', 'Solution')}</h4>
              <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.solution}</p>
            </div>
          )}

          {project?.tech_stack && project.tech_stack.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-1.5">{t('projects.fields.techStack', 'Tech Stack')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {project.tech_stack.map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-portal-primary/10 px-2.5 py-0.5 text-xs font-medium text-portal-primary">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {project?.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-portal-primary hover:underline">
                <Link2 className="size-4" /> Demo
              </a>
            )}
            {project?.repo_url && (
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-portal-primary hover:underline">
                <Code className="size-4" /> Repository
              </a>
            )}
            {project?.video_url && (
              <a href={project.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-portal-primary hover:underline">
                <Video className="size-4" /> Video
              </a>
            )}
            {project?.presentation_url && (
              <a href={project.presentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-portal-primary hover:underline">
                <Link2 className="size-4" /> Presentation
              </a>
            )}
          </div>
        </div>

        {project?.flagged_for_reuse && (
          <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4">
            <span className="font-medium text-orange-800 dark:text-orange-300">{t('projects.portal.flaggedBanner', 'This project has been flagged for code reuse review.')}</span>
            {project.flagged_reason && <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">{project.flagged_reason}</p>}
          </div>
        )}
      </div>
    )
  }

  /* ======== Draft editor (two-column layout) ======== */
  return (
    <div className="space-y-6">
      {trackTabs}
      {/* ---- Deadline Banner ---- */}
      {deadline && !deadlinePassed && (
        <div
          className={cn(
            'rounded-xl px-5 py-3.5 flex items-center justify-between gap-4',
            isUrgent ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30' : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30',
          )}
        >
          <div className="flex items-center gap-2.5">
            <Clock className={cn('size-4 shrink-0', isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />
            <span className={cn('text-sm font-medium', isUrgent ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
              {t('projects.portal.approachingDeadline', 'Approaching Deadline:')}
            </span>
            {secondsUntilDeadline !== null && (
              <span className={cn('font-mono font-bold', isUrgent ? 'text-red-900 dark:text-red-300 text-lg' : 'text-amber-900 dark:text-amber-300 text-sm')}>
                {formatCountdown(secondsUntilDeadline)} {t('projects.portal.remaining', 'remaining')}
              </span>
            )}
          </div>
          <PortalBadge variant={isUrgent ? 'danger' : 'warning'}>
            {t('projects.portal.draftMode', 'DRAFT MODE')}
          </PortalBadge>
        </div>
      )}

      {deadlinePassed && (
        <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-5 py-3.5">
          <span className="text-sm font-medium text-red-800 dark:text-red-300">
            {t('projects.portal.deadlinePassed', 'Submission deadline has passed. Contact an organizer for an extension.')}
          </span>
        </div>
      )}

      {/* ---- Two-column grid ---- */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* ======== LEFT COLUMN: Form ======== */}
        <div className="space-y-6">
          {/* Project Details header + autosave */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{t('projects.portal.contentSection', 'Project Details')}</h2>
              <span className={cn(
                'text-xs',
                autoSaveFailed ? 'text-red-500 dark:text-red-400' : 'text-portal-secondary',
              )}>
                {autosaveLabel}
              </span>
            </div>

            {/* Title */}
            <div>
              <label className={labelClass}>{t('projects.fields.title', 'Project Title')} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                className="rounded-xl bg-gray-900 text-white px-4 py-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/50"
                placeholder="Enter your project name"
              />
            </div>

            {/* Tagline */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-foreground">{t('projects.fields.tagline', 'Tagline')}</label>
                <span className="text-xs text-portal-secondary">{tagline.length}/140</span>
              </div>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={140}
                className="rounded-xl bg-gray-900 text-white px-4 py-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/50"
                placeholder="A short summary (max 140 chars)"
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>{t('projects.fields.description', 'Description')} *</label>
              <textarea
                className={textareaClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe your project in detail..."
              />
            </div>

            {/* Problem / Solution - two-column row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('projects.fields.problemStatement', 'Problem')}</label>
                <textarea
                  className={cn(textareaClass, 'min-h-[100px]')}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="What problem does this solve?"
                />
              </div>
              <div>
                <label className={labelClass}>{t('projects.fields.solution', 'Solution')}</label>
                <textarea
                  className={cn(textareaClass, 'min-h-[100px]')}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="How does your project solve it?"
                />
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className={labelClass}>{t('projects.fields.techStack', 'Tech Stack')}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {techStack.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-2.5 py-1 text-xs font-medium text-portal-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTech(tag)}
                      className="ml-0.5 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${tag}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                onKeyDown={handleAddTech}
                className={inputClass}
                placeholder={t('projects.portal.techStackPlaceholder', '+ Add Tool (press Enter)')}
              />
            </div>
          </div>

          {/* ---- Media Gallery ---- */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">{t('projects.portal.mediaSection', 'Media Gallery')}</h3>
            <p className="text-sm text-portal-secondary">
              {t('projects.portal.mediaHelp', 'Upload screenshots of your project. Images help judges understand your work. Accepted formats: PNG, JPG, GIF, WebP.')}
            </p>

            <div className="flex flex-wrap gap-3">
              {/* Upload slot */}
              <button
                type="button"
                onClick={() => screenshotInputRef.current?.click()}
                disabled={uploadingScreenshot || isPublished}
                className="flex flex-col items-center justify-center w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-portal-primary/50 hover:bg-portal-primary/5 transition-colors text-portal-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="size-5 mb-1" />
                <span className="text-xs font-medium">
                  {uploadingScreenshot ? t('projects.portal.uploading', 'Uploading...') : t('projects.portal.upload', 'Upload')}
                </span>
              </button>

              {/* Screenshot thumbnails */}
              {screenshotIds.map((id, idx) => (
                <div key={id} className="relative group w-28 h-28 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden flex items-center justify-center">
                  <div className="flex flex-col items-center text-portal-secondary">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-slate-500">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span className="text-[10px] mt-1 text-gray-400 dark:text-slate-500">
                      {t('projects.portal.screenshot', 'Screenshot')} {idx + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveScreenshot(id)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={t('projects.portal.removeScreenshot', 'Remove screenshot')}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              onChange={handleScreenshotUpload}
              className="hidden"
              id="screenshot-upload"
            />
            {screenshotIds.length > 0 && (
              <span className="text-xs text-portal-secondary">{screenshotIds.length} {t('projects.portal.filesUploaded', 'file(s) uploaded')}</span>
            )}
          </div>

          {/* ---- Submission Assets (URLs) ---- */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">{t('projects.portal.linksSection', 'Submission Assets')}</h3>

            {/* Demo URL */}
            <div>
              <label className={labelClass}>{t('projects.fields.demoUrl', 'Demo URL')}</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className={cn(inputClass, 'pl-10')}
                  placeholder="https://"
                />
              </div>
            </div>

            {/* Repository URL */}
            <div>
              <label className={labelClass}>{t('projects.fields.repoUrl', 'Repository URL')}</label>
              <div className="relative">
                <Code className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className={cn(inputClass, 'pl-10')}
                  placeholder="https://github.com/..."
                />
              </div>
            </div>

            {/* Video URL */}
            <div>
              <label className={labelClass}>{t('projects.fields.videoUrl', 'Video Pitch')}</label>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={cn(inputClass, 'pl-10')}
                  placeholder="https://"
                />
              </div>
            </div>

            {/* Presentation URL */}
            <div>
              <label className={labelClass}>{t('projects.fields.presentationUrl', 'Presentation URL')}</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="url"
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                  className={cn(inputClass, 'pl-10')}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          {/* ---- Originality Disclosure ---- */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">{t('projects.portal.originalitySection', 'Originality Disclosure')}</h3>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={usesPreexistingCode}
                onChange={(e) => setUsesPreexistingCode(e.target.checked)}
                className="mt-1 size-4 rounded border-gray-300 dark:border-white/20 text-portal-primary focus:ring-portal-primary/50"
              />
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {t('projects.fields.usesPreexistingCode', 'This project uses pre-existing code')}
                </span>
                <p className="text-xs text-portal-secondary mt-0.5">
                  {t('projects.portal.originalityHelp', 'Transparency about pre-existing code is valued and does not penalize your team. Judges use this to assess what was built during the hackathon. Using existing code is allowed but must be declared.')}
                </p>
              </div>
            </label>

            {usesPreexistingCode && (
              <div>
                <label className={labelClass}>{t('projects.fields.preexistingCodeDesc', 'Describe the pre-existing code used')} *</label>
                <textarea
                  className={textareaClass}
                  value={preexistingCodeDescription}
                  onChange={(e) => setPreexistingCodeDescription(e.target.value)}
                  placeholder="e.g., Started from a React template, used open-source auth library..."
                />
              </div>
            )}

            <div>
              <label className={labelClass}>{t('projects.fields.builtDuringDesc', 'What was built during the hackathon')}</label>
              <textarea
                className={textareaClass}
                value={builtDuringDescription}
                onChange={(e) => setBuiltDuringDescription(e.target.value)}
                placeholder="Describe what your team built from scratch during the event..."
              />
            </div>
          </div>

          {/* Flag warning */}
          {project?.flagged_for_reuse && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4">
              <span className="font-medium text-orange-800 dark:text-orange-300">{t('projects.portal.flaggedBanner', 'This project has been flagged for code reuse review.')}</span>
              {project.flagged_reason && <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">{project.flagged_reason}</p>}
            </div>
          )}
        </div>

        {/* ======== RIGHT COLUMN: Sticky sidebar ======== */}
        <div className="lg:sticky lg:top-20 space-y-5 self-start">
          {/* Submission Progress card */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('projects.portal.submissionProgress', 'Submission Progress')}</h3>

            {/* Progress bar with labels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{completionPercent}% {t('projects.portal.complete', 'COMPLETE')}</span>
                <span className="text-xs text-portal-secondary">{filledCount}/{totalRequired} {t('projects.portal.required', 'REQUIRED')}</span>
              </div>
              <ProgressBar value={completionPercent} size="md" />
            </div>

            {/* Checklist items */}
            <ul className="space-y-2">
              {requiredFields.map(f => (
                <li key={f.label} className="flex items-center gap-2.5">
                  {f.filled ? (
                    <Check className="size-4 text-green-500 dark:text-green-400 shrink-0" />
                  ) : (
                    <Circle className="size-4 text-gray-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={cn('text-sm', f.filled ? 'text-portal-secondary line-through' : 'text-foreground')}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Submit button */}
            {!showSubmitConfirm ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={deadlinePassed || filledCount < totalRequired || !data?.isOwner}
                  className="w-full gap-2"
                >
                  <Lock className="size-3.5" />
                  {t('projects.portal.submitBtn', 'Submit Final Project')}
                </Button>
                {(deadlinePassed || filledCount < totalRequired) && (
                  <p className="text-xs text-red-500 dark:text-red-400 text-center">
                    {deadlinePassed
                      ? t('projects.portal.deadlinePassedShort', 'Deadline has passed')
                      : t('projects.portal.incompleteFields', 'Complete all required fields to submit')}
                  </p>
                )}
                {!data?.isOwner && (
                  <p className="text-xs text-portal-secondary text-center">
                    {t('projects.portal.ownerOnly', 'Only the team owner can submit the project.')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                    {t('projects.portal.submitConfirmMsg', 'Are you sure? This action cannot be undone. Your project will be locked for editing.')}
                  </p>
                </div>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting ? t('common.submitting', 'Submitting...') : t('projects.portal.confirmSubmit', 'Yes, Submit')}
                </Button>
                <Button variant="outline" onClick={() => setShowSubmitConfirm(false)} className="w-full">
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            )}

            {/* Preview / Save buttons */}
            <Button variant="outline" className="w-full" onClick={handleSave} disabled={saving || isPublished}>
              {t('projects.portal.saveBtn', 'Save Draft')}
            </Button>
          </div>

          {/* YOUR TEAM card */}
          {data?.team && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('projects.portal.yourTeam', 'Your Team')}</h3>
              <div className="flex items-center gap-3">
                <AvatarStack
                  avatars={[{ name: data.team.name }]}
                  size="md"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{data.team.name}</p>
                  {data.trackName && (
                    <p className="text-xs text-portal-secondary">{data.trackName}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('projects.portal.label', 'Your team project')}
        title={t('projects.portal.title', 'My Project')}
      />
      <ProjectEditorContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
