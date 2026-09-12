import { normalizeLocale, readLocaleFromNextUrl, resolveRequestLocale } from '../portal-locale-query'

/**
 * #101: `?locale=en` had no effect on the server-rendered portal. `resolvePortalLocaleFromContext`
 * always supported `explicitLocale` as the top of the documented precedence
 * (`?locale=` -> cookie -> user preference -> config -> Accept-Language -> pl); the portal layout
 * simply never passed it, because a Next.js layout receives `params` and not `searchParams`.
 *
 * These cover the two pure pieces of the fix: pulling the parameter out of the `x-next-url` header
 * that `src/proxy.ts` sets, and the request-scoped head of the precedence chain. The later steps
 * (user preference, organization config) need a DI container and a database and are exercised by
 * the integration suite, not here.
 */

describe('readLocaleFromNextUrl', () => {
  it('reads locale from a header carrying path and query', () => {
    expect(readLocaleFromNextUrl('/acme-corp/portal/accept-invite?token=abc&locale=en')).toBe('en')
  })

  it('reads it regardless of parameter position', () => {
    expect(readLocaleFromNextUrl('/acme-corp/portal?locale=en&token=abc')).toBe('en')
  })

  it('returns null when the header carries no query string', () => {
    // This is the pre-fix shape of the header: proxy.ts used to send the pathname alone, which is
    // precisely why the layout could never see ?locale=.
    expect(readLocaleFromNextUrl('/acme-corp/portal/accept-invite')).toBeNull()
  })

  it('returns null when the query carries no locale', () => {
    expect(readLocaleFromNextUrl('/acme-corp/portal/accept-invite?token=abc')).toBeNull()
  })

  it.each([null, undefined, ''])('returns null for a missing header (%p)', (value) => {
    expect(readLocaleFromNextUrl(value)).toBeNull()
  })

  it('does not confuse a similarly named parameter', () => {
    expect(readLocaleFromNextUrl('/acme-corp/portal?portal_locale=en')).toBeNull()
  })

  it('returns the raw value and leaves normalization to the caller', () => {
    expect(readLocaleFromNextUrl('/acme-corp/portal?locale=en-GB')).toBe('en-GB')
  })
})

describe('normalizeLocale', () => {
  it('narrows a regional tag to its supported base locale', () => {
    expect(normalizeLocale('en-GB')).toBe('en')
    expect(normalizeLocale('EN')).toBe('en')
  })

  it('rejects an unsupported locale rather than guessing', () => {
    expect(normalizeLocale('klingon')).toBeNull()
  })
})

describe('resolveRequestLocale', () => {
  it('lets ?locale= win over the cookie', () => {
    expect(resolveRequestLocale('en', 'pl')).toBe('en')
  })

  it('normalizes the query value before using it', () => {
    expect(resolveRequestLocale('EN-GB', 'pl')).toBe('en')
  })

  it('falls through to the cookie when ?locale= is unsupported', () => {
    // An unrecognised value must not strand the reader on a broken page.
    expect(resolveRequestLocale('klingon', 'pl')).toBe('pl')
  })

  it('falls through to the cookie when ?locale= is absent', () => {
    expect(resolveRequestLocale(null, 'en')).toBe('en')
  })

  it('returns null when neither source yields a supported locale, so the chain continues', () => {
    expect(resolveRequestLocale(null, null)).toBeNull()
    expect(resolveRequestLocale('klingon', 'sindarin')).toBeNull()
  })
})
