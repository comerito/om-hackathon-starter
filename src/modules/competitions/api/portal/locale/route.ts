import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { PortalLocalePreference } from '../../../data/entities'
import { portalLocaleSchema } from '../../../data/validators'
import {
  PORTAL_LOCALE_COOKIE_NAME,
  getPortalOrganizationDefaultLocale,
  getPortalUserLocalePreference,
  getSupportedPortalLocales,
  resolvePortalLocale,
} from '@/lib/portal-translations'

export const metadata = {
  GET: { requireCustomerAuth: true },
  PUT: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const [locale, savedLocale, defaultLocale, supportedLocales] = await Promise.all([
      resolvePortalLocale(req, { auth, container }),
      getPortalUserLocalePreference({ auth, container }),
      getPortalOrganizationDefaultLocale(container),
      getSupportedPortalLocales(container),
    ])

    return NextResponse.json({
      ok: true,
      locale,
      saved_locale: savedLocale,
      default_locale: defaultLocale ?? 'pl',
      supported_locales: supportedLocales,
    })
  } catch (error) {
    console.error('[portal/locale] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const parsed = portalLocaleSchema.parse(await req.json())
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    let preference = await em.findOne(PortalLocalePreference, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
    })

    if (!preference) {
      preference = em.create(PortalLocalePreference, {
        customerUserId: auth.sub,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        locale: parsed.locale,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(preference)
    } else {
      preference.locale = parsed.locale
      preference.deletedAt = null
    }

    await em.flush()

    const response = NextResponse.json({ ok: true, locale: parsed.locale })
    response.cookies.set(PORTAL_LOCALE_COOKIE_NAME, parsed.locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    console.error('[portal/locale] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Portal locale preference',
  methods: {
    GET: { summary: 'Resolve current portal locale and available locales' },
    PUT: { summary: 'Persist current customer portal locale preference' },
  },
}
