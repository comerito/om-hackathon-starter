import {
  buildSandboxInvitePayload,
  formatSentMarker,
  prepareSandboxBulkInvite,
  sandboxInviteFlashKind,
  skipAlreadySentParticipations,
  type SandboxInviteRow,
} from '../sandboxInvitations'

function row(
  n: number,
  overrides: Partial<SandboxInviteRow> = {},
): SandboxInviteRow {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    competition_id: '11111111-1111-4111-8111-111111111111',
    mercato_sandboxes_invited_at: null,
    ...overrides,
  }
}

describe('prepareSandboxBulkInvite', () => {
  it('keeps unsent rows from one competition and skips already-sent rows', () => {
    const unsent = [row(1), row(2)]
    const sent = row(3, { mercato_sandboxes_invited_at: '2026-09-15T10:32:00.000Z' })

    expect(prepareSandboxBulkInvite([...unsent, sent])).toEqual({
      ok: true,
      competitionId: unsent[0]?.competition_id,
      participationIds: [unsent[0]?.id, unsent[1]?.id],
    })
  })

  it('rejects a mixed-competition selection before send', () => {
    expect(prepareSandboxBulkInvite([
      row(1),
      row(2, { competition_id: '22222222-2222-4222-8222-222222222222' }),
    ])).toEqual({ ok: false, reason: 'mixed-competition' })
  })

  it('rejects a selection that only contains already-sent rows', () => {
    expect(prepareSandboxBulkInvite([
      row(1, { mercato_sandboxes_invited_at: '2026-09-15T10:32:00.000Z' }),
    ])).toEqual({ ok: false, reason: 'already-sent-only' })
  })

  it('rejects an empty selection', () => {
    expect(prepareSandboxBulkInvite([])).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('buildSandboxInvitePayload', () => {
  it('always sends selected mode with the prepared ids', () => {
    const ids = [row(1).id, row(2).id]
    expect(buildSandboxInvitePayload('comp', ids)).toEqual({
      competition_id: 'comp',
      selection: { mode: 'selected', participation_ids: ids },
    })
  })
})

describe('skipAlreadySentParticipations', () => {
  it('drops rows that already have a timestamp', () => {
    const unsent = { id: 'a', mercatoSandboxesInvitedAt: null }
    const sent = { id: 'b', mercatoSandboxesInvitedAt: new Date('2026-09-01T10:00:00.000Z') }
    expect(skipAlreadySentParticipations([unsent, sent])).toEqual([unsent])
  })
})

describe('sandbox invitation result copy helpers', () => {
  it('formats a sent marker and maps complete / partial / empty sends', () => {
    expect(formatSentMarker('2026-09-15T10:32:00.000Z', 'en-GB')).toEqual(expect.stringMatching(/2026/))
    expect(formatSentMarker(null)).toBeNull()
    expect(sandboxInviteFlashKind({ sent: 2, conflicts: 0, failed: 0, status: 'complete' })).toBe('success')
    expect(sandboxInviteFlashKind({ sent: 1, conflicts: 1, failed: 0, status: 'partial' })).toBe('warning')
    expect(sandboxInviteFlashKind({ sent: 0, conflicts: 0, failed: 2, status: 'partial' })).toBe('error')
  })
})
