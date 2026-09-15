export type SandboxInviteRow = {
  id: string
  competition_id: string
  mercato_sandboxes_invited_at: string | Date | null
}

export type PrepareSandboxBulkInviteResult =
  | { ok: true; competitionId: string; participationIds: string[] }
  | { ok: false; reason: 'empty' | 'mixed-competition' | 'already-sent-only' }

export type SandboxInviteSummary = {
  sent: number
  conflicts: number
  failed: number
  status: 'complete' | 'partial'
}

export function isUnsentSandboxInviteRow(row: SandboxInviteRow): boolean {
  return row.mercato_sandboxes_invited_at == null
}

export function prepareSandboxBulkInvite(rows: SandboxInviteRow[]): PrepareSandboxBulkInviteResult {
  if (rows.length === 0) return { ok: false, reason: 'empty' }

  const competitionIds = new Set(rows.map((row) => row.competition_id).filter((id) => id.length > 0))
  if (competitionIds.size !== 1) return { ok: false, reason: 'mixed-competition' }

  const competitionId = [...competitionIds][0]
  if (!competitionId) return { ok: false, reason: 'empty' }

  const participationIds = rows.filter(isUnsentSandboxInviteRow).map((row) => row.id)
  if (participationIds.length === 0) return { ok: false, reason: 'already-sent-only' }

  return { ok: true, competitionId, participationIds }
}

export function buildSandboxInvitePayload(
  competitionId: string,
  participationIds: string[],
): {
  competition_id: string
  selection: { mode: 'selected'; participation_ids: string[] }
} {
  return {
    competition_id: competitionId,
    selection: { mode: 'selected', participation_ids: participationIds },
  }
}

export function skipAlreadySentParticipations<T extends { mercatoSandboxesInvitedAt?: Date | null }>(
  rows: T[],
): T[] {
  return rows.filter((row) => row.mercatoSandboxesInvitedAt == null)
}

export function formatSentMarker(
  value: string | Date | null | undefined,
  locale?: string,
): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
}

export function sandboxInviteFlashKind(
  summary: SandboxInviteSummary,
): 'success' | 'warning' | 'error' {
  if (summary.sent === 0) return 'error'
  if (summary.status === 'complete') return 'success'
  return 'warning'
}
