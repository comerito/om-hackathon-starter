/**
 * Payload-contract tests for the `competitions.competition.stage_advanced` subscriber.
 *
 * The defect: both emitters (the advance-stage API route and the
 * `competitions.competitions.advance_stage` command) send
 * `{ competitionId, oldStage, newStage, ... }`, but this subscriber read `payload.id` and
 * `payload.stage`. `em.findOne(Competition, { id: undefined })` never resolved the
 * competition, so the handler returned early and participants were never notified — silently,
 * because a key mismatch is not a type error across an event bus and nothing throws.
 *
 * These tests drive the exported handler with the payload the emitters actually produce and
 * assert on the notification a participant would receive. Reverting the subscriber to
 * `payload.id` / `payload.stage` makes them fail.
 */

const mockResolveNotificationService = jest.fn()

jest.mock(
  '@open-mercato/core/modules/notifications/lib/notificationService',
  () => ({ resolveNotificationService: (...args: unknown[]) => mockResolveNotificationService(...args) }),
  { virtual: true },
)
jest.mock(
  '../../data/entities',
  () => ({ Competition: class Competition {}, CompetitionParticipation: class CompetitionParticipation {} }),
  { virtual: true },
)

import handler from '../notify-stage-advanced'
import { Competition, CompetitionParticipation } from '../../data/entities'

/** Exactly what both emitters put on the bus. */
const PAYLOAD = {
  competitionId: 'comp-1',
  oldStage: 'open',
  newStage: 'team_formation',
  advancedBy: 'user-9',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
}

function setup() {
  const createBatch = jest.fn(async () => undefined)
  // The fakes honour the `where` they are given, so asking for the wrong key finds
  // nothing — the same silent early return the real EntityManager produced.
  const findOne = jest.fn(async (_entity: unknown, where: Record<string, unknown>) =>
    where?.id === 'comp-1' ? { name: 'Hack the Planet', stage: 'team_formation' } : null,
  )
  const find = jest.fn(async (_entity: unknown, where: Record<string, unknown>) =>
    where?.competitionId === 'comp-1'
      ? [{ customerUserId: 'cu-1' }, { customerUserId: 'cu-2' }]
      : [],
  )
  const em = { findOne, find }
  const ctx = { resolve: (name: string) => (name === 'em' ? em : undefined) }
  mockResolveNotificationService.mockReturnValue({ createBatch })
  return { ctx: ctx as never, findOne, find, createBatch }
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('looks the competition up by the `competitionId` the emitters send', async () => {
  const { ctx, findOne } = setup()

  await handler(PAYLOAD, ctx)

  expect(findOne).toHaveBeenCalledTimes(1)
  const [entity, where] = findOne.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
  expect(entity).toBe(Competition)
  expect(where.id).toBe('comp-1')
  // The old code passed `payload.id` — undefined. Pin that it never happens again.
  expect(where.id).toBeDefined()
  expect(where.tenantId).toBe('tenant-1')
})

test('notifies every participant, titled with the stage from `newStage`', async () => {
  const { ctx, find, createBatch } = setup()

  await handler(PAYLOAD, ctx)

  const [participationEntity, participationWhere] = find.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
  expect(participationEntity).toBe(CompetitionParticipation)
  expect(participationWhere.competitionId).toBe('comp-1')

  expect(createBatch).toHaveBeenCalledTimes(1)
  const [notification, scope] = createBatch.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>]
  expect(notification.recipientUserIds).toEqual(['cu-1', 'cu-2'])
  expect(notification.title).toBe('Hack the Planet moved to Team Formation')
  expect(notification.titleVariables).toEqual({ competition: 'Hack the Planet', stage: 'Team Formation' })
  expect(notification.sourceEntityId).toBe('comp-1')
  expect(notification.groupKey).toBe('stage-comp-1')
  expect(scope).toEqual({ tenantId: 'tenant-1', organizationId: 'org-1' })
})

test('falls back to the stored stage when the payload omits `newStage`', async () => {
  const { ctx, createBatch } = setup()

  const { newStage, ...withoutStage } = PAYLOAD
  void newStage
  await handler(withoutStage as typeof PAYLOAD, ctx)

  const [notification] = createBatch.mock.calls[0] as unknown as [Record<string, unknown>]
  expect(notification.title).toBe('Hack the Planet moved to Team Formation')
})

test('does not notify when the competition is gone', async () => {
  const { ctx, findOne, createBatch } = setup()
  findOne.mockResolvedValue(null as never)

  await handler(PAYLOAD, ctx)

  expect(createBatch).not.toHaveBeenCalled()
})

test('does not notify when the competition has no participants', async () => {
  const { ctx, find, createBatch } = setup()
  find.mockResolvedValue([] as never)

  await handler(PAYLOAD, ctx)

  expect(createBatch).not.toHaveBeenCalled()
})
