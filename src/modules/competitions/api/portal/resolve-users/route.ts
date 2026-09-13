import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CompetitionParticipation } from '../../../data/entities'
import {
  normalizeRequestedUserIds,
  selectVisibleUserIds,
} from '../../../lib/portalUserVisibility'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const requestedIds = normalizeRequestedUserIds(url.searchParams.get('ids'))
    if (requestedIds.length === 0) {
      return NextResponse.json({ users: {} })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Which competitions does the caller belong to? That set — not the tenant — is the caller's
    // visibility horizon.
    const myParticipations = await em.find(CompetitionParticipation, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    const callerCompetitionIds = [...new Set(myParticipations.map((p) => p.competitionId))]

    // Of the requested ids, which participate in one of those competitions?
    const candidateParticipations = callerCompetitionIds.length
      ? await em.find(CompetitionParticipation, {
          competitionId: { $in: callerCompetitionIds },
          customerUserId: { $in: requestedIds },
          tenantId: auth.tenantId,
          deletedAt: null,
        } as FilterQuery<CompetitionParticipation>)
      : []

    const visibleIds = selectVisibleUserIds({
      requestedIds,
      callerUserId: auth.sub,
      callerCompetitionIds,
      candidateParticipations,
    })
    if (visibleIds.length === 0) {
      return NextResponse.json({ users: {} })
    }

    // `customer_users.display_name` / `.email` are declared encrypted
    // (`customer_accounts/encryption.ts`), so they must be read through the ORM's decryption
    // helper — raw SQL returns ciphertext wherever tenant encryption is active.
    const rows = await findWithDecryption(
      em,
      CustomerUser,
      {
        id: { $in: visibleIds },
        tenantId: auth.tenantId,
        deletedAt: null,
      } as FilterQuery<CustomerUser>,
      undefined,
      { tenantId: auth.tenantId, organizationId: auth.orgId },
    )

    // Display names only. This endpoint exists to label chat threads and member lists; nothing in
    // the portal consumes the email, and a contact address is not something one attendee is owed
    // about another. The local-part fallback for users with no display name matches the
    // participants directory (`portal/participants`) and carries no domain.
    const users: Record<string, { displayName: string }> = {}
    for (const row of rows) {
      users[row.id] = {
        displayName: row.displayName || row.email?.split('@')[0] || 'Unknown',
      }
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[portal/resolve-users] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Resolve user names',
  methods: {
    GET: {
      summary:
        'Resolve customer user IDs to display names, limited to users who share a competition with the caller',
    },
  },
}
