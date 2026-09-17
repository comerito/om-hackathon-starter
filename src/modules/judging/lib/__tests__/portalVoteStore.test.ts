import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler,
  type CompiledQuery, type DatabaseConnection, type Driver, type QueryResult,
} from 'kysely'
import { ProjectScore } from '../../data/entities'
import { Competition } from '../../../competitions/data/entities'
import { createPortalVoteStore, PORTAL_VOTE_FLUSH_LABEL } from '../portalVoteStore'

/**
 * SPEC-007 step 7: the MikroORM 7 adapter behind the vote write. The SQL is compiled by Kysely's
 * real Postgres compiler against a recording driver, so the `ON CONFLICT` clauses asserted here
 * are the statements that reach the database.
 */

type Recorded = { sql: string; parameters: ReadonlyArray<unknown> }

function recordingKysely(rowsFor: (sql: string) => unknown[] = () => []) {
  const queries: Recorded[] = []
  const connection: DatabaseConnection = {
    async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
      queries.push({ sql: compiled.sql, parameters: compiled.parameters })
      return { rows: rowsFor(compiled.sql) as R[] }
    },
    // eslint-disable-next-line require-yield
    async *streamQuery() { throw new Error('not supported') },
  }
  const driver: Driver = {
    async init() {},
    async acquireConnection() { return connection },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  }
  const db = new Kysely<Record<string, never>>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  })
  return { db, queries }
}

function fakeEm(db: Kysely<Record<string, never>>) {
  const order: string[] = []
  const em = {
    getKysely: jest.fn(() => db),
    findOne: jest.fn(async () => null as unknown),
    flush: jest.fn(async () => { order.push('flush') }),
    begin: jest.fn(async () => { order.push('begin') }),
    commit: jest.fn(async () => { order.push('commit') }),
    rollback: jest.fn(async () => { order.push('rollback') }),
    isInTransaction: jest.fn(() => false),
    clear: jest.fn(),
  }
  return { em, order, asEm: em as unknown as EntityManager }
}

const SCOPE = { tenantId: 't1', organizationId: 'o1', now: new Date('2026-09-17T10:00:00Z') }

