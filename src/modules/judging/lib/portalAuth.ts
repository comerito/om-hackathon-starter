import { NextResponse } from 'next/server'
import { hasAllFeatures } from '@open-mercato/shared/lib/auth/featureMatch'
import type { CustomerAuthContext } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'

/**
 * Server-side feature gate for portal (customer) API routes.
 *
 * ## Why this exists
 *
 * A route's per-method `metadata` is read by the API catch-all in
 * `src/app/api/[...slug]/route.ts`. Its `extractMethodMetadata()` understands exactly four
 * keys — `requireAuth`, `requireRoles`, `requireFeatures` and `rateLimit` — all of which are
 * evaluated against the **staff** `AuthContext`. `requireCustomerAuth` and
 * `requireCustomerFeatures` are declared on the shared route type (and enforced by the
 * `(frontend)` page catch-all for portal *pages*), but no API code path reads them. On an
 * API route they are documentation: a route that declares only
 * `{ POST: { requireCustomerAuth: true } }` is, as far as the dispatcher is concerned, an
 * unauthenticated public endpoint, and whatever the handler itself checks is the entire gate.
 *
 * So portal API routes must check features in the handler. This helper is that check, kept in
 * one place so every judging portal route spells the rule the same way.
 *
 * `auth.resolvedFeatures` is not carried in the JWT: `getCustomerAuthFromRequest` resolves it
 * per request in `validateUserState()` via `customerRbacService.loadAcl()`, and portal admins
 * get the `['*']` wildcard. `hasAllFeatures` is the same wildcard-aware predicate the
 * `(frontend)` catch-all uses for `requireCustomerFeatures`, so a portal page and the API
 * route behind it agree.
 *
 * @returns `null` when the caller may proceed, otherwise the response to return as-is.
 */
export function requirePortalFeatures(
  auth: CustomerAuthContext | null | undefined,
  required: string[],
): NextResponse | null {
  if (!auth?.sub) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!required.length) return null
  if (hasAllFeatures(required, auth.resolvedFeatures ?? [])) return null
  return NextResponse.json({ error: 'Forbidden', requiredFeatures: required }, { status: 403 })
}

/** Granted to the `judge` customer role in `judging/setup.ts`. */
export const PORTAL_SCORE_FEATURE = 'portal.judging.score'

/**
 * Reading the published ranking in the portal. Granted to `participant`, `mentor` and `judge` in
 * `judging/setup.ts` — everyone who attends may see where they placed.
 */
export const PORTAL_RESULTS_FEATURE = 'portal.judging.results.view'

/**
 * Downloading the whole ranking as a CSV. A **separate** feature from
 * {@link PORTAL_RESULTS_FEATURE} on purpose: gating the export on the view feature is not a gate
 * at all, because every attendee holds the view feature, so the export was reachable by exactly
 * the ordinary competitor issue #118 named. Granted to `judge` only in `judging/setup.ts`;
 * organisers reach it through the portal-admin `['*']` grant.
 *
 * Existing tenants need `yarn mercato auth sync-role-acls` to pick this feature up.
 */
export const PORTAL_RESULTS_EXPORT_FEATURE = 'portal.judging.results.export'
