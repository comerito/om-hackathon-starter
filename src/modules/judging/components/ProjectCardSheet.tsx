"use client"
import * as React from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@open-mercato/ui/primitives/sheet'
import type { JudgeProjectCard } from '../lib/judgeAssignments'
import { formatQueuePosition } from '../lib/demoQueue'
import {
  presentText, resolveProjectCardLinks, resolveReuseWarnings, resolveTechStack,
  type ProjectCardLinkKind,
} from '../lib/projectCard'

export type { JudgeProjectCard } from '../lib/judgeAssignments'

export type ProjectCardSheetProps = {
  project: JudgeProjectCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Full project card for judges in a right-hand side panel (SPEC-007, Q7).
 *
 * Opened from the voting queue and the voting page. Every section is hidden when the project has
 * nothing for it; reuse warnings sit above the content so a judge cannot miss them.
 */
export function ProjectCardSheet({ project, open, onOpenChange }: ProjectCardSheetProps) {
  const t = useT()

  const linkLabels: Record<ProjectCardLinkKind, string> = {
    demo: t('judging.portal.projectCard.links.demo', 'Live demo'),
    repo: t('judging.portal.projectCard.links.repo', 'Repository'),
    video: t('judging.portal.projectCard.links.video', 'Video'),
    presentation: t('judging.portal.projectCard.links.presentation', 'Presentation'),
  }

  const tagline = presentText(project?.tagline)
  const teamName = presentText(project?.team_name)
  const trackName = presentText(project?.track_name)
  const queuePosition = formatQueuePosition(project?.demo?.order)
  const problem = presentText(project?.problem_statement)
  const description = presentText(project?.description)
  const techStack = resolveTechStack(project?.tech_stack)
  const links = project ? resolveProjectCardLinks(project) : []
  const reuse = project ? resolveReuseWarnings(project) : null
  const screenshots = (project?.screenshots ?? []).filter((shot) => presentText(shot.url))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        closeLabel={t('judging.portal.projectCard.close', 'Close')}
      >
        <SheetHeader>
          <SheetTitle className="text-lg">
            {project?.title ?? t('judging.portal.projectCard.title', 'Project card')}
          </SheetTitle>
          {tagline ? (
            <SheetDescription>{tagline}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              {t('judging.portal.projectCard.title', 'Project card')}
            </SheetDescription>
          )}
          {project && (teamName || trackName || queuePosition) ? (
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {teamName ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t('judging.portal.projectCard.team', 'Team')}:</dt>
                  <dd className="font-medium">{teamName}</dd>
                </div>
              ) : null}
              {trackName ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t('judging.portal.projectCard.track', 'Track')}:</dt>
                  <dd className="font-medium">{trackName}</dd>
                </div>
              ) : null}
              {queuePosition ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t('judging.portal.projectCard.queuePosition', 'Demo order')}:</dt>
                  <dd className="font-medium tabular-nums">#{queuePosition}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </SheetHeader>

        {project ? (
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
            {reuse && (reuse.flaggedForReuse || reuse.preexistingCode) ? (
              <div className="space-y-2" role="alert">
                {reuse.flaggedForReuse ? (
                  <div className="flex items-start gap-2 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2.5 text-sm text-status-error-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{t('judging.portal.projectCard.flaggedForReuse', 'Flagged: code from before the hackathon')}</p>
                      <p className="mt-0.5">{t('judging.portal.projectCard.flaggedForReuseDesc', 'This project is flagged for reusing work created before the event. Take it into account when voting.')}</p>
                    </div>
                  </div>
                ) : null}
                {reuse.preexistingCode ? (
                  <div className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2.5 text-sm text-status-warning-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{t('judging.portal.projectCard.preexistingCode', 'The team declared pre-existing code')}</p>
                      <p className="mt-0.5 whitespace-pre-line">
                        {reuse.preexistingCode.description
                          ?? t('judging.portal.projectCard.preexistingCodeNoDescription', 'No description of the pre-existing code was provided.')}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {problem ? (
              <Section title={t('judging.portal.projectCard.problem', 'Problem')}>
                <p className="whitespace-pre-line text-sm leading-6">{problem}</p>
              </Section>
            ) : null}

            {description ? (
              <Section title={t('judging.portal.projectCard.description', 'Description')}>
                <p className="whitespace-pre-line text-sm leading-6">{description}</p>
              </Section>
            ) : null}

            {techStack.length > 0 ? (
              <Section title={t('judging.portal.projectCard.techStack', 'Tech stack')}>
                <ul className="flex flex-wrap gap-1.5">
                  {techStack.map((tech) => (
                    <li key={tech} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">
                      {tech}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {links.length > 0 ? (
              <Section title={t('judging.portal.projectCard.linksTitle', 'Links')}>
                <ul className="space-y-1.5">
                  {links.map((link) => (
                    <li key={link.kind}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 rounded-md text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="font-medium">{linkLabels[link.kind]}</span>
                        <span className="truncate text-muted-foreground group-hover:no-underline">{link.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {screenshots.length > 0 ? (
              <Section title={t('judging.portal.projectCard.screenshots', 'Screenshots')}>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {screenshots.map((shot, index) => {
                    const alt = t('judging.portal.projectCard.screenshotAlt', 'Screenshot {index} of {title}', {
                      index: index + 1, title: project.title,
                    })
                    return (
                      <li key={shot.id}>
                        <a
                          href={shot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border bg-muted/30 transition-opacity hover:opacity-90"
                          title={t('judging.portal.projectCard.openScreenshot', 'Open full size in a new tab')}
                        >
                          <img src={shot.url} alt={alt} loading="lazy" className="aspect-video w-full object-cover" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </Section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

