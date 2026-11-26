jest.mock('@open-mercato/core/modules/attachments/data/entities', () => ({ Attachment: class Attachment {} }))
jest.mock('@open-mercato/core/modules/customer_accounts/data/entities', () => ({ CustomerUser: class CustomerUser {} }))
jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findWithDecryption: jest.fn(async () => [
    { id: 'user-owner', displayName: 'Ada Owner' },
    { id: 'user-member', displayName: 'Bob Member' },
    { id: 'user-left', displayName: 'Cyd Left' },
  ]),
}))
jest.mock('../../../competitions/data/entities', () => ({ Competition: class Competition {} }))
jest.mock('../../../teams/data/entities', () => ({ Team: class Team {}, TeamMember: class TeamMember {} }))
jest.mock('../../../tracks/data/entities', () => ({ Track: class Track {} }))
jest.mock('../../data/entities', () => ({
  Project: class Project {},
  ProjectGallerySubmission: class ProjectGallerySubmission {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildProjectExportSheet, loadProjectExportRecords } = require('../projectExport') as typeof import('../projectExport')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../data/entities')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teams = require('../../../teams/data/entities')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tracks = require('../../../tracks/data/entities')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const competitions = require('../../../competitions/data/entities')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const attachments = require('@open-mercato/core/modules/attachments/data/entities')

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' }

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1', teamId: 'team-1', trackId: 'track-1', competitionId: 'comp-1',
    title: 'Aurora', tagline: 'Northern lights', description: 'Desc', problemStatement: 'Problem', solution: 'Solution',
    techStack: ['Next.js', 'Postgres'], demoUrl: 'https://demo', repoUrl: 'https://repo', videoUrl: null, presentationUrl: null,
    screenshotIds: ['s1', 's2'], attachmentIds: ['a-1', 'a-missing'],
    usesPreexistingCode: true, preexistingCodeDescription: 'Starter', builtDuringHackathonDescription: 'Everything else',
    flaggedForReuse: false, flaggedAt: null, flaggedReason: null,
    status: 'published', submittedAt: new Date('2026-09-20T09:06:00Z'),
    finalScore: 8.25, peerVoteCount: 3, rank: 2, manualRankOverride: null,
    createdAt: new Date('2026-09-19T08:00:00Z'), updatedAt: new Date('2026-09-20T09:06:00Z'),
    ...scope,
    ...overrides,
  }
}

function fakeEm(data: Map<unknown, unknown[]>) {
  const calls: Array<{ entity: unknown; where: Record<string, unknown> }> = []
  return {
    calls,
    em: {
      find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
        calls.push({ entity, where })
        return data.get(entity) ?? []
      }),
    },
  }
}

describe('loadProjectExportRecords', () => {
  it('returns nothing without ids and never queries', async () => {
    const { em } = fakeEm(new Map())
    await expect(loadProjectExportRecords(em as never, scope, [])).resolves.toEqual([])
    expect(em.find).not.toHaveBeenCalled()
  })

  it('joins team, track, competition, members, attachments and gallery, keeping the requested order', async () => {
    const { em, calls } = fakeEm(new Map<unknown, unknown[]>([
      [entities.Project, [project(), project({ id: 'p-2', title: 'Borealis', teamId: 'team-2', attachmentIds: [] })]],
      [teams.Team, [{ id: 'team-1', name: 'Team One' }, { id: 'team-2', name: 'Team Two' }]],
      [tracks.Track, [{ id: 'track-1', name: 'AI Company' }]],
      [competitions.Competition, [{ id: 'comp-1', name: 'HackOn 2026' }]],
      [teams.TeamMember, [
        { teamId: 'team-1', customerUserId: 'user-member', role: 'member', joinedAt: new Date('2026-09-01') },
        { teamId: 'team-1', customerUserId: 'user-owner', role: 'owner', joinedAt: new Date('2026-09-02') },
        { teamId: 'team-1', customerUserId: 'user-left', role: 'member', joinedAt: new Date('2026-09-01'), leftAt: new Date() },
      ]],
      [attachments.Attachment, [{ id: 'a-1', fileName: 'deck.pdf' }]],
      [entities.ProjectGallerySubmission, [{ projectId: 'p-1', publishToGallery: true, status: 'pr_open', prUrl: 'https://pr', liveUrl: null }]],
    ]))

    const records = await loadProjectExportRecords(em as never, scope, ['p-2', 'p-1'])

    expect(records.map((r) => r.project.id)).toEqual(['p-2', 'p-1'])
    const aurora = records[1]
    expect(aurora.teamName).toBe('Team One')
    expect(aurora.trackName).toBe('AI Company')
    expect(aurora.competitionName).toBe('HackOn 2026')
    expect(aurora.teamMembers).toEqual(['Ada Owner (owner)', 'Bob Member'])
    expect(aurora.attachmentNames).toEqual(['deck.pdf', 'a-missing'])
    expect(aurora.gallery?.status).toBe('pr_open')
    expect(records[0].gallery).toBeNull()
    expect(records[0].teamMembers).toEqual([])

    // Every query is tenant + organization scoped.
    for (const call of calls) {
      expect(call.where).toMatchObject(scope)
    }
  })
})

describe('buildProjectExportSheet', () => {
  const translate = (_key: string, fallback: string) => fallback

  it('produces one row per project with every field', () => {
    const sheet = buildProjectExportSheet([
      {
        project: project() as never,
        competitionName: 'HackOn 2026',
        trackName: 'AI Company',
        teamName: 'Team One',
        teamMembers: ['Ada Owner (owner)', 'Bob Member'],
        attachmentNames: ['deck.pdf'],
        gallery: { publishToGallery: true, status: 'pr_open', prUrl: 'https://pr', liveUrl: null } as never,
      },
    ], { translate, timeZone: 'Europe/Warsaw' })

    const headers = sheet.columns.map((c) => c.header)
    const row = Object.fromEntries(headers.map((h, i) => [h, sheet.rows[0][i]]))
    expect(sheet.name).toBe('Projects')
    expect(sheet.rows).toHaveLength(1)
    expect(row).toMatchObject({
      Title: 'Aurora',
      Competition: 'HackOn 2026',
      Track: 'AI Company',
      Team: 'Team One',
      'Team members': 'Ada Owner (owner)\nBob Member',
      Status: 'Published',
      'Tech stack': 'Next.js, Postgres',
      Screenshots: 2,
      Attachments: 'deck.pdf',
      'Uses pre-existing code': 'Yes',
      'Flagged for reuse': 'No',
      'Final score': 8.25,
      Rank: 2,
      'Gallery opt-in': 'Yes',
      'Gallery status': 'PR open',
      'Gallery PR URL': 'https://pr',
      'Project ID': 'p-1',
    })
    // Dates are shifted to the browser's wall clock (Warsaw is UTC+2 in September).
    expect((row['Submitted at'] as Date).toISOString()).toBe('2026-09-20T11:06:00.000Z')
    expect(row['Video URL']).toBeNull()
  })

  it('leaves the gallery status blank when the team never opted in', () => {
    const sheet = buildProjectExportSheet([
      {
        project: project() as never,
        competitionName: null, trackName: null, teamName: null, teamMembers: [], attachmentNames: [],
        gallery: { publishToGallery: false, status: 'not_requested', prUrl: null, liveUrl: null } as never,
      },
    ], { translate, timeZone: null })
    const index = sheet.columns.findIndex((c) => c.header === 'Gallery status')
    expect(sheet.rows[0][index]).toBeNull()
  })
})

export {}
