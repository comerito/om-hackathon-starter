import { deliveryModeSchema, emptyMutationSchema, paginationSchema, prepareBatchSchema, recipientsQuerySchema } from '../validators'

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const customerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const input = {
  requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  competitionId,
  mode: 'mock',
  selection: { kind: 'explicit', customerUserIds: [customerId], roles: [] },
}

describe('addon request validation', () => {
  it('normalizes UUID and role sets for idempotent preparation', () => {
    const parsed = prepareBatchSchema.parse({
      ...input,
      competitionId: competitionId.toUpperCase(),
      selection: { kind: 'explicit', customerUserIds: [customerId.toUpperCase(), customerId], roles: ['mentor', 'judge', 'mentor'] },
    })
    expect(parsed.competitionId).toBe(competitionId)
    expect(parsed.selection).toEqual({ kind: 'explicit', customerUserIds: [customerId], roles: ['judge', 'mentor'] })
  })

  it('reserves real mode in persistence but rejects it over HTTP', () => {
    expect(deliveryModeSchema.parse('real')).toBe('real')
    expect(prepareBatchSchema.safeParse({ ...input, mode: 'real' }).success).toBe(false)
  })

  it.each(['tenantId', 'organizationId', 'createdBy', 'status'])('rejects injected %s', (field) => {
    expect(prepareBatchSchema.safeParse({ ...input, [field]: competitionId }).success).toBe(false)
  })

  it('accepts all-filtered roles without client membership', () => {
    expect(prepareBatchSchema.parse({ ...input, selection: { kind: 'all_filtered', roles: ['participant'] } }).selection)
      .toEqual({ kind: 'all_filtered', roles: ['participant'] })
    expect(prepareBatchSchema.safeParse({ ...input, selection: { kind: 'all_filtered', roles: [], customerUserIds: [customerId] } }).success).toBe(false)
  })

  it('leaves empty and oversize selection to service domain errors without truncating', () => {
    expect(prepareBatchSchema.parse({ ...input, selection: { kind: 'explicit', roles: [], customerUserIds: [] } }).selection)
      .toEqual({ kind: 'explicit', roles: [], customerUserIds: [] })
    const ids = Array.from({ length: 1001 }, (_, index) => `dddddddd-dddd-4ddd-8ddd-${index.toString(16).padStart(12, '0')}`)
    const parsed = prepareBatchSchema.parse({ ...input, selection: { kind: 'explicit', roles: [], customerUserIds: ids } })
    expect(parsed.selection.kind === 'explicit' && parsed.selection.customerUserIds.length).toBe(1001)
  })

  it('rejects invalid recipient IDs and participation roles', () => {
    expect(prepareBatchSchema.safeParse({ ...input, selection: { kind: 'explicit', roles: [], customerUserIds: ['invalid'] } }).success).toBe(false)
    expect(recipientsQuerySchema.safeParse({ competitionId, roles: ['admin'] }).success).toBe(false)
  })

  it('uses bounded pagination defaults and requires competition scope', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 25 })
    expect(paginationSchema.parse({ page: '2', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 })
    expect(recipientsQuerySchema.safeParse({}).success).toBe(false)
    expect(recipientsQuerySchema.parse({ competitionId }).roles).toEqual([])
  })

  it.each([0, -1, 1.2, '', '1e2', true, null, '9007199254740992'])('rejects invalid page %p', (page) => {
    expect(paginationSchema.safeParse({ page }).success).toBe(false)
  })

  it('rejects excessive page size and replacement confirmation payloads', () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(emptyMutationSchema.parse({})).toEqual({})
    expect(emptyMutationSchema.safeParse({ selection: input.selection }).success).toBe(false)
  })
})