describe('createPortalVoteStore — transaction', () => {
  it('runs the phases in one transaction with a flush after each phase', async () => {
    const { db } = recordingKysely()
    const { asEm, order } = fakeEm(db)
    const store = createPortalVoteStore(asEm)
    await store.atomic([
      async () => { order.push('phase1') },
      async () => { order.push('phase2') },
    ])
    expect(order).toEqual(['begin', 'phase1', 'flush', 'phase2', 'flush', 'commit'])
    expect(PORTAL_VOTE_FLUSH_LABEL).toBe('judging.portal.score')
  })

  it('rolls back when a phase throws', async () => {
    const { db } = recordingKysely()
    const { asEm, order } = fakeEm(db)
    const store = createPortalVoteStore(asEm)
    await expect(store.atomic([async () => { throw new Error('closed') }])).rejects.toThrow('closed')
    expect(order).toEqual(['begin', 'rollback'])
  })

  it('locks the score row with SELECT … FOR UPDATE and a refresh from the database', async () => {
    const { db } = recordingKysely()
    const { em, asEm } = fakeEm(db)
    const store = createPortalVoteStore(asEm)
    await store.lockScore({ projectId: 'p1', judgeId: 'j1', round: 'preliminary', tenantId: 't1', organizationId: 'o1' })
    expect(em.findOne).toHaveBeenCalledWith(
      ProjectScore,
      { projectId: 'p1', judgeId: 'j1', round: 'preliminary', tenantId: 't1', organizationId: 'o1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    )
  })

  it('re-reads the competition stage bypassing the identity map, tenant-scoped', async () => {
    const { db } = recordingKysely()
    const { em, asEm } = fakeEm(db)
    em.findOne.mockResolvedValueOnce({ stage: 'finished' })
    const store = createPortalVoteStore(asEm)
    await expect(store.readCompetitionStage('comp', SCOPE)).resolves.toBe('finished')
    expect(em.findOne).toHaveBeenCalledWith(
      Competition,
      { id: 'comp', tenantId: 't1', organizationId: 'o1', deletedAt: null },
      { refresh: true },
    )
  })
})

describe('createPortalVoteStore — SQL', () => {
  it('inserts the score shell with ON CONFLICT (project_id, judge_id, round) DO NOTHING', async () => {
    const { db, queries } = recordingKysely()
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await store.insertScoreShellIfMissing({
      projectId: 'p1', judgeId: 'j1', round: 'preliminary', tenantId: 't1', organizationId: 'o1',
      competitionId: 'comp', judgePanelId: 'panel', now: SCOPE.now,
    })
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toMatch(/^insert into "judging_project_score"/)
    expect(queries[0].sql).toContain('on conflict ("project_id", "judge_id", "round") do nothing')
    expect(queries[0].parameters).toEqual(expect.arrayContaining(['p1', 'j1', 'panel', 'comp', 't1', 'o1', false]))
  })

  it('writes stars without touching an existing note when no note is sent', async () => {
    const { db, queries } = recordingKysely()
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await store.upsertCriterionScores('s1', [{ criterionId: 'c1', stars: 7 }], SCOPE)
    expect(queries).toHaveLength(1)
    const { sql, parameters } = queries[0]
    expect(sql).toMatch(/^insert into "judging_criterion_score"/)
    expect(sql).toContain('on conflict ("project_score_id", "criterion_id") do update set '
      + '"score" = "excluded"."score", "scale" = "excluded"."scale", "updated_at" = "excluded"."updated_at"')
    expect(sql).not.toContain('"note" = "excluded"."note"')
    expect(parameters).toEqual(expect.arrayContaining(['s1', 'c1', 7, 10]))
  })

  it('writes stars and note together when both are sent, clearing a note sent as null', async () => {
    const { db, queries } = recordingKysely()
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await store.upsertCriterionScores('s1', [{ criterionId: 'c1', stars: 4, note: null }], SCOPE)
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toContain('"note" = "excluded"."note"')
    expect(queries[0].sql).toContain('"score" = "excluded"."score"')
  })

  it('saves a note alone as an unrated placeholder that never overwrites a rating', async () => {
    const { db, queries } = recordingKysely()
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await store.upsertCriterionScores('s1', [{ criterionId: 'c1', note: 'Great UX' }], SCOPE)
    expect(queries).toHaveLength(1)
    const { sql, parameters } = queries[0]
    expect(sql).toContain('do update set "note" = "excluded"."note", "updated_at" = "excluded"."updated_at"')
    expect(sql).not.toContain('"score" = "excluded"."score"')
    expect(parameters).toEqual(expect.arrayContaining(['c1', 0, 10, 'Great UX']))
  })

  it('issues one statement per write kind and none for an empty list', async () => {
    const { db, queries } = recordingKysely()
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await store.upsertCriterionScores('s1', [], SCOPE)
    expect(queries).toHaveLength(0)
    await store.upsertCriterionScores('s1', [
      { criterionId: 'c1', stars: 7 },
      { criterionId: 'c2', stars: 3 },
      { criterionId: 'c3', note: 'n' },
      { criterionId: 'c4', stars: 9, note: 'm' },
    ], SCOPE)
    expect(queries).toHaveLength(3)
  })

  it('loads every criterion row of the score, keeping legacy rows as scale null', async () => {
    const { db, queries } = recordingKysely(() => [
      { criterion_id: 'c1', score: 7, scale: 10 },
      { criterion_id: 'c2', score: '3', scale: null },
    ])
    const store = createPortalVoteStore(fakeEm(db).asEm)
    await expect(store.loadRatings('s1')).resolves.toEqual([
      { criterionId: 'c1', score: 7, scale: 10 },
      { criterionId: 'c2', score: 3, scale: null },
    ])
    expect(queries[0].sql).toBe(
      'select "criterion_id", "score", "scale" from "judging_criterion_score" where "project_score_id" = $1',
    )
  })

  it('patches the managed record in place and clears the identity map on reset', () => {
    const { db } = recordingKysely()
    const { em, asEm } = fakeEm(db)
    const store = createPortalVoteStore(asEm)
    const record = { id: 's1', conflictOfInterest: false, isSubmitted: false, updatedAt: SCOPE.now }
    store.patchScore(record, { conflictOfInterest: true })
    expect(record.conflictOfInterest).toBe(true)
    store.reset()
    expect(em.clear).toHaveBeenCalled()
  })
})
