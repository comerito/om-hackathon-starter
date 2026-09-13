import type { EntityManager } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../../competitions/data/entities'
import { findEligibleJudgeIds, isEligibleJudge } from './judgeEligibility'

type Call = { entity: unknown; where: Record<string, unknown> }

function fakeEm(rows: Array<Partial<CompetitionParticipation>>, calls: Call[]): EntityManager {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value)
  return {
    async find(entity: unknown, where: Record<string, unknown>) {
      calls.push({ entity, where })
      return rows.filter((row) => matches(row as Record<string, unknown>, where))
    },
    async findOne(entity: unknown, where: Record<string, unknown>) {
      calls.push({ entity, where })
      return rows.find((row) => matches(row as Record<string, unknown>, where)) ?? null
    },
  } as unknown as EntityManager
}

const SCOPE = { competitionId: 'comp-1', tenantId: 'tenant-1' }

const ROWS: Array<Partial<CompetitionParticipation>> = [
  { customerUserId: 'judge-a', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'judge', deletedAt: null },
  { customerUserId: 'judge-b', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'judge', deletedAt: null },
  // Same competition, wrong role — a mentor and a plain participant must not be assignable.
  { customerUserId: 'mentor-a', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'mentor', deletedAt: null },
  { customerUserId: 'player-a', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'participant', deletedAt: null },
  // Judge of a DIFFERENT competition — must not be assignable to comp-1's panels.
  { customerUserId: 'judge-other', competitionId: 'comp-2', tenantId: 'tenant-1', role: 'judge', deletedAt: null },
  // Judge in another tenant.
  { customerUserId: 'judge-x', competitionId: 'comp-1', tenantId: 'tenant-2', role: 'judge', deletedAt: null },
  // Removed roster row.
  { customerUserId: 'judge-gone', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'judge', deletedAt: new Date() },
]

describe('judgeEligibility', () => {
  it('lists only judges of the given competition and tenant', async () => {
    const calls: Call[] = []
    const ids = await findEligibleJudgeIds(fakeEm(ROWS, calls), SCOPE)
    expect(ids).toEqual(['judge-a', 'judge-b'])
    expect(calls[0].entity).toBe(CompetitionParticipation)
  })

  it('de-duplicates repeated roster rows', async () => {
    const dupes: Array<Partial<CompetitionParticipation>> = [
      ...ROWS,
      { customerUserId: 'judge-a', competitionId: 'comp-1', tenantId: 'tenant-1', role: 'judge', deletedAt: null },
    ]
    const ids = await findEligibleJudgeIds(fakeEm(dupes, []), SCOPE)
    expect(ids).toEqual(['judge-a', 'judge-b'])
  })

  it.each([
    ['judge-a', true],
    ['judge-b', true],
    ['mentor-a', false],
    ['player-a', false],
    ['judge-other', false],
    ['judge-x', false],
    ['judge-gone', false],
    ['nobody', false],
  ])('isEligibleJudge(%s) === %s', async (userId, expected) => {
    expect(await isEligibleJudge(fakeEm(ROWS, []), userId as string, SCOPE)).toBe(expected)
  })
})
