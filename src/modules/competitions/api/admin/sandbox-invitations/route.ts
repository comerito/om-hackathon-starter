import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Competition, CompetitionParticipation } from '../../../data/entities'
import { sandboxInvitationSchema } from '../../../data/validators'
import {
  localStatusFromUpstream,
  readOmCrmSandboxInvitationConfig,
  sendOmCrmBulkCustomerInvitations,
  toOmCrmCustomers,
} from '../../../lib/omCrmSandboxInvitations'
import { skipAlreadySentParticipations } from '../../../lib/sandboxInvitations'

const PARTICIPATION_RESOURCE_KIND = 'competitions:competition_participation'

export const metadata = {
  POST: {
    requireAuth: true,
    requireFeatures: ['competitions.participants.manage'],
  },
}

type ParticipationRow = {
  id: string
  customerUserId: string
  mercatoSandboxesInvitedAt?: Date | null
}

type LocalItemStatus = 'sent' | 'conflict' | 'failed'

type LocalItemResult = {
  participation_id: string
  status: LocalItemStatus
}

function applyOrganizationScope<T extends Record<string, unknown>>(
  where: T,
  filterIds: string[] | null | undefined,
): T {
  if (filterIds && filterIds.length > 0) {
    return { ...where, organizationId: { $in: filterIds } }
  }
  return where
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function summarize(results: LocalItemResult[]): {
  sent: number
  conflicts: number
  failed: number
  status: 'complete' | 'partial'
} {
  const sent = results.filter((item) => item.status === 'sent').length
  const conflicts = results.filter((item) => item.status === 'conflict').length
  const failed = results.filter((item) => item.status === 'failed').length
  return {
    sent,
    conflicts,
    failed,
    status: failed === 0 && conflicts === 0 ? 'complete' : 'partial',
  }
}

function jsonResponse(results: LocalItemResult[]) {
  const summary = summarize(results)
  const ok = summary.status === 'complete'
  return NextResponse.json(
    {
      ok,
      status: summary.status,
      sent: summary.sent,
      conflicts: summary.conflicts,
      failed: summary.failed,
      results,
    },
    { status: ok ? 200 : 207 },
  )
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const requested = sandboxInvitationSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope.selectedId ?? auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    const tenantId = auth.tenantId
    const guard = await runRouteMutationGuards({
      container,
      req,
      auth: {
        userId: auth.sub,
        tenantId,
        organizationId,
      },
      input: {
        resourceKind: PARTICIPATION_RESOURCE_KIND,
        operation: 'update',
        mutationPayload: { ...requested },
      },
    })
    if (!guard.ok) return guard.response

    const parsed = guard.modifiedPayload
      ? sandboxInvitationSchema.parse({ ...requested, ...guard.modifiedPayload })
      : requested

    const competitionWhere = applyOrganizationScope(
      { id: parsed.competition_id, tenantId, deletedAt: null },
      scope.filterIds,
    )
    const competition = await em.findOne(
      Competition,
      competitionWhere as FilterQuery<Competition>,
    )
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const participationWhere = applyOrganizationScope(
      {
        competitionId: parsed.competition_id,
        tenantId,
        deletedAt: null,
      },
      scope.filterIds,
    )

    const ids = uniqueIds(parsed.selection.participation_ids)
    const found = await em.find(
      CompetitionParticipation,
      {
        ...participationWhere,
        id: { $in: ids },
      } as FilterQuery<CompetitionParticipation>,
    )
    if (found.length !== ids.length) {
      return NextResponse.json(
        { error: 'Some participants were not found in this competition' },
        { status: 400 },
      )
    }
    const byId = new Map(found.map((row) => [row.id, row]))
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => row != null)
    const participations: ParticipationRow[] = skipAlreadySentParticipations(ordered)

    if (participations.length === 0) {
      return NextResponse.json(
        { error: 'No unsent participants in this selection' },
        { status: 400 },
      )
    }

    const customerUserIds = uniqueIds(participations.map((row) => row.customerUserId))
    const users = customerUserIds.length > 0
      ? await findWithDecryption(
        em,
        CustomerUser,
        {
          id: { $in: customerUserIds },
          tenantId,
          deletedAt: null,
        } as FilterQuery<CustomerUser>,
        undefined,
        { tenantId, organizationId },
      )
      : []
    const usersById = new Map(users.map((user) => [user.id, user]))

    const results: Array<LocalItemResult | null> = participations.map(() => null)
    const inviteable: Array<{ participation: ParticipationRow; email: string; slot: number }> = []
    for (const [slot, participation] of participations.entries()) {
      const email = usersById.get(participation.customerUserId)?.email?.trim().toLowerCase() ?? ''
      if (!email) {
        results[slot] = { participation_id: participation.id, status: 'failed' }
        continue
      }
      inviteable.push({ participation, email, slot })
    }

    if (inviteable.length === 0) {
      return jsonResponse(results.filter((item): item is LocalItemResult => item !== null))
    }

    const config = readOmCrmSandboxInvitationConfig()
    if (!config.ok) {
      return NextResponse.json({ error: config.error }, { status: 503 })
    }

    const upstream = await sendOmCrmBulkCustomerInvitations(
      config.config,
      toOmCrmCustomers(inviteable.map((item) => item.email)),
    )
    if (!upstream.ok) {
      return NextResponse.json({ error: upstream.error }, { status: 502 })
    }

    const invitedAt = new Date()
    const byIndex = new Map(upstream.results.map((item) => [item.index, item]))
    for (const [index, item] of inviteable.entries()) {
      const outcome = byIndex.get(index)
      const status = outcome ? localStatusFromUpstream(outcome.invitationStatus) : 'failed'
      if (status === 'sent') {
        item.participation.mercatoSandboxesInvitedAt = invitedAt
      }
      results[item.slot] = { participation_id: item.participation.id, status }
    }

    await em.flush()
    try {
      await guard.runAfterSuccess()
    } catch {
      console.error('[admin/sandbox-invitations] mutation guard afterSuccess failed')
    }

    return jsonResponse(results.filter((item): item is LocalItemResult => item !== null))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[admin/sandbox-invitations] POST error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Invite competition participants to Mercato Sandboxes',
  methods: {
    POST: {
      summary:
        'Resolve selected tenant-scoped participants and send one om-crm bulk sandbox invitation request. Already-sent rows are skipped. Marks only accepted items as sent.',
    },
  },
}
