'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components'
import { PortalEmptyState } from '@open-mercato/ui/portal/components'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
  projectSubmissionDeadline: string | null
}

interface ProjectData {
  id: string
  team_id: string
  competition_id: string
  track_id: string
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
  uses_preexisting_code: boolean
  preexisting_code_description: string | null
  built_during_hackathon_description: string | null
  status: string
  submitted_at: string | null
}

// ---------------------------------------------------------------------------
// Completeness check
// ---------------------------------------------------------------------------

function getCompleteness(project: ProjectData | null): { items: { label: string; done: boolean }[]; pct: number } {
  if (!project) return { items: [], pct: 0 }
  const items = [
    { label: 'Title', done: !!project.title?.trim() },
    { label: 'Description', done: !!project.description?.trim() },
    { label: 'Problem statement', done: !!project.problem_statement?.trim() },
    { label: 'Solution', done: !!project.solution?.trim() },
    { label: 'Tech stack', done: project.tech_stack?.length > 0 },
    { label: 'Originality disclosure', done: project.uses_preexisting_code !== undefined },
    { label: 'Demo or repo URL', done: !!project.demo_url || !!project.repo_url },
  ]
  const done = items.filter((i) => i.done).length
  return { items, pct: Math.round((done / items.length) * 100) }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalProjectEditorPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [solution, setSolution] = useState('')
  const [techStackInput, setTechStackInput] = useState('')
  const [techStack, setTechStack] = useState<string[]>([])
  const [demoUrl, setDemoUrl] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [presentationUrl, setPresentationUrl] = useState('')
  const [usesPreexistingCode, setUsesPreexistingCode] = useState(false)
  const [preexistingCodeDescription, setPreexistingCodeDescription] = useState('')
  const [builtDuringHackathonDescription, setBuiltDuringHackathonDescription] = useState('')

  const isDraft = project?.status === 'DRAFT'
  const isSubmitted = project?.status === 'PUBLISHED' || project?.status === 'UNDER_REVIEW' || project?.status === 'SCORED'

  // Load data
  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Fetch active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (!comp) {
        setProject(null)
        return
      }

      // Find user's team
      const teamsRes = await apiCall(`/api/teams/teams?competitionId=${comp.id}&pageSize=100`)
      const allTeams = teamsRes?.data ?? []

      let userTeamId: string | null = null
      for (const team of allTeams) {
        // Check membership via invitations
        const memberCheck = await apiCall(`/api/teams/invitations?teamId=${team.id}&inviteeId=${user.id}&status=ACCEPTED&pageSize=1`)
        if (memberCheck?.data?.length > 0) {
          userTeamId = team.id as string
          break
        }
      }

      if (!userTeamId) {
        setProject(null)
        return
      }

      // Find project for this team
      const projRes = await apiCall(`/api/projects/projects?teamId=${userTeamId}&competitionId=${comp.id}&pageSize=1`)
      const proj = projRes?.data?.[0] ?? null
      setProject(proj)

      if (proj) {
        setTitle(proj.title ?? '')
        setTagline(proj.tagline ?? '')
        setDescription(proj.description ?? '')
        setProblemStatement(proj.problem_statement ?? '')
        setSolution(proj.solution ?? '')
        setTechStack(Array.isArray(proj.tech_stack) ? proj.tech_stack : [])
        setDemoUrl(proj.demo_url ?? '')
        setRepoUrl(proj.repo_url ?? '')
        setVideoUrl(proj.video_url ?? '')
        setPresentationUrl(proj.presentation_url ?? '')
        setUsesPreexistingCode(proj.uses_preexisting_code ?? false)
        setPreexistingCodeDescription(proj.preexisting_code_description ?? '')
        setBuiltDuringHackathonDescription(proj.built_during_hackathon_description ?? '')
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  usePortalAppEvent('projects.project.updated', () => { fetchData() })

  // Auto-save every 30s
  const saveProject = useCallback(async () => {
    if (!project || isSubmitted) return
    setSaving(true)
    try {
      await apiCall('/api/projects/projects', {
        method: 'PUT',
        body: JSON.stringify({
          id: project.id,
          title: title.trim() || project.title,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          problemStatement: problemStatement.trim() || null,
          solution: solution.trim() || null,
          techStack,
          demoUrl: demoUrl.trim() || null,
          repoUrl: repoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null,
          presentationUrl: presentationUrl.trim() || null,
          usesPreexistingCode,
          preexistingCodeDescription: preexistingCodeDescription.trim() || null,
          builtDuringHackathonDescription: builtDuringHackathonDescription.trim() || null,
        }),
      })
      setLastSaved(new Date())
    } catch {
      // silent — will retry
    } finally {
      setSaving(false)
    }
  }, [project, isSubmitted, title, tagline, description, problemStatement, solution, techStack, demoUrl, repoUrl, videoUrl, presentationUrl, usesPreexistingCode, preexistingCodeDescription, builtDuringHackathonDescription])

  useEffect(() => {
    if (!project || isSubmitted) return
    autoSaveTimerRef.current = setInterval(() => {
      saveProject()
    }, 30_000)
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    }
  }, [saveProject, project, isSubmitted])

  // Deadline countdown
  useEffect(() => {
    if (!competition?.projectSubmissionDeadline) {
      setDeadlineMs(null)
      return
    }
    const update = () => {
      const remaining = new Date(competition.projectSubmissionDeadline!).getTime() - Date.now()
      setDeadlineMs(remaining > 0 ? remaining : 0)
    }
    update()
    deadlineTimerRef.current = setInterval(update, 1_000)
    return () => {
      if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current)
    }
  }, [competition?.projectSubmissionDeadline])

  const deadlinePassed = deadlineMs !== null && deadlineMs <= 0
  const deadlineCritical = deadlineMs !== null && deadlineMs > 0 && deadlineMs <= 15 * 60 * 1000

  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return '0:00:00'
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1_000)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Tech stack tag management
  const handleAddTech = () => {
    const val = techStackInput.trim()
    if (val && !techStack.includes(val) && techStack.length < 20) {
      setTechStack([...techStack, val])
      setTechStackInput('')
    }
  }

  const handleRemoveTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech))
  }

  const handleTechKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTech()
    }
  }

  // Submit
  const handleSubmit = async () => {
    if (!project || deadlinePassed) return

    // Save first
    await saveProject()

    setSubmitting(true)
    try {
      const res = await apiCall('/api/projects/projects/submit', {
        method: 'POST',
        body: JSON.stringify({ projectId: project.id }),
      })
      if (res?.error) {
        const details = Array.isArray(res.details) ? res.details.join(', ') : ''
        alert(`${res.error}${details ? ': ' + details : ''}`)
        return
      }
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  // Completeness
  const fakeProject: ProjectData | null = project
    ? {
        ...project,
        title,
        description,
        problem_statement: problemStatement,
        solution,
        tech_stack: techStack,
        demo_url: demoUrl || null,
        repo_url: repoUrl || null,
        uses_preexisting_code: usesPreexistingCode,
      }
    : null
  const { items: completenessItems, pct: completenessPct } = getCompleteness(fakeProject)

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('projects.portal.editor.title', 'My Project')} />
        <PortalEmptyState
          title={t('projects.portal.editor.noCompetition', 'No active competition')}
          description={t('projects.portal.editor.noCompetitionDesc', 'There is no active competition at this time.')}
        />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('projects.portal.editor.title', 'My Project')} />
        <PortalEmptyState
          title={t('projects.portal.editor.noProject', 'No project yet')}
          description={t('projects.portal.editor.noProjectDesc', 'A project will be created for your team when the hacking phase begins.')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        label={isSubmitted ? t('projects.portal.editor.submitted', 'Submitted') : t('projects.portal.editor.draft', 'Draft')}
        title={t('projects.portal.editor.title', 'My Project')}
      />

      {/* Deadline countdown */}
      {deadlineMs !== null && isDraft && (
        <div className={`rounded-lg border p-4 text-center ${deadlineCritical ? 'border-red-300 bg-red-50' : deadlinePassed ? 'border-red-500 bg-red-100' : 'border-primary/20 bg-primary/5'}`}>
          <div className="text-xs text-muted-foreground mb-1">
            {t('projects.portal.editor.deadline', 'Submission Deadline')}
          </div>
          <div className={`text-2xl font-bold font-mono ${deadlineCritical || deadlinePassed ? 'text-red-600' : 'text-primary'}`}>
            {deadlinePassed ? t('projects.portal.editor.deadlinePassed', 'Deadline passed') : formatCountdown(deadlineMs)}
          </div>
        </div>
      )}

      {/* Auto-save indicator */}
      {isDraft && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {saving && <span>{t('projects.portal.editor.saving', 'Saving...')}</span>}
          {!saving && lastSaved && (
            <span>{t('projects.portal.editor.lastSaved', 'Last saved')}: {lastSaved.toLocaleTimeString()}</span>
          )}
          <Button size="sm" variant="ghost" onClick={saveProject} disabled={saving || isSubmitted}>
            {t('projects.portal.editor.saveNow', 'Save now')}
          </Button>
        </div>
      )}

      {/* Completeness checklist */}
      <PortalCard>
        <PortalCardHeader
          label={t('projects.portal.editor.completeness', 'Completeness')}
          title={`${completenessPct}%`}
        />
        <div className="mt-2 mb-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completenessPct === 100 ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${completenessPct}%` }}
          />
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {completenessItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <span className={`size-4 rounded-full border flex items-center justify-center text-[10px] ${item.done ? 'bg-green-100 border-green-300 text-green-700' : 'bg-muted border-muted-foreground/20 text-muted-foreground'}`}>
                {item.done ? '\u2713' : ''}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </div>
          ))}
        </div>
      </PortalCard>

      {/* Title & Tagline */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.basics', 'Basics')} title={t('projects.portal.editor.titleAndTagline', 'Title & Tagline')} />
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.titleLabel', 'Project title')} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.titlePlaceholder', 'What did you build?')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('projects.portal.editor.taglineLabel', 'Tagline')}
              <span className="text-xs text-muted-foreground ml-1">({tagline.length}/140)</span>
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.taglinePlaceholder', 'One-line description of your project')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              maxLength={140}
            />
          </div>
        </div>
      </PortalCard>

      {/* Description */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.content', 'Content')} title={t('projects.portal.editor.descriptionTitle', 'Description')} />
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.descriptionLabel', 'Description')} *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.descriptionPlaceholder', 'Tell us about your project...')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              rows={5}
              maxLength={10000}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.problemLabel', 'Problem Statement')}</label>
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.problemPlaceholder', 'What problem are you solving?')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              rows={3}
              maxLength={10000}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.solutionLabel', 'Solution')}</label>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.solutionPlaceholder', 'How does your project solve the problem?')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              rows={3}
              maxLength={10000}
            />
          </div>
        </div>
      </PortalCard>

      {/* Tech Stack */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.technical', 'Technical')} title={t('projects.portal.editor.techStackTitle', 'Tech Stack')} />
        <div className="mt-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              onKeyDown={handleTechKeyDown}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.techPlaceholder', 'e.g. React, Python, PostgreSQL')}
              className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              maxLength={100}
            />
            <Button size="sm" onClick={handleAddTech} disabled={isSubmitted || !techStackInput.trim()}>
              {t('projects.portal.editor.addTech', 'Add')}
            </Button>
          </div>
          {techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                >
                  {tech}
                  {!isSubmitted && (
                    <button
                      onClick={() => handleRemoveTech(tech)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      x
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </PortalCard>

      {/* URLs */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.links', 'Links')} title={t('projects.portal.editor.projectLinks', 'Project Links')} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.demoUrl', 'Demo URL')}</label>
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              disabled={isSubmitted}
              placeholder="https://..."
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.repoUrl', 'Repository URL')}</label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isSubmitted}
              placeholder="https://github.com/..."
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.videoUrl', 'Video URL')}</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={isSubmitted}
              placeholder="https://youtube.com/..."
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('projects.portal.editor.slidesUrl', 'Slides URL')}</label>
            <input
              type="url"
              value={presentationUrl}
              onChange={(e) => setPresentationUrl(e.target.value)}
              disabled={isSubmitted}
              placeholder="https://docs.google.com/..."
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>
      </PortalCard>

      {/* Screenshots placeholder */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.media', 'Media')} title={t('projects.portal.editor.screenshots', 'Screenshots')} />
        <div className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed p-8 text-muted-foreground text-sm">
          {t('projects.portal.editor.screenshotPlaceholder', 'Screenshot upload coming soon')}
        </div>
      </PortalCard>

      {/* Originality disclosure */}
      <PortalCard>
        <PortalCardHeader label={t('projects.portal.editor.integrity', 'Integrity')} title={t('projects.portal.editor.originalityTitle', 'Originality Disclosure')} />
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={usesPreexistingCode}
              onChange={(e) => setUsesPreexistingCode(e.target.checked)}
              disabled={isSubmitted}
              className="mt-1"
              id="uses-preexisting-code"
            />
            <label htmlFor="uses-preexisting-code" className="text-sm">
              {t('projects.portal.editor.usesPreexisting', 'This project uses pre-existing code, templates, or libraries beyond standard open-source dependencies')}
            </label>
          </div>
          {usesPreexistingCode && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('projects.portal.editor.preexistingLabel', 'Describe the pre-existing code used')} *
              </label>
              <textarea
                value={preexistingCodeDescription}
                onChange={(e) => setPreexistingCodeDescription(e.target.value)}
                disabled={isSubmitted}
                placeholder={t('projects.portal.editor.preexistingPlaceholder', 'What code existed before the hackathon started?')}
                className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                rows={3}
                maxLength={5000}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('projects.portal.editor.builtDuringLabel', 'What was built during the hackathon?')}
            </label>
            <textarea
              value={builtDuringHackathonDescription}
              onChange={(e) => setBuiltDuringHackathonDescription(e.target.value)}
              disabled={isSubmitted}
              placeholder={t('projects.portal.editor.builtDuringPlaceholder', 'Describe what your team built from scratch during this event.')}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              rows={3}
              maxLength={5000}
            />
          </div>
        </div>
      </PortalCard>

      {/* Submit */}
      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
          <div>
            <div className="text-sm font-medium">{t('projects.portal.editor.readyToSubmit', 'Ready to submit?')}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('projects.portal.editor.submitWarning', 'Once submitted, you can no longer edit your project.')}
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || deadlinePassed || !title.trim() || !description.trim()}
          >
            {submitting
              ? t('projects.portal.editor.submittingBtn', 'Submitting...')
              : t('projects.portal.editor.submitBtn', 'Submit Project')}
          </Button>
        </div>
      )}

      {isSubmitted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <div className="text-sm font-medium text-green-800">
            {t('projects.portal.editor.submittedMsg', 'Your project has been submitted!')}
          </div>
          {project.submitted_at && (
            <p className="text-xs text-green-600 mt-1">
              {t('projects.portal.editor.submittedAt', 'Submitted at')}: {new Date(project.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
