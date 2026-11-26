import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { Competition } from '../../competitions/data/entities'
import { Team, TeamMember } from '../../teams/data/entities'
import { Track } from '../../tracks/data/entities'
import { Project, ProjectGallerySubmission } from '../data/entities'
import { toWallClock, type XlsxCellValue, type XlsxSheet } from './xlsx'

export const MAX_EXPORT_PROJECTS = 1000

export type ProjectExportRecord = {
  project: Project
  competitionName: string | null
  trackName: string | null
  teamName: string | null
  /** "Name (owner)" style labels, owner first. */
  teamMembers: string[]
  attachmentNames: string[]
  gallery: ProjectGallerySubmission | null
}

type Translate = (key: string, fallback: string) => string

type ExportColumn = {
  key: string
  fallback: string
  width: number
  value: (record: ProjectExportRecord, ctx: { translate: Translate; timeZone: string | null }) => XlsxCellValue
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  under_review: 'Under Review',
  scored: 'Scored',
}

const GALLERY_LABELS: Record<string, string> = {
  not_requested: 'Opted in',
  requested: 'Requested',
  pr_open: 'PR open',
  published: 'Live',
  rejected: 'Not accepted',
}

function date(value: Date | null | undefined, timeZone: string | null): Date | null {
  if (!value) return null
  const instant = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(instant.getTime())) return null
  return toWallClock(instant, timeZone)
}

function yesNo(value: boolean, translate: Translate): string {
  return value ? translate('projects.export.xlsx.yes', 'Yes') : translate('projects.export.xlsx.no', 'No')
}

function joinLines(values: Array<string | null | undefined>): string | null {
  const cleaned = values.map((value) => value?.trim() ?? '').filter(Boolean)
  return cleaned.length > 0 ? cleaned.join('\n') : null
}

const COLUMNS: ExportColumn[] = [
  { key: 'title', fallback: 'Title', width: 32, value: (r) => r.project.title },
  { key: 'tagline', fallback: 'Tagline', width: 40, value: (r) => r.project.tagline ?? null },
  { key: 'competition', fallback: 'Competition', width: 24, value: (r) => r.competitionName },
  { key: 'track', fallback: 'Track', width: 24, value: (r) => r.trackName },
  { key: 'team', fallback: 'Team', width: 24, value: (r) => r.teamName },
  { key: 'teamMembers', fallback: 'Team members', width: 36, value: (r) => joinLines(r.teamMembers) },
  {
    key: 'status',
    fallback: 'Status',
    width: 14,
    value: (r, { translate }) => {
      const status = String(r.project.status)
      return translate(`projects.export.xlsx.status.${status}`, STATUS_LABELS[status] ?? status)
    },
  },
  { key: 'submittedAt', fallback: 'Submitted at', width: 18, value: (r, { timeZone }) => date(r.project.submittedAt, timeZone) },
  { key: 'description', fallback: 'Description', width: 60, value: (r) => r.project.description ?? null },
  { key: 'problemStatement', fallback: 'Problem statement', width: 60, value: (r) => r.project.problemStatement ?? null },
  { key: 'solution', fallback: 'Solution', width: 60, value: (r) => r.project.solution ?? null },
  { key: 'techStack', fallback: 'Tech stack', width: 30, value: (r) => (r.project.techStack ?? []).join(', ') || null },
  { key: 'demoUrl', fallback: 'Demo URL', width: 36, value: (r) => r.project.demoUrl ?? null },
  { key: 'repoUrl', fallback: 'Repository URL', width: 36, value: (r) => r.project.repoUrl ?? null },
  { key: 'videoUrl', fallback: 'Video URL', width: 36, value: (r) => r.project.videoUrl ?? null },
  { key: 'presentationUrl', fallback: 'Presentation URL', width: 36, value: (r) => r.project.presentationUrl ?? null },
  { key: 'screenshots', fallback: 'Screenshots', width: 12, value: (r) => (r.project.screenshotIds ?? []).length },
  { key: 'attachments', fallback: 'Attachments', width: 36, value: (r) => joinLines(r.attachmentNames) },
  {
    key: 'usesPreexistingCode',
    fallback: 'Uses pre-existing code',
    width: 14,
    value: (r, { translate }) => yesNo(Boolean(r.project.usesPreexistingCode), translate),
  },
  { key: 'preexistingCode', fallback: 'Pre-existing code', width: 50, value: (r) => r.project.preexistingCodeDescription ?? null },
  { key: 'builtDuringHackathon', fallback: 'Built during hackathon', width: 50, value: (r) => r.project.builtDuringHackathonDescription ?? null },
  {
    key: 'flagged',
    fallback: 'Flagged for reuse',
    width: 14,
    value: (r, { translate }) => yesNo(Boolean(r.project.flaggedForReuse), translate),
  },
  { key: 'flagReason', fallback: 'Flag reason', width: 36, value: (r) => r.project.flaggedReason ?? null },
  { key: 'flaggedAt', fallback: 'Flagged at', width: 18, value: (r, { timeZone }) => date(r.project.flaggedAt, timeZone) },
  { key: 'finalScore', fallback: 'Final score', width: 12, value: (r) => r.project.finalScore ?? null },
  { key: 'peerVotes', fallback: "People's Choice votes", width: 14, value: (r) => r.project.peerVoteCount ?? null },
  { key: 'rank', fallback: 'Rank', width: 8, value: (r) => r.project.rank ?? null },
  { key: 'manualRank', fallback: 'Manual rank override', width: 12, value: (r) => r.project.manualRankOverride ?? null },
  {
    key: 'galleryOptIn',
    fallback: 'Gallery opt-in',
    width: 14,
    value: (r, { translate }) => yesNo(Boolean(r.gallery?.publishToGallery), translate),
  },
  {
    key: 'galleryStatus',
    fallback: 'Gallery status',
    width: 16,
    value: (r, { translate }) => {
      const gallery = r.gallery
      if (!gallery || (!gallery.publishToGallery && gallery.status === 'not_requested')) return null
      return translate(`projects.export.xlsx.gallery.${gallery.status}`, GALLERY_LABELS[gallery.status] ?? gallery.status)
    },
  },
  { key: 'galleryPrUrl', fallback: 'Gallery PR URL', width: 36, value: (r) => r.gallery?.prUrl ?? null },
  { key: 'galleryLiveUrl', fallback: 'Gallery live URL', width: 36, value: (r) => r.gallery?.liveUrl ?? null },
  { key: 'createdAt', fallback: 'Created at', width: 18, value: (r, { timeZone }) => date(r.project.createdAt, timeZone) },
  { key: 'updatedAt', fallback: 'Updated at', width: 18, value: (r, { timeZone }) => date(r.project.updatedAt, timeZone) },
  { key: 'id', fallback: 'Project ID', width: 38, value: (r) => r.project.id },
]

