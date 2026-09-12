/**
 * Regression tests for issue #83 — the Track "Category" (and "Badge") field was
 * silently dropped on save and stored as NULL.
 *
 * Two independent layers had to be fixed and both are covered here:
 *  1. `createTrackSchema` / `updateTrackSchema` did not declare `category` or
 *     `badge`, so Zod stripped them out of the parsed payload.
 *  2. The `tracks.tracks.create` / `tracks.tracks.update` command handlers never
 *     copied the two values onto the entity.
 *
 * These tests run entirely against stubs — no database is touched.
 */
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { commandRegistry } from '@open-mercato/shared/lib/commands'
import { createTrackSchema, updateTrackSchema } from '../data/validators'
import type { Track } from '../data/entities'

import '../commands/tracks'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ORG_ID = '22222222-2222-4222-8222-222222222222'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const TRACK_ID = '44444444-4444-4444-8444-444444444444'

type CreatedTrackData = Partial<Record<keyof Track, unknown>>

type DataEngineStub = {
  createdData: CreatedTrackData | null
  updatedEntity: Track | null
  createOrmEntity: (args: { data: CreatedTrackData }) => Promise<Track>
  updateOrmEntity: (args: { apply: (entity: Track) => void }) => Promise<Track>
  markOrmEntityChange: () => void
}

function makeExistingTrack(): Track {
  return {
    id: TRACK_ID,
    competitionId: COMPETITION_ID,
    name: 'Existing',
    shortDescription: null,
    description: null,
    attachmentIds: [],
    color: '#6366f1',
    iconUrl: null,
    maxTeams: null,
    order: 0,
    category: 'OldCategory',
    badge: 'hot',
    mentorIds: [],
    tenantId: TENANT_ID,
    organizationId: ORG_ID,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Track
}

function makeDataEngine(existing: Track = makeExistingTrack()): DataEngineStub {
  const stub: DataEngineStub = {
    createdData: null,
    updatedEntity: null,
    async createOrmEntity({ data }) {
      stub.createdData = data
      return { ...makeExistingTrack(), ...data } as Track
    },
    async updateOrmEntity({ apply }) {
      apply(existing)
      stub.updatedEntity = existing
      return existing
    },
    markOrmEntityChange() {},
  }
  return stub
}

function makeCtx(dataEngine: DataEngineStub): CommandRuntimeContext {
  return {
    container: { resolve: (key: string) => (key === 'dataEngine' ? dataEngine : null) },
    auth: { tenantId: TENANT_ID, orgId: ORG_ID },
    selectedOrganizationId: ORG_ID,
  } as unknown as CommandRuntimeContext
}

function getCommand(id: string): CommandHandler<Record<string, unknown>, Track> {
  const handler = commandRegistry.get(id)
  if (!handler) throw new Error(`Command ${id} is not registered`)
  return handler as CommandHandler<Record<string, unknown>, Track>
}

describe('track validators keep category and badge', () => {
  const baseCreate = {
    competition_id: COMPETITION_ID,
    name: 'AI Track',
  }

  it('createTrackSchema does not strip category/badge', () => {
    const parsed = createTrackSchema.parse({ ...baseCreate, category: 'AI', badge: 'new' })
    expect(parsed.category).toBe('AI')
    expect(parsed.badge).toBe('new')
  })

  it('createTrackSchema still accepts a payload without category/badge', () => {
    const parsed = createTrackSchema.parse(baseCreate)
    expect(parsed.category).toBeUndefined()
    expect(parsed.badge).toBeUndefined()
  })

  it('createTrackSchema rejects over-long values (column limits)', () => {
    expect(() => createTrackSchema.parse({ ...baseCreate, category: 'x'.repeat(101) })).toThrow()
    expect(() => createTrackSchema.parse({ ...baseCreate, badge: 'x'.repeat(51) })).toThrow()
  })

  it('updateTrackSchema does not strip category/badge', () => {
    const parsed = updateTrackSchema.parse({ id: TRACK_ID, category: 'DX', badge: 'stability' })
    expect(parsed.category).toBe('DX')
    expect(parsed.badge).toBe('stability')
  })

  it('updateTrackSchema accepts explicit nulls to clear the fields', () => {
    const parsed = updateTrackSchema.parse({ id: TRACK_ID, category: null, badge: null })
    expect(parsed.category).toBeNull()
    expect(parsed.badge).toBeNull()
  })
})

describe('tracks.tracks.create persists category and badge', () => {
  it('writes the submitted values onto the entity', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.create').execute(
      { competition_id: COMPETITION_ID, name: 'AI Track', category: 'AI', badge: 'new' },
      makeCtx(de),
    )
    expect(de.createdData?.category).toBe('AI')
    expect(de.createdData?.badge).toBe('new')
  })

  it('stores NULL rather than an empty string when the form leaves them blank', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.create').execute(
      { competition_id: COMPETITION_ID, name: 'AI Track', category: '', badge: '' },
      makeCtx(de),
    )
    expect(de.createdData?.category).toBeNull()
    expect(de.createdData?.badge).toBeNull()
  })

  it('stores NULL when the fields are omitted entirely', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.create').execute(
      { competition_id: COMPETITION_ID, name: 'AI Track' },
      makeCtx(de),
    )
    expect(de.createdData?.category).toBeNull()
    expect(de.createdData?.badge).toBeNull()
  })
})

describe('tracks.tracks.update persists category and badge', () => {
  it('applies the submitted values to the loaded entity', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.update').execute(
      { id: TRACK_ID, category: 'Impact', badge: 'stability' },
      makeCtx(de),
    )
    expect(de.updatedEntity?.category).toBe('Impact')
    expect(de.updatedEntity?.badge).toBe('stability')
  })

  it('clears the fields when the form submits blanks', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.update').execute(
      { id: TRACK_ID, category: '', badge: '' },
      makeCtx(de),
    )
    expect(de.updatedEntity?.category).toBeNull()
    expect(de.updatedEntity?.badge).toBeNull()
  })

  it('leaves the stored values untouched for a partial update', async () => {
    const de = makeDataEngine()
    await getCommand('tracks.tracks.update').execute({ id: TRACK_ID, name: 'Renamed' }, makeCtx(de))
    expect(de.updatedEntity?.name).toBe('Renamed')
    expect(de.updatedEntity?.category).toBe('OldCategory')
    expect(de.updatedEntity?.badge).toBe('hot')
  })
})
