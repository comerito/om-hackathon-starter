import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { portalDefaultLocaleSchema } from '../../../data/validators'
import {
  PORTAL_DEFAULT_LOCALE_CONFIG_KEY,
  getSupportedPortalLocales,
} from '@/lib/portal-translations'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.edit'] },
  PUT: { requireAuth: true, requireFeatures: ['competitions.edit'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const [defaultLocale, supportedLocales] = await Promise.all([
      configService.getValue<string>('competitions', PORTAL_DEFAULT_LOCALE_CONFIG_KEY, { defaultValue: 'pl' }),
      getSupportedPortalLocales(container),
    ])

    return NextResponse.json({
      ok: true,
      default_locale: defaultLocale ?? 'pl',
      supported_locales: supportedLocales,
    })
  } catch (error) {
    console.error('[admin/portal-locale-settings] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const parsed = portalDefaultLocaleSchema.parse(await req.json())
    const container = await createRequestContainer()
    const configService = container.resolve('moduleConfigService') as ModuleConfigService

    await configService.setValue('competitions', PORTAL_DEFAULT_LOCALE_CONFIG_KEY, parsed.default_locale)

    return NextResponse.json({ ok: true, default_locale: parsed.default_locale })
  } catch (error) {
    console.error('[admin/portal-locale-settings] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Portal locale settings',
  methods: {
    GET: { summary: 'Read portal default locale setting' },
    PUT: { summary: 'Update portal default locale setting' },
  },
}
