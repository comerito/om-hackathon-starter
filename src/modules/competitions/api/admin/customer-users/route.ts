import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { lookupHashCandidates } from '@open-mercato/shared/lib/encryption/aes'
import { resolveSearchConfig } from '@open-mercato/shared/lib/search/config'
import { tokenizeText } from '@open-mercato/shared/lib/search/tokenize'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { rawAll } from '@/lib/db'

/**
 * Customer-account lookup for the participants admin screens.
 *
 * Core's `/api/customer_accounts/admin/users` accepts neither `ids` nor any name filter — it
 * reads `page`, `pageSize`, `status`, `customerEntityId`, `personEntityId`, `roleId` and
 * `search`, and silently drops everything else. The three participants pages were passing
 * `displayName=` and `ids=`, so they all received "the newest N accounts" instead of what they
 * asked for: the Add Participant combobox could only ever offer the first page, and the detail
 * page attributed a participation to whoever was created most recently. Core lives in
 * `node_modules` and cannot be patched from an app, so the lookup lives here.
 *
 * `display_name` and `email` are encrypted columns (`customer_accounts/encryption.ts`), which
 * rules out `ILIKE` on the stored value — the ciphertext never matches a plaintext term. Name
 * search therefore goes through `search_tokens` (hashed prefix tokens, the same index core's own
 * `search` parameter uses) and email search through the `email_hash` lookup digest.
 */

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

const CUSTOMER_USER_ENTITY_TYPE = 'customer_accounts:customer_user'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
/** A combobox never asks for this many; the cap only keeps a hand-crafted URL bounded. */
const MAX_IDS = 200

export type CustomerUserOption = {
  id: string
  displayName: string
  email: string
}

function parseIds(raw: string | null): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (UUID_RE.test(id)) seen.add(id.toLowerCase())
    if (seen.size >= MAX_IDS) break
  }
  return [...seen]
}

function parsePageSize(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, parsed))
}

/**
 * Resolve a free-text query to customer-user ids through the `search_tokens` index.
 *
 * Mirrors core's own helper: every token of the query must be present on the row, which is what
 * makes "tom nocon" narrower than "tom" rather than wider. Tokens are stored prefix-expanded
 * (`OM_SEARCH_ENABLE_PARTIAL`, default on), so a 3-letter prefix matches a longer name.
 */
export async function findCustomerUserIdsBySearchTokens(
  em: EntityManager,
  hashes: string[],
  tenantId: string,
): Promise<string[]> {
  // `IN (?)` inlines the array as a literal list (see src/lib/db.ts); `IN ()` does not parse.
  if (!hashes.length) return []
  const rows = await rawAll<{ entity_id: string }>(
    em,
    `SELECT entity_id
       FROM search_tokens
      WHERE entity_type = ?
        AND token_hash IN (?)
        AND tenant_id IS NOT DISTINCT FROM ?
      GROUP BY entity_id
     HAVING count(DISTINCT token_hash) >= ?`,
    [CUSTOMER_USER_ENTITY_TYPE, hashes, tenantId, hashes.length],
  )
  return rows.map((row) => row.entity_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const idsParam = url.searchParams.get('ids')
    const ids = parseIds(idsParam)
    // An `ids=` that resolves to nothing is an empty selection, not "give me everyone".
    if (idsParam !== null && ids.length === 0) {
      return NextResponse.json({ items: [] })
    }
    const search = (url.searchParams.get('search') ?? '').trim()
    const pageSize = parsePageSize(url.searchParams.get('pageSize'))

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })

    const where: Record<string, unknown> = { tenantId: auth.tenantId, deletedAt: null }
    // `filterIds: null` means the caller may read every organization of the tenant; the tenant
    // predicate above is still the hard boundary.
    if (scope.filterIds && scope.filterIds.length > 0) {
      where.organizationId = { $in: scope.filterIds }
    }

    if (ids.length > 0) {
      where.id = { $in: ids }
    } else if (search) {
      const searchConfig = resolveSearchConfig()
      const { hashes } = searchConfig.enabled ? tokenizeText(search, searchConfig) : { hashes: [] as string[] }
      const isEmailQuery = EMAIL_LIKE_PATTERN.test(search)

      if (hashes.length > 0 || isEmailQuery) {
        const searchFilter: Record<string, unknown>[] = []
        if (hashes.length > 0) {
          const matchedIds = await findCustomerUserIdsBySearchTokens(em, hashes, auth.tenantId)
          if (matchedIds.length > 0) searchFilter.push({ id: { $in: matchedIds } })
        }
        if (isEmailQuery) {
          searchFilter.push({ emailHash: { $in: lookupHashCandidates(search) } })
        }
        if (searchFilter.length === 0) {
          return NextResponse.json({ items: [] })
        }
        where.$or = searchFilter
      }
      // Otherwise the query is shorter than `OM_SEARCH_MIN_LEN` (or indexing is switched off), so
      // there is nothing to look it up against. Fall through to the plain first page and let the
      // combobox's client-side filter narrow it — the same behaviour a 1–2 character query has
      // always had, rather than a blank dropdown.
    }

    const rows = await findWithDecryption(
      em,
      CustomerUser,
      where as FilterQuery<CustomerUser>,
      {
        orderBy: { createdAt: 'DESC' },
        limit: ids.length > 0 ? ids.length : pageSize,
      },
      { tenantId: auth.tenantId, organizationId: scope.selectedId ?? auth.orgId ?? null },
    )

    const items: CustomerUserOption[] = rows.map((user) => ({
      id: user.id,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[admin/customer-users] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Look up customer accounts for participant administration',
  methods: {
    GET: {
      summary:
        'Resolve customer accounts by id (`ids=` comma-separated) or by name/email (`search=`), scoped to the caller tenant and organization scope. Name search runs against the encrypted-field search index, so it needs at least OM_SEARCH_MIN_LEN characters; a shorter query returns the first page unfiltered.',
    },
  },
}
