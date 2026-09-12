import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { lookupHashCandidates } from '@open-mercato/shared/lib/encryption/aes'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation, ParticipationRole } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  PARTICIPANT_SEARCH_RESULT_LIMIT,
  maskEmail,
  matchesParticipantNamePrefix,
  parseParticipantSearchQuery,
} from '../../../lib/participantSearch'

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
    const competitionId = url.searchParams.get('competition_id')
    const query = parseParticipantSearchQuery(url.searchParams.get('q'))

    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }
    if (query.kind === 'too-short') {
      return NextResponse.json({ items: [] })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // The caller may only search a competition they themselves attend — the same check
    // `portal/participants` makes before listing a roster.
    const myParticipation = await em.findOne(CompetitionParticipation, {
      competitionId,
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!myParticipation) {
      return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    }

    // Only fellow participants are searchable. The single consumer of this endpoint is the team
    // invite form, and `teams/portal/invite-member` refuses anyone whose participation role is not
    // `participant` — so surfacing judges and mentors here disclosed their details for an action
    // the caller could never complete.
    const participations = await em.find(CompetitionParticipation, {
      competitionId,
      role: ParticipationRole.PARTICIPANT,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    const participantUserIds = [...new Set(participations.map((p) => p.customerUserId))]
    if (participantUserIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // `customer_users.display_name` / `.email` are declared encrypted
    // (`customer_accounts/encryption.ts`), so both branches read through the ORM's decryption
    // helper rather than raw SQL — an ILIKE against an encrypted column matches ciphertext.
    const decryptionScope = { tenantId: auth.tenantId, organizationId: auth.orgId }
    const rosterFilter = {
      id: { $in: participantUserIds },
      tenantId: auth.tenantId,
      deletedAt: null,
    }

    let matches
    if (query.kind === 'email') {
      // Exact address: resolved through the deterministic `email_hash` column — the same lookup
      // `CustomerUserService.findByEmail` uses for login. The hash is an equality match by
      // construction, so no fragment can ever reach the database, and it keeps working while the
      // column holds a mix of legacy and keyed (`v2:`) digests.
      matches = await findWithDecryption(
        em,
        CustomerUser,
        {
          ...rosterFilter,
          emailHash: { $in: lookupHashCandidates(query.email) },
        } as FilterQuery<CustomerUser>,
        undefined,
        decryptionScope,
      )
    } else {
      // Name prefix: matching has to happen on the decrypted value, so the (competition-bounded)
      // roster is loaded and filtered in memory. `portal/participants` already loads the same
      // roster to render the directory.
      const roster = await findWithDecryption(
        em,
        CustomerUser,
        rosterFilter as FilterQuery<CustomerUser>,
        undefined,
        decryptionScope,
      )
      matches = roster.filter((user) => matchesParticipantNamePrefix(user, query.prefix))
    }

    const items = matches.slice(0, PARTICIPANT_SEARCH_RESULT_LIMIT).map((user) => ({
      id: user.id,
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
      // Masked, never the full address: the invite flow only needs enough to tell two people
      // with the same name apart.
      maskedEmail: maskEmail(user.email),
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[portal/search-participants] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Search participants',
  methods: {
    GET: {
      summary:
        'Find a participant of one of the caller\'s own competitions by exact email or name prefix (returns masked emails)',
    },
  },
}
