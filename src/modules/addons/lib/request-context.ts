import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getSelectedOrganizationFromRequest, resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { enabledModules } from '@/modules'
import { uuidSchema } from '../data/validators'
import { AddonError } from './errors'

export type AddonRequestContext = { em: EntityManager; container: AwilixContainer; req: Request; tenantId: string; organizationId: string; userId: string; userFeatures: string[] }
export const addonReadFeatures = ['addons.view', 'competitions.participants.manage']
export const addonWriteFeatures = [...addonReadFeatures, 'addons.send']

export async function resolveAddonContext(req: Request, write = false): Promise<AddonRequestContext> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.sub || !auth.tenantId || auth.isApiKey || auth.type === 'customer') throw new AddonError('unauthorized', 401)
  if (!['competitions', 'customer_accounts'].every((id) => enabledModules.some((entry) => entry.id === id))) throw new AddonError('dependency_unavailable', 503)
  // An auth default organization does not constitute an explicit operator selection.
  const selected = uuidSchema.safeParse(getSelectedOrganizationFromRequest(req))
  if (!selected.success) throw new AddonError('organization_required', 400)
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req, selectedId: selected.data, tenantId: auth.tenantId })
  if (scope.selectionRejected || scope.selectedId !== selected.data || scope.tenantId !== auth.tenantId || (scope.allowedIds !== null && !scope.allowedIds.includes(selected.data))) throw new AddonError('forbidden', 403)
  const rbac = container.resolve<RbacService>('rbacService')
  const featureScope = { tenantId: auth.tenantId, organizationId: selected.data }
  if (!await rbac.userHasAllFeatures(auth.sub, write ? addonWriteFeatures : addonReadFeatures, featureScope)) throw new AddonError('forbidden', 403)
  const userFeatures = await rbac.getGrantedFeatures(auth.sub, featureScope)
  return { em: container.resolve<EntityManager>('em'), container, req, tenantId: auth.tenantId, organizationId: selected.data, userId: auth.sub, userFeatures }
}
