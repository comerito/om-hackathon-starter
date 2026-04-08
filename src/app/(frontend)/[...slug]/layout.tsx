import { PortalProvider } from '@open-mercato/ui/portal/PortalContext'
import { getCustomerAuthFromCookies } from '@open-mercato/core/modules/customer_accounts/lib/customerAuthServer'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { Organization } from '@open-mercato/core/modules/directory/data/entities'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { FeatureTogglesService } from '@open-mercato/core/modules/feature_toggles/lib/feature-flag-check'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import { loadDictionary, resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { HackathonPortalLayout, type PortalLayoutVariant } from '@/components/portal/HackathonPortalLayout'
import { resolvePortalLocaleFromContext } from '@/lib/portal-translations'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ slug: string[] }>
}

const PUBLIC_SUFFIXES = ['/portal/login', '/portal/signup', '/portal/accept-invite']

function isPublicPortalRoute(pathname: string): boolean {
  if (/^\/[^/]+\/portal\/?$/.test(pathname)) return true
  return PUBLIC_SUFFIXES.some((s) => pathname.endsWith(s))
}

/** Determine layout variant from the portal route path. */
function getLayoutVariant(pathname: string): PortalLayoutVariant {
  if (pathname.includes('/kiosk')) return 'kiosk'
  return 'full'
}

/**
 * Frontend catch-all layout.
 *
 * For portal routes, resolves auth + org + user profile SERVER-SIDE
 * from cookies and DB — identical to the backend layout pattern.
 * All data is in the HTML from frame 1. Zero client-side loading states.
 */
export default async function FrontendLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const pathname = '/' + (slug?.join('/') ?? '')

  const portalMatch = pathname.match(/^\/([^/]+)\/portal(?:\/|$)/)
  if (!portalMatch) {
    return <>{children}</>
  }

  const orgSlug = portalMatch[1]
  const isPublic = isPublicPortalRoute(pathname)

  // Server-side: read customer JWT from cookie
  const customerAuth = await getCustomerAuthFromCookies()

  let orgName: string | null = null
  let tenantId: string | null = null
  let organizationId: string | null = null
  let userName: string | null = null
  let userEmail: string | null = null
  let portalEnabled = true
  let portalLocale: 'en' | 'pl' | 'es' | 'de' = 'pl'

  try {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Server-side: resolve org by slug (single PK-like query)
    const org = await em.findOne(Organization, { slug: orgSlug, deletedAt: null })
    if (org) {
      orgName = org.name
      organizationId = String(org.id)
      const tenant = (org as any).tenant
      tenantId = typeof tenant === 'string' ? tenant : tenant?.id ? String(tenant.id) : null
    }

    // Check portal feature toggle (defaults to enabled if toggle missing)
    if (tenantId) {
      const featureTogglesService = container.resolve('featureTogglesService') as FeatureTogglesService
      const result = await featureTogglesService.getBoolConfig('portal_enabled', tenantId)
      if (result.ok && result.value === false) {
        portalEnabled = false
      }
    }

    // Server-side: resolve user profile by ID from JWT (single PK query)
    // This gives us the authoritative displayName — no client-side blink
    if (customerAuth) {
      const user = await em.findOne(CustomerUser, { id: customerAuth.sub } as any)
      if (user) {
        userName = user.displayName || customerAuth.email
        userEmail = user.email || customerAuth.email
      } else {
        userName = customerAuth.displayName || customerAuth.email
        userEmail = customerAuth.email
      }
    }

    const { cookies, headers } = await import('next/headers')
    const cookieStore = await cookies()
    const headerStore = await headers()
    portalLocale = await resolvePortalLocaleFromContext({
      auth: customerAuth,
      cookieLocale: cookieStore.get('locale')?.value ?? null,
      acceptLanguage: headerStore.get('accept-language'),
      container,
    })
  } catch {
    // Fallback to JWT data
    if (customerAuth) {
      userName = customerAuth.displayName || customerAuth.email
      userEmail = customerAuth.email
    }
  }

  if (!portalEnabled) {
    const { t } = await resolveTranslations()
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="rounded-xl border bg-card p-6 text-center sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t('portal.disabled.title', 'Portal Not Available')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('portal.disabled.description', 'The customer portal has been disabled by the administrator. Please contact your organization for more information.')}
          </p>
        </div>
      </div>
    )
  }

  const authenticated = !isPublic && !!customerAuth
  const variant = isPublic ? 'full' as const : getLayoutVariant(pathname)
  const portalDict = await loadDictionary(portalLocale)

  return (
    <I18nProvider locale={portalLocale} dict={portalDict}>
      <PortalProvider
        orgSlug={orgSlug}
        initialAuth={customerAuth}
        initialTenant={{
          tenantId: tenantId ?? undefined,
          organizationId: organizationId ?? undefined,
          organizationName: orgName ?? undefined,
        }}
      >
        {isPublic ? (
          <>{children}</>
        ) : (
          <HackathonPortalLayout
            variant={variant}
            enableEventBridge={authenticated}
            competitionName={orgName ?? undefined}
            userName={userName ?? undefined}
          >
            {children}
          </HackathonPortalLayout>
        )}
      </PortalProvider>
    </I18nProvider>
  )
}
