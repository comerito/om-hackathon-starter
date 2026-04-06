import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const BOUNTY_TRACK_MAPPINGS_KEY = 'bounty_track_mappings'

export type BountyTrackMappings = Record<string, string> // { [competitionId]: trackId }

const updateConfigSchema = z.object({
  mappings: z.record(z.string().uuid(), z.string().uuid()),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bounties.view'] },
  PUT: { requireAuth: true, requireFeatures: ['bounties.view'] },
}

export async function GET() {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const container = await createRequestContainer()
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const mappings = await configService.getValue<BountyTrackMappings>('bounties', BOUNTY_TRACK_MAPPINGS_KEY, { defaultValue: {} })

    return NextResponse.json({ ok: true, mappings: mappings ?? {} })
  } catch (error) {
    console.error('[bounties/config] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateConfigSchema.parse(body)
    const container = await createRequestContainer()
    const configService = container.resolve('moduleConfigService') as ModuleConfigService

    await configService.setValue('bounties', BOUNTY_TRACK_MAPPINGS_KEY, parsed.mappings)

    return NextResponse.json({ ok: true, mappings: parsed.mappings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/config] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Bounty module configuration',
  methods: {
    GET: { summary: 'Get bounty track mappings (competition → track)' },
    PUT: { summary: 'Set bounty track mappings (competition → track)' },
  },
}
