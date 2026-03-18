import { ScoringService } from '../ScoringService'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockEMForComputeScore(
  criterionScores: Array<{ score: number; weight: number; max_score: number }>,
) {
  const updateCalls: Array<{ data: Record<string, unknown> }> = []

  const mockKnex: any = (tableName: string) => {
    // Build a chainable that resolves to the right data on `await`
    const makeChain = (resolveValue: unknown): any => {
      const chain: any = {}
      const methods = ['join', 'where', 'whereNull', 'whereNotNull', 'select', 'groupBy', 'orderBy']
      methods.forEach((m) => { chain[m] = (..._args: unknown[]) => chain })
      chain.update = async (data: Record<string, unknown>) => {
        updateCalls.push({ data })
        return 1
      }
      chain.then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
        resolve(resolveValue)
        return Promise.resolve()
      }
      return chain
    }

    if (tableName === 'judging_criterion_score as cs') {
      return makeChain(criterionScores)
    }
    if (tableName === 'judging_project_score') {
      return makeChain(1) // for update
    }
    return makeChain([])
  }

  mockKnex.raw = (expr: string) => expr

  return {
    em: { getKnex: () => mockKnex } as any,
    updateCalls,
  }
}

function createMockEMForLeaderboard(
  leaderboardRows: Array<{
    project_id: string
    team_id: string
    track_id: string
    title: string
    avg_score: number
    score_count: number
  }>,
) {
  const mockKnex: any = (tableName: string) => {
    const makeChain = (resolveValue: unknown): any => {
      const chain: any = {}
      const methods = ['join', 'where', 'whereNull', 'whereNotNull', 'select', 'groupBy', 'orderBy']
      methods.forEach((m) => { chain[m] = (..._args: unknown[]) => chain })
      chain.then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
        resolve(resolveValue)
        return Promise.resolve()
      }
      return chain
    }

    if (tableName === 'judging_project_score as ps') {
      return makeChain(leaderboardRows)
    }
    return makeChain([])
  }

  mockKnex.raw = (expr: string) => expr

  return {
    em: { getKnex: () => mockKnex } as any,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoringService', () => {
  describe('computeProjectScore', () => {
    it('returns null when no criterion scores exist', async () => {
      const { em } = createMockEMForComputeScore([])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')
      expect(result).toBeNull()
    })

    it('computes weighted average correctly for single criterion', async () => {
      const { em, updateCalls } = createMockEMForComputeScore([
        { score: 8, weight: 1, max_score: 10 },
      ])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')

      // (8/10) * 1 = 0.8 -> 0.8 * 10000 / 100 = 80
      expect(result).toBe(80)
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0].data.total_score).toBe(80)
    })

    it('computes weighted average correctly for multiple criteria', async () => {
      const { em } = createMockEMForComputeScore([
        { score: 8, weight: 2, max_score: 10 }, // (8/10)*2 = 1.6
        { score: 6, weight: 1, max_score: 10 }, // (6/10)*1 = 0.6
        { score: 5, weight: 1, max_score: 5 },  // (5/5)*1  = 1.0
      ])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')

      // Total: 1.6 + 0.6 + 1.0 = 3.2 -> 3.2 * 10000 / 100 = 320
      expect(result).toBe(320)
    })

    it('handles max_score of 0 gracefully (defaults to 10)', async () => {
      const { em } = createMockEMForComputeScore([
        { score: 5, weight: 1, max_score: 0 },
      ])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')

      // max_score = 0, so default to 10: (5/10)*1 = 0.5 -> 50
      expect(result).toBe(50)
    })

    it('computes perfect score correctly', async () => {
      const { em } = createMockEMForComputeScore([
        { score: 10, weight: 1, max_score: 10 },
        { score: 5, weight: 1, max_score: 5 },
      ])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')

      // (10/10)*1 + (5/5)*1 = 2.0 -> 200
      expect(result).toBe(200)
    })

    it('computes zero score correctly', async () => {
      const { em } = createMockEMForComputeScore([
        { score: 0, weight: 1, max_score: 10 },
        { score: 0, weight: 2, max_score: 5 },
      ])
      const service = new ScoringService(em)
      const result = await service.computeProjectScore('score-1')

      expect(result).toBe(0)
    })
  })

  describe('computeLeaderboard', () => {
    it('returns entries sorted by average score descending', async () => {
      const leaderboardRows = [
        { project_id: 'p1', team_id: 't1', track_id: 'tr1', title: 'Project Alpha', avg_score: 95.5, score_count: 3 },
        { project_id: 'p2', team_id: 't2', track_id: 'tr1', title: 'Project Beta', avg_score: 88.0, score_count: 3 },
        { project_id: 'p3', team_id: 't3', track_id: 'tr2', title: 'Project Gamma', avg_score: 72.3, score_count: 2 },
      ]
      const { em } = createMockEMForLeaderboard(leaderboardRows)
      const service = new ScoringService(em)
      const result = await service.computeLeaderboard('comp-1')

      expect(result).toHaveLength(3)
      expect(result[0].rank).toBe(1)
      expect(result[0].projectId).toBe('p1')
      expect(result[0].avgScore).toBe(95.5)
      expect(result[1].rank).toBe(2)
      expect(result[1].projectId).toBe('p2')
      expect(result[2].rank).toBe(3)
      expect(result[2].projectId).toBe('p3')
    })

    it('returns empty array when no scored projects exist', async () => {
      const { em } = createMockEMForLeaderboard([])
      const service = new ScoringService(em)
      const result = await service.computeLeaderboard('comp-1')

      expect(result).toEqual([])
    })

    it('assigns ranks sequentially starting from 1', async () => {
      const leaderboardRows = [
        { project_id: 'p1', team_id: 't1', track_id: 'tr1', title: 'A', avg_score: 50, score_count: 1 },
        { project_id: 'p2', team_id: 't2', track_id: 'tr1', title: 'B', avg_score: 40, score_count: 1 },
      ]
      const { em } = createMockEMForLeaderboard(leaderboardRows)
      const service = new ScoringService(em)
      const result = await service.computeLeaderboard('comp-1')

      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
    })

    it('rounds average scores to two decimal places', async () => {
      const leaderboardRows = [
        { project_id: 'p1', team_id: 't1', track_id: 'tr1', title: 'A', avg_score: 85.456, score_count: 3 },
      ]
      const { em } = createMockEMForLeaderboard(leaderboardRows)
      const service = new ScoringService(em)
      const result = await service.computeLeaderboard('comp-1')

      expect(result[0].avgScore).toBe(85.46)
    })
  })
})
