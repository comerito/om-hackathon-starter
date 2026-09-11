/**
 * Derive `PLATFORM_DOMAINS` from `APP_URL` when it has not been configured explicitly.
 *
 * ## The problem this solves
 *
 * Every customer-portal auth route resolves its tenant through `resolveTenantContext()`
 * (`@open-mercato/core/modules/customer_accounts/lib/resolveTenantContext.ts`), which
 * branches on the request's `Host`:
 *
 * ```ts
 * const isPlatform = hostname ? platformDomains().includes(hostname) : true
 * if (isPlatform) { /* resolve the tenant from the request body *\/ }
 * // otherwise: look up an ACTIVE row in `domain_mappings`, or throw
 * //   "This domain is not configured for any active organization" (404)
 * ```
 *
 * `platformDomains()` reads `PLATFORM_DOMAINS`, defaulting to `localhost,openmercato.com`.
 * A deployment served from any other hostname therefore takes the custom-domain branch and
 * fails to log anyone in until either `PLATFORM_DOMAINS` is set or a verified domain
 * mapping exists — even though the portal login page already sends a `tenantId`, which that
 * branch ignores for resolution.
 *
 * This bites only in production. `normalizeHostname()` requires at least two labels, so
 * `localhost` normalises to `null` and takes the `isPlatform = true` fallback — local
 * development never exercises the failing path.
 *
 * ## Why derive it rather than just document the env var
 *
 * `APP_URL` is already required for absolute links (emails, invite URLs), so the deployment
 * has always told us its own hostname. `PLATFORM_DOMAINS` is by definition "the hosts this
 * deployment answers on", so making it default to `APP_URL` removes a second, redundant
 * setting whose omission breaks login in a way whose error message points somewhere else
 * entirely.
 *
 * An explicitly configured `PLATFORM_DOMAINS` always wins — this only fills in a blank.
 * `localhost` is kept in the derived list so a developer pointing `APP_URL` at a deployed
 * host locally does not lose the loopback.
 */

const LOOPBACK_HOSTS = ['localhost']

/**
 * Compute the value `PLATFORM_DOMAINS` should take, or `null` to leave it alone.
 *
 * Pure and side-effect free so it can be reasoned about (and tested) directly.
 */
export function derivePlatformDomains(
  appUrl: string | undefined | null,
  configured: string | undefined | null,
): string | null {
  // An explicit setting is authoritative, even if it looks wrong — never second-guess it.
  if (configured && configured.trim().length > 0) return null
  if (!appUrl || appUrl.trim().length === 0) return null

  let hostname: string
  try {
    hostname = new URL(appUrl.trim()).hostname.toLowerCase()
  } catch {
    // APP_URL is not a parseable absolute URL; leave the framework default in place.
    return null
  }
  if (!hostname) return null

  const hosts = [hostname, ...LOOPBACK_HOSTS.filter((h) => h !== hostname)]
  return hosts.join(',')
}

/**
 * Apply {@link derivePlatformDomains} to `process.env`.
 *
 * Called for its side effect at bootstrap, before any request is served.
 * `platformDomains()` reads `process.env` on every call, so setting it here is enough —
 * no rebuild and no import-order coupling.
 */
export function ensurePlatformDomains(): void {
  const derived = derivePlatformDomains(process.env.APP_URL, process.env.PLATFORM_DOMAINS)
  if (derived) process.env.PLATFORM_DOMAINS = derived
}
