import type { AwilixContainer } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import type { CustomerAuthContext } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { applyTranslationOverlays } from '@open-mercato/core/modules/translations/lib/apply'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { locales, type Locale } from '@open-mercato/shared/lib/i18n/config'
import { PortalLocalePreference } from '@/modules/competitions/data/entities'

const PORTAL_FALLBACK_LOCALE: Locale = 'pl'
export const PORTAL_LOCALE_COOKIE_NAME = 'locale'
export const PORTAL_DEFAULT_LOCALE_CONFIG_KEY = 'portal_default_locale'

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().split('-')[0]
  return locales.includes(normalized as Locale) ? (normalized as Locale) : null
}

function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1)
    }
  }
  return undefined
}

function parseAcceptLanguage(acceptLanguage: string | null | undefined): Locale | null {
  const accept = acceptLanguage ?? ''
  for (const chunk of accept.split(',')) {
    const candidate = normalizeLocale(chunk.split(';')[0])
    if (candidate) return candidate
  }
  return null
}

async function getResolvedContainer(container?: AwilixContainer): Promise<AwilixContainer> {
  if (container) return container
  return createRequestContainer()
}

export async function getPortalUserLocalePreference(options: {
  auth?: CustomerAuthContext | null
  container?: AwilixContainer
}): Promise<Locale | null> {
  if (!options.auth?.sub) return null
  const container = await getResolvedContainer(options.container)
  const em = container.resolve('em') as EntityManager
  const preference = await em.findOne(PortalLocalePreference, {
    customerUserId: options.auth.sub,
    tenantId: options.auth.tenantId,
    organizationId: options.auth.orgId,
    deletedAt: null,
  })
  return normalizeLocale(preference?.locale)
}

export async function getPortalOrganizationDefaultLocale(container?: AwilixContainer): Promise<Locale | null> {
  const resolvedContainer = await getResolvedContainer(container)
  const configService = resolvedContainer.resolve('moduleConfigService') as ModuleConfigService
  const configured = await configService.getValue<string>('competitions', PORTAL_DEFAULT_LOCALE_CONFIG_KEY, { defaultValue: null })
  return normalizeLocale(configured)
}

export async function getSupportedPortalLocales(container?: AwilixContainer): Promise<Locale[]> {
  const resolvedContainer = await getResolvedContainer(container)
  const configService = resolvedContainer.resolve('moduleConfigService') as ModuleConfigService
  const configured = await configService.getValue<string[]>('translations', 'supported_locales', { defaultValue: ['pl', 'en'] })
  const normalized = Array.isArray(configured)
    ? configured.map((entry) => normalizeLocale(entry)).filter((entry): entry is Locale => entry !== null)
    : []
  const unique = Array.from(new Set(normalized))
  return unique.length > 0 ? unique : ['pl', 'en']
}

export async function resolvePortalLocaleFromContext(options: {
  auth?: CustomerAuthContext | null
  explicitLocale?: string | null
  cookieLocale?: string | null
  acceptLanguage?: string | null
  container?: AwilixContainer
}): Promise<Locale> {
  const explicitLocale = normalizeLocale(options.explicitLocale)
  if (explicitLocale) return explicitLocale

  const cookieLocale = normalizeLocale(options.cookieLocale)
  if (cookieLocale) return cookieLocale

  const preferenceLocale = await getPortalUserLocalePreference({
    auth: options.auth,
    container: options.container,
  })
  if (preferenceLocale) return preferenceLocale

  const organizationLocale = await getPortalOrganizationDefaultLocale(options.container)
  if (organizationLocale) return organizationLocale

  const browserLocale = parseAcceptLanguage(options.acceptLanguage)
  if (browserLocale) return browserLocale

  return PORTAL_FALLBACK_LOCALE
}

export async function resolvePortalLocale(
  req: Request,
  options?: {
    auth?: CustomerAuthContext | null
    container?: AwilixContainer
  },
): Promise<Locale> {
  const url = new URL(req.url)
  const auth = options?.auth ?? await getCustomerAuthFromRequest(req)
  return resolvePortalLocaleFromContext({
    auth,
    explicitLocale: url.searchParams.get('locale'),
    cookieLocale: readCookie(req.headers.get('cookie'), PORTAL_LOCALE_COOKIE_NAME) ?? null,
    acceptLanguage: req.headers.get('accept-language'),
    container: options?.container,
  })
}

export async function applyPortalTranslationOverlays<T extends { id: string }>(
  items: T[],
  options: {
    entityType: string
    locale: string
    tenantId?: string | null
    organizationId?: string | null
    container: AwilixContainer
  },
): Promise<T[]> {
  if (items.length === 0) return items

  const translated = await applyTranslationOverlays(
    items as unknown as Record<string, unknown>[],
    options,
  )

  return translated as T[]
}
