import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { GET as coreBackendChromeGet } from '@open-mercato/core/modules/auth/api/admin/nav'
import { loadSidebarPreference } from '@open-mercato/core/modules/auth/services/sidebarPreferencesService'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { pinHackOnFirst } from '@/modules/competitions/lib/sidebar-order'

/**
 * Backend chrome payload with HackOn pinned to the top of the sidebar.
 *
 * `AppShell` renders `chromePayload?.groups ?? groups`, so the API payload — not the
 * server-rendered `groups` prop from `src/app/(backend)/backend/layout.tsx` — decides the
 * order the user actually sees. This route wraps the core payload and reorders it.
 * `layout.tsx` points `adminNavApi` here.
 *
 * See `src/modules/competitions/lib/sidebar-order.ts` for why neither page metadata nor a
 * stored sidebar preference can achieve this on 0.6.7.
 *
 * Everything else in the payload (brand, settings sections, granted features, profile
 * sections) is passed through untouched, and auth is core's: `coreBackendChromeGet` calls
 * `getAuthFromRequest` itself and answers 401 when there is no session.
 */
export async function GET(req: Request) {
  const response = await coreBackendChromeGet(req)
  if (!response.ok) return response

  const payload = await response.json().catch(() => null)
  if (!payload || !Array.isArray(payload.groups)) return response

  // Respect a user who has deliberately ordered their own sidebar; only supply the
  // product default for users who have not. `loadSidebarPreference` never returns null —
  // an absent row yields `{ groupOrder: [] }` — so the emptiness of `groupOrder` is what
  // distinguishes "no preference" from "customised".
  if (await hasCustomGroupOrder(req)) return NextResponse.json(payload)

  return NextResponse.json({ ...payload, groups: pinHackOnFirst(payload.groups) })
}

async function hasCustomGroupOrder(req: Request): Promise<boolean> {
  try {
    const auth = await getAuthFromRequest(req)
    const userId = auth?.isApiKey ? auth.userId : auth?.sub
    if (!userId) return false

    const url = new URL(req.url)
    const orgParam = url.searchParams.get('orgId')

    const { locale } = await resolveTranslations()
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const preference = await loadSidebarPreference(em, {
      userId,
      tenantId: auth?.tenantId ?? null,
      organizationId: orgParam || auth?.orgId || null,
      locale,
    })
    return Boolean(preference?.groupOrder?.length)
  } catch {
    // Never let this check break the sidebar — fall back to pinning, which is the
    // product default and what a user with no preference should see anyway.
    return false
  }
}
