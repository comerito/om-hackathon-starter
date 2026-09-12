import { locales, type Locale } from '@open-mercato/shared/lib/i18n/config'

/**
 * Pure locale helpers, deliberately kept free of DI-container and entity imports so they can be
 * unit-tested (and imported from the Edge-runtime proxy) without dragging in the ORM.
 * `src/lib/portal-translations.ts` re-exports them, so existing call sites are unaffected.
 */

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().split('-')[0]
  return locales.includes(normalized as Locale) ? (normalized as Locale) : null
}

/**
 * Read the `locale` query parameter out of the `x-next-url` request header that `src/proxy.ts`
 * sets.
 *
 * A Next.js layout is handed `params` but never `searchParams` — only a page gets those — so a
 * server-rendered layout has no other way to see `?locale=`. That is exactly why the documented
 * precedence (`?locale=` -> cookie -> user preference -> config -> Accept-Language -> pl) silently
 * lost its first step on the portal (#101): `resolvePortalLocaleFromContext` supported
 * `explicitLocale` all along, and the layout simply had nothing to pass it.
 *
 * Returns the raw value; normalisation stays with the caller, so an unsupported `?locale=klingon`
 * falls through to the next source instead of erroring.
 */
export function readLocaleFromNextUrl(nextUrl: string | null | undefined): string | null {
  if (!nextUrl) return null
  const queryStart = nextUrl.indexOf('?')
  if (queryStart === -1) return null
  return new URLSearchParams(nextUrl.slice(queryStart + 1)).get('locale')
}

/**
 * The request-scoped head of the portal locale precedence: `?locale=` then the cookie. Returns
 * null when neither yields a supported locale, and the caller continues down the chain
 * (user preference -> organization config -> Accept-Language -> pl), all of which need I/O.
 */
export function resolveRequestLocale(
  explicitLocale: string | null | undefined,
  cookieLocale: string | null | undefined,
): Locale | null {
  return normalizeLocale(explicitLocale) ?? normalizeLocale(cookieLocale)
}
