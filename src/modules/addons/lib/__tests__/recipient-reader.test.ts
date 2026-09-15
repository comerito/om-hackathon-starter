import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { createAddonRecipientReader } from '../recipient-reader'

jest.mock('@open-mercato/core/modules/customer_accounts/data/entities', () => ({ CustomerUser: class CustomerUser {} }))
jest.mock('@open-mercato/shared/lib/encryption/find', () => ({ findWithDecryption: jest.fn() }))
const scope = { tenantId: '10000000-0000-4000-8000-000000000001', organizationId: '20000000-0000-4000-8000-000000000001' }
const competitionId = '30000000-0000-4000-8000-000000000001'
const customerId = '40000000-0000-4000-8000-000000000001'
const reader = createAddonRecipientReader()
function manager() {
  const execute = jest.fn().mockResolvedValue([])
  const getTransactionContext = jest.fn().mockReturnValue({})
  return { execute, getTransactionContext, em: { execute, getTransactionContext } as unknown as EntityManager }
}

beforeEach(() => jest.clearAllMocks())

test('empty frozen sets never produce invalid SQL or fetch account data', async () => {
  const { em, execute } = manager()
  expect(await reader.eligible(em, scope, competitionId, [], { customerUserIds: [] })).toEqual({ items: [], totalCount: 0 })
  expect(await reader.display(em, scope, [])).toEqual(new Map())
  expect(execute).not.toHaveBeenCalled()
  expect(findWithDecryption).not.toHaveBeenCalled()
})

test('eligible query constrains both join scopes, active states, roles and competition and paginates in SQL', async () => {
  const { em, execute } = manager()
  execute.mockResolvedValueOnce([{ totalCount: '120' }]).mockResolvedValueOnce([{ customerUserId: customerId, role: 'mentor' }])
  expect(await reader.eligible(em, scope, competitionId, ['participant', 'mentor'], { limit: 25, offset: 100 })).toEqual({ items: [{ customerUserId: customerId, role: 'mentor' }], totalCount: 120 })
  const [sql, params] = execute.mock.calls[1]
  for (const fragment of ['c.tenant_id = p.tenant_id', 'c.organization_id = p.organization_id', 'u.tenant_id = p.tenant_id', 'u.organization_id = p.organization_id', 'p.deleted_at is null', 'c.is_active = true', 'c.deleted_at is null', 'u.is_active = true', 'u.deleted_at is null', 'group by p.customer_user_id order by role, p.customer_user_id limit ? offset ?']) expect(sql).toContain(fragment)
  expect(params).toEqual([scope.tenantId, scope.organizationId, competitionId, ['mentor', 'participant'], 25, 100])
  expect(execute.mock.calls[0][0]).toContain('count(distinct p.customer_user_id)')
  expect(sql).not.toMatch(/email|display_name/)
})

test('empty roles means all valid roles and explicit ids are deduplicated', async () => {
  const { em, execute } = manager()
  await reader.eligible(em, scope, competitionId, [], { customerUserIds: [customerId, customerId] })
  expect(execute.mock.calls[0][1]).toEqual([scope.tenantId, scope.organizationId, competitionId, ['judge', 'mentor', 'participant'], [customerId]])
})

test('competition selector supports later pages and filters exact scope', async () => {
  const { em, execute } = manager()
  execute.mockResolvedValueOnce([{ totalCount: '150' }]).mockResolvedValueOnce([{ id: competitionId, name: 'Competition' }])
  expect(await reader.competitions(em, scope, { page: 6, pageSize: 25 })).toMatchObject({ totalCount: 150, page: 6, pageSize: 25 })
  expect(execute.mock.calls[1][1]).toEqual([scope.tenantId, scope.organizationId, 25, 125])
  expect(execute.mock.calls[1][0]).toContain('order by name, id limit ? offset ?')
})

test('lock path locks invalidated rows in fixed order then rechecks eligible state', async () => {
  const { em, execute } = manager()
  execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: competitionId, name: 'Competition' }])
  await reader.eligible(em, scope, competitionId, ['mentor'], { customerUserIds: [customerId], lock: true })
  expect(execute.mock.calls[0][0]).toContain('competitions_competition')
  expect(execute.mock.calls[0][0]).toContain('for update')
  expect(execute.mock.calls[0][0]).not.toContain('is_active')
  expect(execute.mock.calls[1][0]).toContain('is_active = true')
  expect(execute.mock.calls[2][0]).toContain('competitions_participation')
  expect(execute.mock.calls[2][0]).toContain('order by id for update')
  expect(execute.mock.calls[2][0]).not.toContain('deleted_at')
  expect(execute.mock.calls[3][0]).toContain('customer_users')
  expect(execute.mock.calls[3][0]).toContain('order by id for update')
  expect(execute.mock.calls[3][0]).not.toContain('is_active')
  expect(execute.mock.calls[4][0]).toContain('u.is_active = true')
})

test('inactive competition prevents further locks', async () => {
  const { em, execute } = manager()
  expect(await reader.eligible(em, scope, competitionId, [], { lock: true, customerUserIds: [customerId] })).toEqual({ items: [], totalCount: 0 })
  expect(execute).toHaveBeenCalledTimes(2)
})

test('lock requests require transaction and bounded frozen membership', async () => {
  const { em, execute, getTransactionContext } = manager()
  await expect(reader.eligible(em, scope, competitionId, [], { lock: true })).rejects.toThrow('addons_frozen_selection_required')
  getTransactionContext.mockReturnValue(undefined)
  await expect(reader.eligible(em, scope, competitionId, [], { lock: true, customerUserIds: [customerId] })).rejects.toThrow('addons_transaction_required')
  expect(execute).not.toHaveBeenCalled()
})

test('invalid scope, roles and page bounds are rejected before SQL', async () => {
  const { em, execute } = manager()
  await expect(reader.competition(em, { ...scope, organizationId: '' }, competitionId)).rejects.toThrow()
  await expect(reader.eligible(em, scope, competitionId, ['admin'])).rejects.toThrow()
  await expect(reader.eligible(em, scope, competitionId, [], { limit: 1002 })).rejects.toThrow()
  await expect(reader.eligible(em, scope, competitionId, [], { offset: -1 })).rejects.toThrow()
  await expect(reader.competitions(em, scope, { page: 1, pageSize: 101 })).rejects.toThrow()
  await expect(reader.competitions(em, scope, { page: Number.MAX_SAFE_INTEGER, pageSize: 100 })).rejects.toThrow()
  expect(execute).not.toHaveBeenCalled()
})

test('display resolves only scoped undeleted IDs through encryption helper', async () => {
  const { em } = manager()
  jest.mocked(findWithDecryption).mockResolvedValue([{ id: customerId, displayName: 'Name', email: 'safe@example.test' }])
  expect(await reader.display(em, scope, [customerId])).toEqual(new Map([[customerId, { displayName: 'Name', email: 'safe@example.test' }]]))
  expect(findWithDecryption).toHaveBeenCalledWith(em, expect.any(Function), { ...scope, id: { $in: [customerId] }, deletedAt: null }, { fields: ['id', 'displayName', 'email', 'tenantId', 'organizationId'] }, scope)
})
