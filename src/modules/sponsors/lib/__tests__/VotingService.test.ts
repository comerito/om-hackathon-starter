import { VotingService } from '../VotingService'

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

interface MockDBState {
  competition?: {
    stage: string
    peer_voting_config: Record<string, unknown>
  } | null
  project?: {
    team_id: string
  } | null
  teamLeaderId?: string
  acceptedInvitation?: boolean
  currentVoteCount?: number
  existingVote?: boolean
}

function createMockEM(state: MockDBState = {}) {
  const {
    competition = { stage: 'DEMOS', peer_voting_config: { maxVotesPerParticipant: 3 } },
    project = { team_id: 'team-1' },
    teamLeaderId = 'leader-1',
    acceptedInvitation = false,
    currentVoteCount = 0,
    existingVote = false,
  } = state

  const deletedRows: Array<Record<string, unknown>> = []

  const mockKnex: any = (tableName: string) => {
    const chain: any = {
      _table: tableName,
      _wheres: {} as Record<string, unknown>,

      where(clause: unknown, val?: unknown) {
        if (typeof clause === 'string' && val !== undefined) {
          chain._wheres[clause] = val
        } else if (typeof clause === 'object' && clause !== null) {
          Object.assign(chain._wheres, clause)
        }
        return chain
      },

      select(..._args: unknown[]) { return chain },
      count(_expr: string) { return chain },
      countDistinct(_expr: string) { return chain },

      first() {
        if (tableName === 'competitions_competition') {
          return Promise.resolve(competition ?? undefined)
        }
        if (tableName === 'projects_project') {
          return Promise.resolve(project ?? undefined)
        }
        if (tableName === 'teams_invitation') {
          return Promise.resolve(acceptedInvitation ? { id: 'inv-1' } : undefined)
        }
        if (tableName === 'teams_team') {
          return Promise.resolve({ leader_id: teamLeaderId })
        }
        if (tableName === 'sponsors_peer_vote') {
          if (chain._wheres.project_id) {
            // Duplicate vote check
            return Promise.resolve(existingVote ? { id: 'vote-1' } : undefined)
          }
          // Vote count
          return Promise.resolve({ count: currentVoteCount })
        }
        return Promise.resolve(undefined)
      },

      async delete() {
        deletedRows.push({ table: tableName, where: { ...chain._wheres } })
        return existingVote ? 1 : 0
      },

      increment(_col: string, _val: number) {
        return Promise.resolve(1)
      },

      decrement(_col: string, _val: number) {
        return Promise.resolve(1)
      },

      insert(_data: Record<string, unknown>) {
        return { returning: () => Promise.resolve([{ id: 'new-vote-1' }]) }
      },
    }

    return chain
  }

  // Transaction mock
  mockKnex.transaction = async (fn: (trx: any) => Promise<unknown>) => {
    const trx = mockKnex
    trx.raw = () => Promise.resolve()
    return fn(trx)
  }

  return {
    em: { getKnex: () => mockKnex } as any,
    deletedRows,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VotingService', () => {
  describe('canCastVote', () => {
    it('allows a valid vote', async () => {
      const { em } = createMockEM({
        competition: { stage: 'DEMOS', peer_voting_config: { maxVotesPerParticipant: 3 } },
        project: { team_id: 'team-1' },
        teamLeaderId: 'leader-1',
        acceptedInvitation: false,
        currentVoteCount: 0,
        existingVote: false,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('rejects when competition not found', async () => {
      const { em } = createMockEM({ competition: null })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Competition not found')
    })

    it('rejects when voting is not open (wrong stage)', async () => {
      const { em } = createMockEM({
        competition: { stage: 'HACKING', peer_voting_config: { maxVotesPerParticipant: 3 } },
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Voting is not open at this stage')
    })

    it('allows voting during DELIBERATION stage', async () => {
      const { em } = createMockEM({
        competition: { stage: 'DELIBERATION', peer_voting_config: { maxVotesPerParticipant: 3 } },
        currentVoteCount: 0,
        existingVote: false,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(true)
    })

    it('rejects self-vote when voter is team member (accepted invitation)', async () => {
      const { em } = createMockEM({
        acceptedInvitation: true,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('You cannot vote for your own project')
    })

    it('rejects self-vote when voter is team leader', async () => {
      const { em } = createMockEM({
        teamLeaderId: 'voter-1',
        acceptedInvitation: false,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('You cannot vote for your own project')
    })

    it('rejects when vote limit reached', async () => {
      const { em } = createMockEM({
        currentVoteCount: 3,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('already used all 3 votes')
    })

    it('rejects duplicate vote for same project', async () => {
      const { em } = createMockEM({
        existingVote: true,
        currentVoteCount: 1,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('You have already voted for this project')
    })

    it('rejects when project not found', async () => {
      const { em } = createMockEM({
        project: null,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Project not found')
    })

    it('uses custom maxVotesPerParticipant from config', async () => {
      const { em } = createMockEM({
        competition: { stage: 'DEMOS', peer_voting_config: { maxVotesPerParticipant: 5 } },
        currentVoteCount: 4,
        existingVote: false,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      // 4 < 5, so should be allowed
      expect(result.allowed).toBe(true)
    })

    it('enforces default limit of 3 when config is missing', async () => {
      const { em } = createMockEM({
        competition: { stage: 'DEMOS', peer_voting_config: {} },
        currentVoteCount: 3,
      })
      const service = new VotingService(em)
      const result = await service.canCastVote('comp-1', 'voter-1', 'proj-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('3 votes')
    })
  })

  describe('retractVote', () => {
    it('retracts an existing vote', async () => {
      const { em, deletedRows } = createMockEM({
        existingVote: true,
        competition: { stage: 'DEMOS', peer_voting_config: { allowVoteChange: true } },
      })
      const service = new VotingService(em)
      const result = await service.retractVote('comp-1', 'voter-1', 'proj-1')

      expect(result).toBe(true)
      expect(deletedRows).toHaveLength(1)
    })

    it('returns false when vote does not exist', async () => {
      const { em } = createMockEM({
        existingVote: false,
        competition: { stage: 'DEMOS', peer_voting_config: {} },
      })
      const service = new VotingService(em)
      const result = await service.retractVote('comp-1', 'voter-1', 'proj-1')

      expect(result).toBe(false)
    })

    it('throws when voting is not open', async () => {
      const { em } = createMockEM({
        competition: { stage: 'FINISHED', peer_voting_config: {} },
      })
      const service = new VotingService(em)

      await expect(service.retractVote('comp-1', 'voter-1', 'proj-1')).rejects.toThrow(
        'Voting is not open at this stage',
      )
    })

    it('throws when vote changes are not allowed', async () => {
      const { em } = createMockEM({
        competition: { stage: 'DEMOS', peer_voting_config: { allowVoteChange: false } },
      })
      const service = new VotingService(em)

      await expect(service.retractVote('comp-1', 'voter-1', 'proj-1')).rejects.toThrow(
        'Vote changes are not allowed in this competition',
      )
    })

    it('returns false when competition not found', async () => {
      const { em } = createMockEM({
        competition: null,
      })
      const service = new VotingService(em)
      const result = await service.retractVote('comp-1', 'voter-1', 'proj-1')

      expect(result).toBe(false)
    })
  })
})
