import { scoresQuerySchema } from '../../data/validators'
import { buildScoreListFilter } from '../scoreQuery'

const COMPETITION = '11111111-1111-4111-8111-111111111111'
const OTHER_COMPETITION = '22222222-2222-4222-8222-222222222222'
const PROJECT = '33333333-3333-4333-8333-333333333333'
const JUDGE = '44444444-4444-4444-8444-444444444444'
const TENANT = '55555555-5555-4555-8555-555555555555'
const ORG = '66666666-6666-4666-8666-666666666666'

const scope = { tenantId: TENANT, organizationId: ORG }

describe('scoresQuerySchema', () => {
  it('requires competition_id', () => {
    // The back-office tab used to call `/api/judging/scores` with no parameters at all, and the
    // route answered with the 200 most recent scores of every competition in the tenant.
    const result = scoresQuerySchema.safeParse({ project_id: null, judge_id: null, round: null })
    expect(result.success).toBe(false)
  })

  it('rejects a competition_id that is not a uuid', () => {
    const result = scoresQuerySchema.safeParse({ competition_id: 'all' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('competition_id must be a valid UUID')
    }
  })

  it('accepts a competition id on its own', () => {
    const result = scoresQuerySchema.safeParse({
      competition_id: COMPETITION, project_id: null, judge_id: null, round: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown round', () => {
    expect(scoresQuerySchema.safeParse({ competition_id: COMPETITION, round: 'both' }).success).toBe(false)
  })
})

describe('buildScoreListFilter', () => {
  it('always scopes by competition, tenant and organisation', () => {
    const filter = buildScoreListFilter(
      { competition_id: COMPETITION, project_id: null, judge_id: null, round: null },
      scope,
    )
    expect(filter).toEqual({
      competitionId: COMPETITION,
      tenantId: TENANT,
      organizationId: ORG,
    })
  })

  it('cannot be talked out of its scope by the optional filters', () => {
    const filter = buildScoreListFilter(
      { competition_id: COMPETITION, project_id: PROJECT, judge_id: JUDGE, round: 'final' },
      scope,
    )
    expect(filter.competitionId).toBe(COMPETITION)
    expect(filter.tenantId).toBe(TENANT)
    expect(filter.organizationId).toBe(ORG)
    expect(filter.projectId).toBe(PROJECT)
    expect(filter.judgeId).toBe(JUDGE)
    expect(filter.round).toBe('final')
    expect(filter.competitionId).not.toBe(OTHER_COMPETITION)
  })

  it('omits optional filters that were not supplied', () => {
    const filter = buildScoreListFilter(
      { competition_id: COMPETITION, project_id: null, judge_id: undefined, round: null },
      scope,
    )
    expect(Object.keys(filter).sort()).toEqual(['competitionId', 'organizationId', 'tenantId'])
  })
})
