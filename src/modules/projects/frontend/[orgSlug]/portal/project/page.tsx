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
import { PortalPageTitle, ProgressBar, AvatarStack, PortalBadge, SectionLabel } from '@/components/portal'
import { cn } from '@open-mercato/shared/lib/utils'
import { Clock, Lock, Link2, Code, Video, Upload, Check, Circle, FolderCode, Sparkles, Pencil, FileCode2, Download, Trash2 } from 'lucide-react'
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
  attachments?: Array<{
    id: string
    file_name: string
    mime_type: string
    file_size: number
    url: string
    created_at: string
  }>
  screenshots?: Array<{
    id: string
    file_name: string
    mime_type: string
    file_size: number
    url: string
    created_at: string
  }>
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
type ProjectAttachment = NonNullable<ProjectData['attachments']>[number]

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
  const { selectedId: competitionId, isLoading: contextLoading } = useCompetitionContext()

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
  const [uploadingReadme, setUploadingReadme] = React.useState(false)
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([])
  const [readmeAttachment, setReadmeAttachment] = React.useState<ProjectAttachment | null>(null)
  const readmeInputRef = React.useRef<HTMLInputElement>(null)

  const [saving, setSaving] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<string | null>(null)
  const [saveFailed, setSaveFailed] = React.useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = React.useState(false)

  const updateProjectCache = React.useCallback((projectId: string, updater: (project: ProjectData) => ProjectData) => {
    queryClient.setQueryData<MyProjectResponse | undefined>(['portal-my-project', competitionId], (current) => {
      if (!current) return current

      const updateOne = (project: ProjectData | null): ProjectData | null => {
        if (!project || project.id !== projectId) return project
        return updater(project)
      }

      return {
        ...current,
        project: updateOne(current.project),
        projects: current.projects?.map((project) => (
          project.id === projectId ? updater(project) : project
        )) ?? current.projects,
      }
    })
  }, [competitionId, queryClient])

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
    setAttachmentIds(p.attachment_ids ?? [])
    const restoredReadme = (p.attachments ?? []).find((attachment) => attachment.file_name.trim().toLowerCase() === 'readme.md') ?? null
    setReadmeAttachment(restoredReadme)
  }, [activeProject?.id])

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

  const saveProject = React.useCallback(async () => {
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
          attachment_ids: attachmentIds,
        }),
      })
      if (ok && result?.updated_at) {
        const updatedAt = result.updated_at
        setLastSaved(updatedAt)
        setSaveFailed(false)
        updateProjectCache(project.id, (cachedProject) => ({
          ...cachedProject,
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
          attachment_ids: attachmentIds,
          attachments: attachmentIds.length > 0 && readmeAttachment
            ? [readmeAttachment]
            : [],
          updated_at: updatedAt,
        }))
      }
    } catch (err) {
      console.error('[project-editor] Save failed:', err)
      setSaveFailed(true)
      // Fallback: save to localStorage so work is not lost
      try {
        localStorage.setItem(`project-draft-${project.id}`, JSON.stringify({
          title, tagline, description, problemStatement, solution, techStack,
          demoUrl, repoUrl, videoUrl, presentationUrl,
          usesPreexistingCode, preexistingCodeDescription, builtDuringDescription,
          screenshotIds,
          attachmentIds,
        }))
      } catch (lsErr) {
        console.error('[project-editor] localStorage fallback failed:', lsErr)
      }
    } finally {
      setSaving(false)
    }
  }, [project, isPublished, title, tagline, description, problemStatement, solution, techStack, demoUrl, repoUrl, videoUrl, presentationUrl, usesPreexistingCode, preexistingCodeDescription, builtDuringDescription, screenshotIds, attachmentIds, readmeAttachment, updateProjectCache])

  // Save manually
  async function handleSave() {
    await saveProject()
    flash(t('projects.portal.saved', 'Project saved'), 'success')
  }

  // Submit project
  async function handleSubmit() {
    if (!project) return
    setSubmitting(true)
    try {
      // Save first
      await saveProject()

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
        const errorMsg = result?.details?.join(', ') ?? result?.error ?? t('projects.portal.submitFailed', 'Submission failed')
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
        formData.set('project_id', project.id)
        formData.set('kind', 'screenshot')
        formData.set('file', file)
        const { ok, result } = await apiCall<{ ok: boolean; item?: { id: string; file_name: string; mime_type: string; file_size: number; url: string; created_at: string } }>('/api/projects/portal/upload-asset', {
          method: 'POST',
          body: formData,
        })
        if (ok && result?.item?.id) {
          const newItem = result.item
          setScreenshotIds(prev => {
            const next = [...prev, newItem.id]
            updateProjectCache(project.id, (cachedProject) => ({
              ...cachedProject,
              screenshot_ids: next,
              screenshots: [...(cachedProject.screenshots ?? []), newItem],
            }))
            return next
          })
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
    setScreenshotIds(prev => {
      const next = prev.filter(s => s !== id)
      if (project) {
        updateProjectCache(project.id, (cachedProject) => ({
          ...cachedProject,
          screenshot_ids: next,
          screenshots: (cachedProject.screenshots ?? []).filter(s => s.id !== id),
        }))
      }
      return next
    })
  }

  async function handleReadmeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return

    if (file.name.trim().toLowerCase() !== 'readme.md') {
      flash(t('projects.portal.readmeInvalid', 'Upload a file named README.md'), 'error')
      if (readmeInputRef.current) readmeInputRef.current.value = ''
      return
    }

    setUploadingReadme(true)
    try {
      const formData = new FormData()
      formData.set('project_id', project.id)
      formData.set('kind', 'readme')
      formData.set('file', file)
      const { ok, result } = await apiCall<{ ok: boolean; item?: { id: string; file_name: string; mime_type: string; file_size: number; url: string; created_at: string } }>('/api/projects/portal/upload-asset', {
        method: 'POST',
        body: formData,
      })

      if (ok && result?.item?.id) {
        setAttachmentIds([result.item.id])
        setReadmeAttachment(result.item)
        updateProjectCache(project.id, (cachedProject) => ({
          ...cachedProject,
          attachment_ids: [result.item!.id],
          attachments: [result.item!],
        }))
        flash(t('projects.portal.readmeUploaded', 'README.md uploaded'), 'success')
      } else {
        flash(t('projects.portal.uploadFailed', 'Upload failed'), 'error')
      }
    } catch {
      flash(t('projects.portal.uploadFailed', 'Upload failed'), 'error')
    } finally {
      setUploadingReadme(false)
      if (readmeInputRef.current) readmeInputRef.current.value = ''
    }
  }

  function handleRemoveReadme() {
    setAttachmentIds([])
    setReadmeAttachment(null)
    if (project) {
      updateProjectCache(project.id, (cachedProject) => ({
        ...cachedProject,
        attachment_ids: [],
        attachments: [],
      }))
    }
  }

  // Completeness check
  const requiredFields = [
    { label: t('projects.fields.checklist.title', 'Title'), filled: !!title.trim() },
    { label: t('projects.fields.checklist.description', 'Description'), filled: !!description.trim() },
    { label: t('projects.fields.checklist.readmeFeedback', 'README.md feedback file'), filled: attachmentIds.length > 0 },
    { label: t('projects.fields.checklist.originality', 'Originality disclosure'), filled: !usesPreexistingCode || !!preexistingCodeDescription.trim() },
  ]
  const filledCount = requiredFields.filter(f => f.filled).length
  const totalRequired = requiredFields.length
  const completionPercent = Math.round((filledCount / totalRequired) * 100)

  // Autosave label
  const autosaveLabel = React.useMemo(() => {
    if (saving) return t('projects.portal.saving', 'Saving...')
    if (saveFailed) return t('projects.portal.saveFailed', 'Save failed -- backed up locally')
    if (!lastSaved) return ''
    const diff = Math.round((now.getTime() - new Date(lastSaved).getTime()) / 1000)
    if (diff < 60) return t('projects.portal.autosavedJustNow', 'Saved just now')
    const mins = Math.floor(diff / 60)
    return t('projects.portal.autosavedMinutesAgo', 'Saved {count}m ago', { count: mins })
  }, [saving, saveFailed, lastSaved, now, t])

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

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="h-32 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
      </div>
    )
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
            onClick={async () => {
              // Auto-save current before switching
              if (project && isDraft) {
                await saveProject()
              }
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
            <span>{trackInfo?.name ?? t('projects.portal.trackFallback', 'Track')}</span>
            <PortalBadge variant={p.status === 'published' ? 'success' : p.status === 'draft' ? 'muted' : 'info'}>
              {t(`projects.portal.status.${p.status}`, p.status)}
            </PortalBadge>
          </button>
        )
      })}
    </div>
  ) : null

  /* ======== Published state (read-only) ======== */
  if (isPublished) {
    const activeTrack = allTracks.find(tr => tr.id === project?.track_id)
    const hasLinks = project?.demo_url || project?.repo_url || project?.video_url || project?.presentation_url

    return (
      <div className="space-y-6">
        {trackTabs}

        {/* ---- Hero card ---- */}
        <div className="relative rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {/* Accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-portal-success via-emerald-400 to-portal-success" />

          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-portal-success px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                    <Check className="size-3" />
                    {t('projects.portal.status.published', 'Published')}
                  </span>
                  {activeTrack && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-portal-secondary">
                      <span className="size-2 rounded-full" style={{ backgroundColor: activeTrack.color || '#6366f1' }} />
                      {activeTrack.name}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {project?.title ?? ''}
                </h2>
                {project?.tagline && (
                  <p className="text-base text-portal-secondary leading-relaxed max-w-2xl">{project.tagline}</p>
                )}
              </div>

              {/* Submission timestamp */}
              <div className="flex items-center gap-2.5 shrink-0 rounded-xl bg-portal-success/5 dark:bg-portal-success/10 border border-portal-success/10 dark:border-portal-success/20 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-portal-success/10">
                  <Check className="size-4 text-portal-success" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-portal-success">
                    {t('projects.portal.submittedBanner', 'Submitted')}
                  </p>
                  <p className="text-xs text-portal-secondary mt-0.5">
                    {project?.submitted_at ? new Date(project.submitted_at).toLocaleString() : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Tech stack pills — shown prominently in hero */}
            {project?.tech_stack && project.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5 pt-5 border-t border-gray-100 dark:border-white/5">
                {project.tech_stack.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-lg border border-portal-primary/15 dark:border-portal-primary/25 bg-portal-primary/5 px-2.5 py-1 text-xs font-semibold text-portal-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- Flagged warning ---- */}
        {project?.flagged_for_reuse && (
          <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20 mt-0.5">
              <Sparkles className="size-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <span className="font-semibold text-orange-800 dark:text-orange-300">{t('projects.portal.flaggedBanner', 'This project has been flagged for code reuse review.')}</span>
              {project.flagged_reason && <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">{project.flagged_reason}</p>}
            </div>
          </div>
        )}

        {/* ---- Two-column layout ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Description */}
            {project?.description && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-6">
                <SectionLabel className="mb-3 block">{t('projects.fields.description', 'Description')}</SectionLabel>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.description}</p>
              </div>
            )}

            {/* Problem & Solution — side by side */}
            {(project?.problem_statement || project?.solution) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {project?.problem_statement && (
                  <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-6">
                    <SectionLabel className="mb-3 block">{t('projects.fields.problemStatement', 'Problem Statement')}</SectionLabel>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.problem_statement}</p>
                  </div>
                )}
                {project?.solution && (
                  <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-6">
                    <SectionLabel className="mb-3 block">{t('projects.fields.solution', 'Solution')}</SectionLabel>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-slate-300">{project.solution}</p>
                  </div>
                )}
              </div>
            )}

            {/* Screenshots gallery */}
            {project?.screenshots && project.screenshots.length > 0 && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-6">
                <SectionLabel className="mb-3 block">{t('projects.portal.mediaSection', 'Media Gallery')}</SectionLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {project.screenshots.map((shot, idx) => (
                    <a
                      key={shot.id}
                      href={shot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-video rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden"
                    >
                      <img
                        src={shot.url}
                        alt={`${t('projects.portal.screenshot', 'Screenshot')} ${idx + 1}`}
                        className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Originality disclosure */}
            {project?.uses_preexisting_code && (
              <div className="rounded-xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-5 sm:p-6">
                <SectionLabel className="!text-amber-600 dark:!text-amber-400 mb-3 block">
                  {t('projects.portal.originalitySection', 'Originality Disclosure')}
                </SectionLabel>
                {project.preexisting_code_description && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">{t('projects.fields.preexistingCodeDesc', 'Pre-existing code')}</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200/80 whitespace-pre-wrap">{project.preexisting_code_description}</p>
                  </div>
                )}
                {project.built_during_hackathon_description && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">{t('projects.fields.builtDuringDesc', 'Built during hackathon')}</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200/80 whitespace-pre-wrap">{project.built_during_hackathon_description}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (Sidebar) */}
          <div className="space-y-5 lg:sticky lg:top-20 self-start">
            {/* Project Links card */}
            {hasLinks && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                <div className="relative px-5 pt-4 pb-3">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-portal-primary via-portal-primary-light to-portal-primary" />
                  <SectionLabel className="block">{t('projects.portal.linksSection', 'Project Links')}</SectionLabel>
                </div>
                <div className="border-t border-gray-50 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
                  {project?.demo_url && (
                    <a
                      href={project.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-portal-primary/10 text-portal-primary group-hover:bg-portal-primary/20 transition-colors">
                        <Link2 className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t('projects.portal.link.demo', 'Demo')}</p>
                        <p className="text-xs text-portal-secondary truncate">{project.demo_url}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-portal-secondary shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  )}
                  {project?.repo_url && (
                    <a
                      href={project.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 group-hover:bg-gray-200 dark:group-hover:bg-white/15 transition-colors">
                        <Code className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t('projects.portal.link.repository', 'Repository')}</p>
                        <p className="text-xs text-portal-secondary truncate">{project.repo_url}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-portal-secondary shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  )}
                  {project?.video_url && (
                    <a
                      href={project.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors">
                        <Video className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t('projects.portal.link.video', 'Video')}</p>
                        <p className="text-xs text-portal-secondary truncate">{project.video_url}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-portal-secondary shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  )}
                  {project?.presentation_url && (
                    <a
                      href={project.presentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 transition-colors">
                        <Link2 className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t('projects.portal.link.presentation', 'Presentation')}</p>
                        <p className="text-xs text-portal-secondary truncate">{project.presentation_url}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-portal-secondary shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* README attachment */}
            {readmeAttachment && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <SectionLabel className="mb-3 block">{t('projects.portal.feedbackReadmeSection', 'Feedback README')}</SectionLabel>
                <a
                  href={readmeAttachment.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
                    <FileCode2 className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{readmeAttachment.file_name}</p>
                    <p className="text-xs text-portal-secondary">
                      {Math.max(1, Math.round(readmeAttachment.file_size / 1024))} KB
                    </p>
                  </div>
                  <Download className="size-4 text-portal-secondary group-hover:text-portal-primary transition-colors shrink-0" />
                </a>
              </div>
            )}

            {/* Team card */}
            {data?.team && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                <SectionLabel className="mb-3 block">{t('projects.portal.yourTeam', 'Your Team')}</SectionLabel>
                <div className="flex items-center gap-3">
                  <AvatarStack
                    avatars={[{ name: data.team.name }]}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{data.team.name}</p>
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
                saveFailed ? 'text-red-500 dark:text-red-400' : 'text-portal-secondary',
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
                placeholder={t('projects.fields.title', 'Project Title')}
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
                placeholder={t('projects.fields.tagline', 'Tagline')}
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
                placeholder={t('projects.fields.description', 'Description')}
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
                  placeholder={t('projects.fields.problemStatement', 'Problem Statement')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('projects.fields.solution', 'Solution')}</label>
                <textarea
                  className={cn(textareaClass, 'min-h-[100px]')}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder={t('projects.fields.solution', 'Solution')}
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
                      aria-label={t('projects.portal.removeTech', 'Remove {tag}', { tag })}
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
              {screenshotIds.map((id, idx) => {
                const shot = (project?.screenshots ?? []).find(s => s.id === id)
                return (
                  <div key={id} className="relative group w-28 h-28 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden flex items-center justify-center">
                    {shot?.url ? (
                      <img
                        src={shot.url}
                        alt={`${t('projects.portal.screenshot', 'Screenshot')} ${idx + 1}`}
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
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
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(id)}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={t('projects.portal.removeScreenshot', 'Remove screenshot')}
                    >
                      &times;
                    </button>
                  </div>
                )
              })}
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

          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{t('projects.portal.feedbackReadmeSection', 'Hackathon Feedback README')}</h3>
                <p className="text-sm text-portal-secondary mt-1">
                  {t('projects.portal.feedbackReadmeHelp', 'Upload a README.md file with feedback about your team\'s experience using Open Mercato during the hackathon. This file is required for final submission.')}
                </p>
              </div>
              <PortalBadge variant={attachmentIds.length > 0 ? 'success' : 'warning'}>
                {attachmentIds.length > 0
                  ? t('projects.portal.readmeStatusReady', 'Ready')
                  : t('projects.portal.readmeStatusRequired', 'Required')}
              </PortalBadge>
            </div>

            {readmeAttachment ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-portal-primary/10 text-portal-primary">
                    <FileCode2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{readmeAttachment.file_name}</p>
                    <p className="text-xs text-portal-secondary">
                      {Math.max(1, Math.round(readmeAttachment.file_size / 1024))} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {readmeAttachment.url ? (
                    <a
                      href={readmeAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-foreground hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                      <Download className="mr-2 size-4" />
                      {t('projects.portal.readmeDownload', 'Open File')}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleRemoveReadme}
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t('projects.portal.readmeRemove', 'Remove')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => readmeInputRef.current?.click()}
                disabled={uploadingReadme || isPublished}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 px-4 py-6 text-sm font-medium text-portal-secondary hover:border-portal-primary/50 hover:bg-portal-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="size-4" />
                {uploadingReadme
                  ? t('projects.portal.readmeUploading', 'Uploading README.md...')
                  : t('projects.portal.readmeUpload', 'Upload README.md')}
              </button>
            )}

            <input
              ref={readmeInputRef}
              type="file"
              accept=".md,text/markdown,text/plain"
              onChange={handleReadmeUpload}
              className="hidden"
            />
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
                  placeholder={t('projects.fields.demoUrl', 'Demo URL')}
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
                  placeholder={t('projects.fields.repoUrl', 'Repository URL')}
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
                  placeholder={t('projects.fields.videoUrl', 'Video Pitch')}
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
                  placeholder={t('projects.fields.presentationUrl', 'Presentation URL')}
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
                  placeholder={t('projects.fields.preexistingCodeDesc', 'Describe the pre-existing code used')}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>{t('projects.fields.builtDuringDesc', 'What was built during the hackathon')}</label>
              <textarea
                className={textareaClass}
                value={builtDuringDescription}
                onChange={(e) => setBuiltDuringDescription(e.target.value)}
                placeholder={t('projects.fields.builtDuringDesc', 'What was built during the hackathon')}
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
