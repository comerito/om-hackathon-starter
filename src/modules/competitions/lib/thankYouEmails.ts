export type ThankYouEmailRow = {
  id: string
  competition_id: string
  thank_you_email_sent_at: string | Date | null
}

export type PrepareThankYouBulkSendResult =
  | { ok: true; competitionId: string; participationIds: string[]; skippedAlreadySent: number }
  | { ok: false; reason: 'empty' | 'mixed-competition' | 'already-sent-only' }

export type ThankYouEmailSummary = {
  sent: number
  failed: number
  status: 'complete' | 'partial'
}

export type ThankYouEmailItemResult = {
  participation_id: string
  status: 'sent' | 'failed' | 'skipped'
}

// Resend allows max 5 requests/second, so emails go out 4 at a time with a pause in between.
export const THANK_YOU_EMAIL_CONCURRENCY = 4
export const THANK_YOU_EMAIL_BATCH_DELAY_MS = 1000
export const THANK_YOU_EMAIL_MAX_RECIPIENTS = 200

// The backoffice sends one short request per chunk instead of one long request for the whole
// selection: a request that outlives the reverse proxy's timeout is cut off client-side while
// the server keeps emailing, which leaves the operator staring at a frozen dialog.
export const THANK_YOU_EMAIL_CLIENT_CHUNK_SIZE = THANK_YOU_EMAIL_CONCURRENCY
export const THANK_YOU_EMAIL_CLIENT_CHUNK_PAUSE_MS = 1000
export const THANK_YOU_EMAIL_CLIENT_TIMEOUT_MS = 30000

// Pre-fills the send dialog; the organizer can overwrite it per send.
export const DEFAULT_THANK_YOU_PHOTOS_URL = 'https://drive.google.com/drive/folders/1nEG4036D1D1HhhmLIahWBquWvagA5zhg'

export function isUnsentThankYouEmailRow(row: ThankYouEmailRow): boolean {
  return row.thank_you_email_sent_at == null
}

export function prepareThankYouBulkSend(rows: ThankYouEmailRow[]): PrepareThankYouBulkSendResult {
  if (rows.length === 0) return { ok: false, reason: 'empty' }

  const competitionIds = new Set(rows.map((row) => row.competition_id).filter((id) => id.length > 0))
  if (competitionIds.size !== 1) return { ok: false, reason: 'mixed-competition' }

  const competitionId = [...competitionIds][0]
  if (!competitionId) return { ok: false, reason: 'empty' }

  const participationIds = rows.filter(isUnsentThankYouEmailRow).map((row) => row.id)
  if (participationIds.length === 0) return { ok: false, reason: 'already-sent-only' }

  return {
    ok: true,
    competitionId,
    participationIds,
    skippedAlreadySent: rows.length - participationIds.length,
  }
}

export function buildThankYouEmailPayload(
  competitionId: string,
  participationIds: string[],
  photosUrl: string,
): {
  competition_id: string
  photos_url: string
  selection: { mode: 'selected'; participation_ids: string[] }
} {
  return {
    competition_id: competitionId,
    photos_url: photosUrl.trim(),
    selection: { mode: 'selected', participation_ids: participationIds },
  }
}

export function chunkParticipationIds(ids: string[], size: number = THANK_YOU_EMAIL_CLIENT_CHUNK_SIZE): string[][] {
  const chunkSize = Math.max(1, Math.floor(size))
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize))
  return chunks
}

export function isValidPhotosUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function skipAlreadyThankedParticipations<T extends { thankYouEmailSentAt?: Date | null }>(
  rows: T[],
): T[] {
  return rows.filter((row) => row.thankYouEmailSentAt == null)
}

export function thankYouEmailFlashKind(
  summary: ThankYouEmailSummary,
): 'success' | 'warning' | 'error' {
  if (summary.failed === 0) return 'success'
  if (summary.sent === 0) return 'error'
  return 'warning'
}
