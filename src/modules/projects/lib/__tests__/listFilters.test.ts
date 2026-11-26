jest.mock('../../../teams/data/entities', () => ({ Team: class Team {} }))
jest.mock('../../data/entities', () => ({
  GalleryStatus: { NOT_REQUESTED: 'not_requested', REQUESTED: 'requested', PR_OPEN: 'pr_open', PUBLISHED: 'published', REJECTED: 'rejected' },
  ProjectGallerySubmission: class ProjectGallerySubmission {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { galleryRowMatches, narrowIdFilter, resolveListFilterConstraints, NO_MATCH_ID } = require('../listFilters') as typeof import('../listFilters')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teams = require('../../../teams/data/entities')

describe('galleryRowMatches', () => {
  const hidden = { projectId: 'p', publishToGallery: false, status: 'not_requested' as const }
  const optedIn = { projectId: 'p', publishToGallery: true, status: 'not_requested' as const }
  const live = { projectId: 'p', publishToGallery: true, status: 'published' as const }

  it('mirrors the Gallery column', () => {
    expect(galleryRowMatches(hidden, 'none')).toBe(true)
    expect(galleryRowMatches(optedIn, 'none')).toBe(false)
    expect(galleryRowMatches(optedIn, 'not_requested')).toBe(true)
    expect(galleryRowMatches(hidden, 'not_requested')).toBe(false)
    expect(galleryRowMatches(live, 'published')).toBe(true)
    expect(galleryRowMatches(live, 'requested')).toBe(false)
  })
})

describe('narrowIdFilter', () => {
  it('is a no-op without constraints', () => {
    expect(narrowIdFilter(undefined, null, null)).toBeUndefined()
    expect(narrowIdFilter('a', null, null)).toBe('a')
  })

  it('restricts to allowed ids and never emits an empty IN list', () => {
    expect(narrowIdFilter(undefined, ['a', 'b'], null)).toEqual({ $in: ['a', 'b'] })
    expect(narrowIdFilter(undefined, [], null)).toEqual({ $in: [NO_MATCH_ID] })
    expect(narrowIdFilter('a', ['a'], null)).toBe('a')
    expect(narrowIdFilter('c', ['a'], null)).toEqual({ $in: [NO_MATCH_ID] })
  })

  it('excludes ids', () => {
    expect(narrowIdFilter(undefined, null, ['a'])).toEqual({ $nin: ['a'] })
    expect(narrowIdFilter(undefined, null, [])).toBeUndefined()
    expect(narrowIdFilter('a', null, ['a'])).toEqual({ $in: [NO_MATCH_ID] })
  })
})

describe('resolveListFilterConstraints', () => {
  function fakeEm(teamRows: unknown[], galleryRows: unknown[]) {
    return {
      find: jest.fn(async (entity: unknown) => (entity === teams.Team ? teamRows : galleryRows)),
    }
  }

  it('resolves a team name to scoped, escaped team ids', async () => {
    const em = fakeEm([{ id: 't-1' }], [])
    const result = await resolveListFilterConstraints(em as never, {
      tenantId: 'tenant-1', organizationIds: ['org-1'], teamName: ' 100%_ ',
    })
    expect(result).toEqual({ teamIds: ['t-1'], projectIds: null, excludedProjectIds: null })
    expect(em.find).toHaveBeenCalledWith(
      teams.Team,
      { tenantId: 'tenant-1', organizationId: { $in: ['org-1'] }, deletedAt: null, name: { $ilike: '%100\\%\\_%' } },
      { fields: ['id'] },
    )
  })

  it('maps a gallery status to matching project ids', async () => {
    const em = fakeEm([], [
      { projectId: 'p-1', publishToGallery: true, status: 'published' },
      { projectId: 'p-2', publishToGallery: true, status: 'requested' },
    ])
    const result = await resolveListFilterConstraints(em as never, { tenantId: 't', organizationIds: null, galleryStatus: 'published' })
    expect(result.projectIds).toEqual(['p-1'])
    expect(result.excludedProjectIds).toBeNull()
  })

  it('maps "none" to an exclusion of projects shown in the gallery column', async () => {
    const em = fakeEm([], [
      { projectId: 'p-1', publishToGallery: true, status: 'not_requested' },
      { projectId: 'p-2', publishToGallery: false, status: 'not_requested' },
    ])
    const result = await resolveListFilterConstraints(em as never, { tenantId: 't', organizationIds: null, galleryStatus: 'none' })
    expect(result.projectIds).toBeNull()
    expect(result.excludedProjectIds).toEqual(['p-1'])
  })
})

export {}
