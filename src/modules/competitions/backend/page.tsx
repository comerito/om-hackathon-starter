import Link from 'next/link'
import { cookies } from 'next/headers'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveFeatureCheckContext } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import CompetitionsTable from '../components/CompetitionsTable'

// Backend pages are mounted at `/backend/<path under backend/>` — the module id is NOT
// part of the URL. `backend/settings/portal-localization/page.tsx` therefore lives at
// `/backend/settings/portal-localization`, not `/backend/competitions/settings/...`.
const PORTAL_LOCALIZATION_HREF = '/backend/settings/portal-localization'
// Mirrors `requireFeatures` in backend/settings/portal-localization/page.meta.ts.
const PORTAL_LOCALIZATION_FEATURES = ['competitions.edit']

/**
 * This list page only requires `competitions.view`, while the Portal Localization page
 * requires `competitions.edit`, so the shortcut has to be gated or view-only users would
 * be sent to an "access denied" screen. Mirrors the feature check the backend catch-all
 * applies to the target route.
 */
async function canOpenPortalLocalization(): Promise<boolean> {
  try {
    const auth = await getAuthFromCookies()
    if (!auth) return false
    const container = await createRequestContainer()
    const rbac = container.resolve('rbacService') as RbacService
    const cookieStore = await cookies()
    const selectedId = cookieStore.get('om_selected_org')?.value ?? null
    const { organizationId, allowedOrganizationIds, scope } = await resolveFeatureCheckContext({
      container,
      auth,
      selectedId,
    })
    if (Array.isArray(allowedOrganizationIds) && allowedOrganizationIds.length === 0) return false
    return await rbac.userHasAllFeatures(auth.sub, PORTAL_LOCALIZATION_FEATURES, {
      tenantId: scope.tenantId ?? auth.tenantId ?? null,
      organizationId: organizationId ?? null,
    })
  } catch {
    // The target route enforces the same gate server-side, so a transient RBAC failure
    // should not hide navigation from users who legitimately have the feature.
    return true
  }
}

export default async function CompetitionsListPage() {
  const showPortalLocalization = await canOpenPortalLocalization()
  return (
    <Page>
      <PageHeader
        title="Competitions"
        description="Manage hackathons, participants, and portal defaults."
        actions={showPortalLocalization ? (
          <Link
            href={PORTAL_LOCALIZATION_HREF}
            className="text-sm font-medium text-primary hover:underline"
          >
            Portal Localization
          </Link>
        ) : undefined}
      />
      <PageBody>
        <CompetitionsTable />
      </PageBody>
    </Page>
  )
}
