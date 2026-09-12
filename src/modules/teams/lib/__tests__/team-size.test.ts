import {
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
