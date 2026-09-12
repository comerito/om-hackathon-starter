import {
  activeTeamMemberFilter,
  canInviteToTeam,
  canJoinTeam,
  maxTeamSize,
  meetsMinimumTeamSize,
  minTeamSize,
  remainingTeamCapacity,
} from '../team-size'

// The probe configuration from the issue report.
const limits = { minTeamSize: 2, maxTeamSize: 2 }

describe('limit normalisation', () => {
  it('reads a configured positive limit', () => {
    expect(maxTeamSize(limits)).toBe(2)
    expect(minTeamSize(limits)).toBe(2)
  })

  it('treats zero, negative, null and undefined as "not configured"', () => {
    expect(maxTeamSize({ maxTeamSize: 0 })).toBeNull()
    expect(maxTeamSize({ maxTeamSize: -1 })).toBeNull()
    expect(maxTeamSize({ maxTeamSize: null })).toBeNull()
    expect(maxTeamSize({})).toBeNull()
    expect(minTeamSize({ minTeamSize: 0 })).toBeNull()
  })

  it('floors a non-integer limit rather than rejecting it', () => {
    expect(maxTeamSize({ maxTeamSize: 2.9 })).toBe(2)
  })
})

describe('remainingTeamCapacity', () => {
  it('counts pending invitations as seats already taken', () => {
    expect(remainingTeamCapacity({ maxTeamSize: 5 }, { memberCount: 2, pendingInvitationCount: 2 })).toBe(1)
  })

  it('never goes negative when a team is already over its cap', () => {
    expect(remainingTeamCapacity(limits, { memberCount: 3 })).toBe(0)
  })

  it('is unbounded when no cap is configured', () => {
    expect(remainingTeamCapacity({}, { memberCount: 99 })).toBeNull()
  })
})

describe('canInviteToTeam', () => {
  it('refuses the third invitation to the full Team Aurora from the report', () => {
    const decision = canInviteToTeam(limits, { memberCount: 2, pendingInvitationCount: 0 })

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('full')
    expect(decision.allowed === false && decision.reason).toContain('2 of 2')
  })

  it('refuses when members plus pending invitations already fill the team', () => {
    const decision = canInviteToTeam(limits, { memberCount: 1, pendingInvitationCount: 1 })

    expect(decision.allowed).toBe(false)
    // The owner has an action available, so the message names it.
    expect(decision.allowed === false && decision.reason).toContain('Cancel a pending invitation')
  })

  it('allows an invitation while a seat is genuinely free', () => {
    expect(canInviteToTeam(limits, { memberCount: 1, pendingInvitationCount: 0 })).toEqual({ allowed: true })
    expect(canInviteToTeam({}, { memberCount: 50, pendingInvitationCount: 50 })).toEqual({ allowed: true })
  })
})

describe('canJoinTeam', () => {
  it('refuses the accept that took Team Aurora to three members', () => {
    const decision = canJoinTeam(limits, { memberCount: 2 })

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('maximum size (2 members)')
  })

  it('does not double-count the invitation being accepted', () => {
    // One member, one pending invitation — the one being accepted right now.
    // Counting it would make this accept fail on a two-person team.
    expect(canJoinTeam(limits, { memberCount: 1 })).toEqual({ allowed: true })
  })

  it('allows joining when no cap is configured', () => {
    expect(canJoinTeam({ maxTeamSize: null }, { memberCount: 12 })).toEqual({ allowed: true })
  })
})

describe('meetsMinimumTeamSize', () => {
  it('rejects the one-person Team Solo from the report', () => {
    const decision = meetsMinimumTeamSize(limits, { memberCount: 1 })

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('at least 2')
  })

  it('accepts a team exactly at the minimum, and above it', () => {
    expect(meetsMinimumTeamSize(limits, { memberCount: 2 })).toEqual({ allowed: true })
    expect(meetsMinimumTeamSize(limits, { memberCount: 4 })).toEqual({ allowed: true })
  })

  it('accepts any size when no minimum is configured', () => {
    expect(meetsMinimumTeamSize({ minTeamSize: 0 }, { memberCount: 1 })).toEqual({ allowed: true })
    expect(meetsMinimumTeamSize({}, { memberCount: 0 })).toEqual({ allowed: true })
  })
})

describe('activeTeamMemberFilter', () => {
  const TEAM = '11111111-1111-4111-8111-111111111111'
  const OTHER_TEAM = '22222222-2222-4222-8222-222222222222'
  const TENANT = '33333333-3333-4333-8333-333333333333'
  const OTHER_TENANT = '44444444-4444-4444-8444-444444444444'

  type Row = { teamId: string; tenantId: string; deletedAt: Date | null; leftAt: Date | null }

  /** Stand-in for `em.count(TeamMember, filter)`: MikroORM ANDs the equality terms. */
  const countMatching = (rows: Row[], filter: Record<string, unknown>): number =>
    rows.filter((row) =>
      Object.entries(filter).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
    ).length

  const active = { teamId: TEAM, tenantId: TENANT, deletedAt: null, leftAt: null }

  it('does not charge the team for a member who has left', () => {
    // The reported scenario: max_team_size = 2, member B left (left_at set, deleted_at null).
    const roster: Row[] = [active, { ...active, leftAt: new Date('2026-01-02T00:00:00Z') }]

    const memberCount = countMatching(roster, activeTeamMemberFilter({ teamId: TEAM, tenantId: TENANT }))

    expect(memberCount).toBe(1)
    // Which is the whole point: the owner can invite a replacement.
    expect(canInviteToTeam({ minTeamSize: 2, maxTeamSize: 2 }, { memberCount, pendingInvitationCount: 0 }))
      .toEqual({ allowed: true })
    expect(canJoinTeam({ maxTeamSize: 2 }, { memberCount })).toEqual({ allowed: true })
  })

  it('agrees with what browse-teams displays for the same roster', () => {
    // `browse-teams` counts `WHERE team_id = ? AND left_at IS NULL`. A capacity count that
    // disagrees produces "This team is full (2 of 2 members)" over a bar reading 1/2.
    const roster: Row[] = [active, { ...active, leftAt: new Date('2026-01-02T00:00:00Z') }]
    const browseTeamsCount = roster.filter((r) => r.teamId === TEAM && r.leftAt === null).length

    expect(countMatching(roster, activeTeamMemberFilter({ teamId: TEAM, tenantId: TENANT })))
      .toBe(browseTeamsCount)
  })

  it('still excludes soft-deleted rows, other teams and other tenants', () => {
    const roster: Row[] = [
      active,
      { ...active, deletedAt: new Date('2026-01-02T00:00:00Z') },
      { ...active, teamId: OTHER_TEAM },
      { ...active, tenantId: OTHER_TENANT },
    ]

    expect(countMatching(roster, activeTeamMemberFilter({ teamId: TEAM, tenantId: TENANT }))).toBe(1)
  })

  it('spells out both null conditions, so no call site can forget one', () => {
    expect(activeTeamMemberFilter({ teamId: TEAM, tenantId: TENANT })).toEqual({
      teamId: TEAM,
      tenantId: TENANT,
      deletedAt: null,
      leftAt: null,
    })
  })
})
