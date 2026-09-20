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
import { thankYouEmailSchema } from '../../../data/validators'
import { sendThankYouEmail } from '../../../lib/sendThankYouEmail'
import {
  THANK_YOU_EMAIL_BATCH_DELAY_MS,
  THANK_YOU_EMAIL_CONCURRENCY,
  skipAlreadyThankedParticipations,
  type ThankYouEmailItemResult,
} from '../../../lib/thankYouEmails'

const PARTICIPATION_RESOURCE_KIND = 'competitions:competition_participation'

export const metadata = {
  POST: {
    requireAuth: true,
    requireFeatures: ['competitions.participants.manage'],
  },
}

type LocalItemResult = ThankYouEmailItemResult

function applyOrganizationScope<T extends Record<string, unknown>>(
  where: T,
  filterIds: string[] | null | undefined,
): T {
  if (filterIds && filterIds.length > 0) {
    return { ...where, organizationId: { $in: filterIds } }
  }
  return where
}

function jsonResponse(results: LocalItemResult[]) {
  const sent = results.filter((item) => item.status === 'sent').length
  const failed = results.filter((item) => item.status === 'failed').length
  const skipped = results.filter((item) => item.status === 'skipped').length
  const ok = failed === 0
  return NextResponse.json(
    { ok, status: ok ? 'complete' : 'partial', sent, failed, skipped, results },
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
    const requested = thankYouEmailSchema.parse(body)
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
      ? thankYouEmailSchema.parse({ ...requested, ...guard.modifiedPayload })
      : requested

    const competition = await em.findOne(
      Competition,
      applyOrganizationScope(
        { id: parsed.competition_id, tenantId, deletedAt: null },
        scope.filterIds,
      ) as FilterQuery<Competition>,
    )
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const ids = [...new Set(parsed.selection.participation_ids)]
    const found = await em.find(
      CompetitionParticipation,
      applyOrganizationScope(
        { competitionId: parsed.competition_id, tenantId, deletedAt: null, id: { $in: ids } },
        scope.filterIds,
      ) as FilterQuery<CompetitionParticipation>,
    )
    if (found.length !== ids.length) {
      return NextResponse.json(
        { error: 'Some participants were not found in this competition' },
        { status: 400 },
      )
    }
    const byId = new Map(found.map((row) => [row.id, row]))
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => row != null)
    const participations = skipAlreadyThankedParticipations(ordered)

    // Already-thanked rows are reported, not rejected: the backoffice retries a chunk whose
    // response was lost, and that retry must be a harmless no-op rather than an error.
    const unsentIds = new Set(participations.map((row) => row.id))
    const results: LocalItemResult[] = ordered
      .filter((row) => !unsentIds.has(row.id))
      .map((row) => ({ participation_id: row.id, status: 'skipped' }))

    if (participations.length === 0) return jsonResponse(results)

    const customerUserIds = [...new Set(participations.map((row) => row.customerUserId))]
    const users = await findWithDecryption(
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
    const usersById = new Map(users.map((user) => [user.id, user]))

    const sendable: Array<{ participation: (typeof participations)[number]; email: string; displayName: string }> = []
    for (const participation of participations) {
      const user = usersById.get(participation.customerUserId)
      const email = user?.email?.trim().toLowerCase() ?? ''
      if (!email) {
        results.push({ participation_id: participation.id, status: 'failed' })
        continue
      }
      sendable.push({
        participation,
        email,
        displayName: user?.displayName?.trim() || email.split('@')[0],
      })
    }

    for (let i = 0; i < sendable.length; i += THANK_YOU_EMAIL_CONCURRENCY) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, THANK_YOU_EMAIL_BATCH_DELAY_MS))
      }
      const batch = sendable.slice(i, i + THANK_YOU_EMAIL_CONCURRENCY)
      const outcomes = await Promise.allSettled(
        batch.map((item) =>
          sendThankYouEmail({
            to: item.email,
            competitionName: competition.name,
            displayName: item.displayName,
            photosUrl: parsed.photos_url,
          }),
        ),
      )
      const sentAt = new Date()
      outcomes.forEach((outcome, idx) => {
        const item = batch[idx]
        if (outcome.status === 'fulfilled') {
          item.participation.thankYouEmailSentAt = sentAt
          results.push({ participation_id: item.participation.id, status: 'sent' })
        } else {
          console.error('[admin/thank-you-emails] email delivery failed for participation', item.participation.id)
          results.push({ participation_id: item.participation.id, status: 'failed' })
        }
      })
      // Flush per batch: an email that already left must stay marked even if a later
      // batch (or the request itself) dies, otherwise a retry would send it twice.
      await em.flush()
    }

    try {
      await guard.runAfterSuccess()
    } catch {
      console.error('[admin/thank-you-emails] mutation guard afterSuccess failed')
    }

    return jsonResponse(results)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[admin/thank-you-emails] POST error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Send the post-event thank-you email to selected participants',
  methods: {
    POST: {
      summary:
        'Resolve selected tenant-scoped participants and email each one a thank-you message with the event photos link. Already-thanked rows are reported as skipped and never emailed again, so a retried request is idempotent. Marks only delivered items as sent; answers 207 when some deliveries failed. Callers should send small chunks rather than one long-running request.',
    },
  },
}
