import type { AwilixContainer } from 'awilix'
import { invalidateCrudCache } from '@open-mercato/shared/lib/crud/cache'

type BountyCacheIdentifiers = {
  id?: string | null
  organizationId?: string | null
  tenantId?: string | null
}

const BOUNTY_PR_CACHE_ALIASES = ['bounties.prs']

export async function invalidateBountyPrCache(
  container: AwilixContainer,
  identifiers: BountyCacheIdentifiers,
  reason: string,
): Promise<void> {
  await invalidateCrudCache(
    container,
    'BountyPullRequest',
    identifiers,
    identifiers.tenantId ?? null,
    reason,
    BOUNTY_PR_CACHE_ALIASES,
  )
}
