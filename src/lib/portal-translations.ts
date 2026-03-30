import type { AwilixContainer } from 'awilix'
import { applyTranslationOverlays } from '@open-mercato/core/modules/translations/lib/apply'
import { locales, type Locale } from '@open-mercato/shared/lib/i18n/config'

const PORTAL_FALLBACK_LOCALE: Locale = 'pl'

function normalizeLocale(value: string | null | undefined): Locale | null {
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

export function resolvePortalLocale(req: Request): Locale {
  const url = new URL(req.url)
  const explicitLocale = normalizeLocale(url.searchParams.get('locale'))
  if (explicitLocale) return explicitLocale

  const cookieLocale = normalizeLocale(readCookie(req.headers.get('cookie'), 'locale'))
  if (cookieLocale) return cookieLocale

  const acceptLanguage = req.headers.get('accept-language') ?? ''
  for (const chunk of acceptLanguage.split(',')) {
    const candidate = normalizeLocale(chunk.split(';')[0])
    if (candidate) return candidate
  }

  return PORTAL_FALLBACK_LOCALE
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
