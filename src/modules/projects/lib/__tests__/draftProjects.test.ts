jest.mock('../../data/entities', () => ({
  Project: class Project {},
  ProjectStatus: { DRAFT: 'draft', PUBLISHED: 'published' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ensureDraftProjects, isUntouchedDraft, missingDraftProjectTrackIds } = require('../draftProjects') as typeof import('../draftProjects')

const team = { id: 'team-1', name: 'Aurora', competitionId: 'comp-1', tenantId: 'tenant-1', organizationId: 'org-1' }

const emptyDraft = {
  status: 'draft' as const,
  description: null, problemStatement: null, solution: '  ', tagline: null,
  demoUrl: null, repoUrl: null, videoUrl: null, presentationUrl: null,
  screenshotIds: [], attachmentIds: [], techStack: [],
}

function fakeEm(existing: Array<Record<string, unknown>>) {
  const persisted: Array<Record<string, unknown>> = []
  return {
    persisted,
    em: {
      find: jest.fn(async () => existing),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ ...data })),
      persist: jest.fn((entity: Record<string, unknown>) => { persisted.push(entity) }),
      flush: jest.fn(),
    },
  }
}

describe('missingDraftProjectTrackIds', () => {
  it('keeps order, drops covered tracks and duplicates', () => {
    expect(missingDraftProjectTrackIds(['a', 'b', 'a', '', 'c'], ['b'])).toEqual(['a', 'c'])
    expect(missingDraftProjectTrackIds([], ['b'])).toEqual([])
  })
})

describe('isUntouchedDraft', () => {
  it('is true only for a draft with no content at all', () => {
    expect(isUntouchedDraft(emptyDraft)).toBe(true)
    expect(isUntouchedDraft({ ...emptyDraft, description: 'We built a thing' })).toBe(false)
    expect(isUntouchedDraft({ ...emptyDraft, attachmentIds: ['readme'] })).toBe(false)
    expect(isUntouchedDraft({ ...emptyDraft, techStack: ['Next.js'] })).toBe(false)
    expect(isUntouchedDraft({ ...emptyDraft, status: 'published' as const })).toBe(false)
  })
})

describe('ensureDraftProjects', () => {
  it('creates one draft per track that has no project and never flushes', async () => {
    const { em, persisted } = fakeEm([{ trackId: 'track-a', deletedAt: null }])
    const created = await ensureDraftProjects(em as never, team, ['track-a', 'track-b'])

    expect(created).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      teamId: 'team-1', competitionId: 'comp-1', trackId: 'track-b', status: 'draft',
      title: "Aurora's Project", tenantId: 'tenant-1', organizationId: 'org-1',
    })
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('is idempotent', async () => {
    const { em, persisted } = fakeEm([{ trackId: 'track-a', deletedAt: null }])
    expect(await ensureDraftProjects(em as never, team, ['track-a'])).toEqual([])
    expect(persisted).toEqual([])
  })

  it('revives a soft-deleted project instead of violating the (team, track, competition) unique key', async () => {
    const deleted = { trackId: 'track-a', deletedAt: new Date(), status: 'published' }
    const { em, persisted } = fakeEm([deleted])
    const created = await ensureDraftProjects(em as never, team, ['track-a'])

    expect(created).toEqual([deleted])
    expect(deleted).toMatchObject({ deletedAt: null, status: 'draft' })
    expect(em.create).not.toHaveBeenCalled()
    expect(persisted).toEqual([deleted])
  })

  it('does not query at all without tracks', async () => {
    const { em } = fakeEm([])
    expect(await ensureDraftProjects(em as never, team, [])).toEqual([])
    expect(em.find).not.toHaveBeenCalled()
  })
})

export {}
