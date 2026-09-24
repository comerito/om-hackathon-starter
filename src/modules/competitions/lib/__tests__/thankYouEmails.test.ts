import {
  THANK_YOU_EMAIL_CLIENT_CHUNK_SIZE,
  buildThankYouEmailPayload,
  chunkParticipationIds,
  isValidPhotosUrl,
  prepareThankYouBulkSend,
  skipAlreadyThankedParticipations,
  thankYouEmailFlashKind,
} from '../thankYouEmails'
import { thankYouEmailSchema } from '../../data/validators'

const COMPETITION_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_COMPETITION_ID = '66666666-6666-4666-8666-666666666666'
const PHOTOS_URL = 'https://drive.google.com/drive/folders/example'

function row(id: string, overrides: Partial<{ competition_id: string; thank_you_email_sent_at: string | null }> = {}) {
  return { id, competition_id: COMPETITION_ID, thank_you_email_sent_at: null, ...overrides }
}

describe('prepareThankYouBulkSend', () => {
  it('rejects an empty selection', () => {
    expect(prepareThankYouBulkSend([])).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a selection spanning several competitions', () => {
    expect(prepareThankYouBulkSend([row('a'), row('b', { competition_id: OTHER_COMPETITION_ID })])).toEqual({
      ok: false,
      reason: 'mixed-competition',
    })
  })

  it('rejects a selection where everyone was already thanked', () => {
    expect(prepareThankYouBulkSend([row('a', { thank_you_email_sent_at: '2026-09-20T10:00:00.000Z' })])).toEqual({
      ok: false,
      reason: 'already-sent-only',
    })
  })

  it('keeps only unsent rows and reports how many were skipped', () => {
    expect(
      prepareThankYouBulkSend([
        row('a'),
        row('b', { thank_you_email_sent_at: '2026-09-20T10:00:00.000Z' }),
        row('c'),
      ]),
    ).toEqual({ ok: true, competitionId: COMPETITION_ID, participationIds: ['a', 'c'], skippedAlreadySent: 1 })
  })
})

describe('buildThankYouEmailPayload', () => {
  it('builds a payload the route schema accepts, trimming the link', () => {
    const ids = ['00000000-0000-4000-8000-000000000001']
    const payload = buildThankYouEmailPayload(COMPETITION_ID, ids, `  ${PHOTOS_URL}  `)
    expect(payload.photos_url).toBe(PHOTOS_URL)
    expect(thankYouEmailSchema.parse(payload)).toEqual({
      competition_id: COMPETITION_ID,
      photos_url: PHOTOS_URL,
      selection: { mode: 'selected', participation_ids: ids },
    })
  })
})

describe('isValidPhotosUrl', () => {
  it('accepts http(s) links only', () => {
    expect(isValidPhotosUrl(PHOTOS_URL)).toBe(true)
    expect(isValidPhotosUrl('http://example.com/photos')).toBe(true)
    expect(isValidPhotosUrl('javascript:alert(1)')).toBe(false)
    expect(isValidPhotosUrl('drive.google.com/folder')).toBe(false)
    expect(isValidPhotosUrl('')).toBe(false)
  })

  it('is enforced by the route schema', () => {
    const result = thankYouEmailSchema.safeParse({
      competition_id: COMPETITION_ID,
      photos_url: 'javascript:alert(1)',
      selection: { mode: 'selected', participation_ids: ['00000000-0000-4000-8000-000000000001'] },
    })
    expect(result.success).toBe(false)
  })
})

describe('skipAlreadyThankedParticipations', () => {
  it('drops rows that already carry a sent marker', () => {
    type Row = { id: string; thankYouEmailSentAt?: Date | null }
    const unsent: Row = { id: 'a', thankYouEmailSentAt: null }
    const sent: Row = { id: 'b', thankYouEmailSentAt: new Date() }
    const neverSet: Row = { id: 'c' }
    expect(skipAlreadyThankedParticipations([unsent, sent, neverSet])).toEqual([unsent, neverSet])
  })
})

describe('chunkParticipationIds', () => {
  it('splits a large selection into short requests, keeping order and every id', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `id-${index}`)
    const chunks = chunkParticipationIds(ids)
    expect(chunks.every((chunk) => chunk.length <= THANK_YOU_EMAIL_CLIENT_CHUNK_SIZE)).toBe(true)
    expect(chunks.flat()).toEqual(ids)
    expect(chunkParticipationIds(ids, 3).map((chunk) => chunk.length)).toEqual([3, 3, 3, 1])
  })

  it('returns no chunks for an empty selection and never loops on a bad size', () => {
    expect(chunkParticipationIds([])).toEqual([])
    expect(chunkParticipationIds(['a', 'b'], 0)).toEqual([['a'], ['b']])
  })
})

describe('thankYouEmailFlashKind', () => {
  it('maps the send summary to a flash severity', () => {
    expect(thankYouEmailFlashKind({ sent: 3, failed: 0, status: 'complete' })).toBe('success')
    // Everything was already sent (e.g. a retried chunk): nothing failed, so not an error.
    expect(thankYouEmailFlashKind({ sent: 0, failed: 0, status: 'complete' })).toBe('success')
    expect(thankYouEmailFlashKind({ sent: 2, failed: 1, status: 'partial' })).toBe('warning')
    expect(thankYouEmailFlashKind({ sent: 0, failed: 2, status: 'partial' })).toBe('error')
  })
})