export function buildProjectExportSheet(
  records: ProjectExportRecord[],
  options: { translate: Translate; timeZone: string | null },
): XlsxSheet {
  return {
    name: options.translate('projects.export.xlsx.sheet', 'Projects'),
    columns: COLUMNS.map((column) => ({
      header: options.translate(`projects.export.xlsx.column.${column.key}`, column.fallback),
      width: column.width,
    })),
    rows: records.map((record) => COLUMNS.map((column) => column.value(record, options))),
  }
}

/**
 * Load everything the export shows for the given project ids, scoped to one tenant and
 * organization. Unknown or out-of-scope ids are silently dropped. Records keep the order of the
 * ids the caller sent (i.e. the order shown in the table).
 */
export async function loadProjectExportRecords(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  projectIds: string[],
): Promise<ProjectExportRecord[]> {
  if (projectIds.length === 0) return []
  const projects = await em.find(Project, {
    id: { $in: projectIds },
    ...scope,
    deletedAt: null,
  } as FilterQuery<Project>)
  if (projects.length === 0) return []

  const unique = <T,>(values: Array<T | null | undefined>) => [...new Set(values.filter((v): v is T => v != null))]
  const teamIds = unique(projects.map((p) => p.teamId))
  const trackIds = unique(projects.map((p) => p.trackId))
  const competitionIds = unique(projects.map((p) => p.competitionId))
  const attachmentIds = unique(projects.flatMap((p) => p.attachmentIds ?? []))

  const [teams, tracks, competitions, members, attachments, galleryRows] = await Promise.all([
    teamIds.length ? em.find(Team, { id: { $in: teamIds }, ...scope } as FilterQuery<Team>) : Promise.resolve([] as Team[]),
    trackIds.length ? em.find(Track, { id: { $in: trackIds }, ...scope } as FilterQuery<Track>) : Promise.resolve([] as Track[]),
    competitionIds.length
      ? em.find(Competition, { id: { $in: competitionIds }, ...scope } as FilterQuery<Competition>)
      : Promise.resolve([] as Competition[]),
    teamIds.length
      ? em.find(TeamMember, { teamId: { $in: teamIds }, deletedAt: null, ...scope } as FilterQuery<TeamMember>)
      : Promise.resolve([] as TeamMember[]),
    attachmentIds.length
      ? em.find(Attachment, { id: { $in: attachmentIds }, ...scope } as FilterQuery<Attachment>)
      : Promise.resolve([] as Attachment[]),
    em.find(ProjectGallerySubmission, {
      projectId: { $in: projects.map((p) => p.id) },
      deletedAt: null,
      ...scope,
    } as FilterQuery<ProjectGallerySubmission>),
  ])

  const activeMembers = members.filter((member) => !member.leftAt)
  const userIds = unique(activeMembers.map((member) => member.customerUserId))
  // display_name is encryptable on customer_users — always read it through findWithDecryption.
  const users = userIds.length
    ? await findWithDecryption(
        em,
        CustomerUser,
        { id: { $in: userIds }, tenantId: scope.tenantId } as FilterQuery<CustomerUser>,
        undefined,
        scope,
      )
    : []
  const userNames = new Map(users.map((user) => [user.id, user.displayName?.trim() || null]))

  const membersByTeam = new Map<string, string[]>()
  const sortedMembers = [...activeMembers].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  })
  for (const member of sortedMembers) {
    const name = userNames.get(member.customerUserId)
    if (!name) continue
    const label = member.role === 'owner' ? `${name} (owner)` : name
    const list = membersByTeam.get(member.teamId) ?? []
    list.push(label)
    membersByTeam.set(member.teamId, list)
  }

  const teamNames = new Map(teams.map((team) => [team.id, team.name]))
  const trackNames = new Map(tracks.map((track) => [track.id, track.name]))
  const competitionNames = new Map(competitions.map((competition) => [competition.id, competition.name]))
  const attachmentNames = new Map(attachments.map((attachment) => [attachment.id, attachment.fileName]))
  const galleryByProject = new Map(galleryRows.map((row) => [row.projectId, row]))
  const order = new Map(projectIds.map((id, index) => [id, index]))

  return [...projects]
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((project) => ({
      project,
      competitionName: competitionNames.get(project.competitionId) ?? null,
      trackName: trackNames.get(project.trackId) ?? null,
      teamName: teamNames.get(project.teamId) ?? null,
      teamMembers: membersByTeam.get(project.teamId) ?? [],
      attachmentNames: (project.attachmentIds ?? []).map((id) => attachmentNames.get(id) ?? id),
      gallery: galleryByProject.get(project.id) ?? null,
    }))
}
