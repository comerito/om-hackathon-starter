import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { lookupHashCandidates } from '@open-mercato/shared/lib/encryption/aes'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CustomerInvitationService } from '@open-mercato/core/modules/customer_accounts/services/customerInvitationService'
import { CustomerRole, CustomerUser, CustomerUserInvitation } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { Competition, CompetitionInvitation } from '../../../data/entities'
import { bulkInviteSchema } from '../../../data/validators'
import { sendInvitationEmail } from '../../../lib/sendInvitationEmail'
import {
  applyEmailOutcomes,
  summarizeInviteResults,
  INVITE_SKIP_REASONS,
  type EmailOutcome,
  type InviteResult,
} from '../../../lib/inviteOutcome'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { rawFirst } from '@/lib/db'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = bulkInviteSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const invitationService = container.resolve('customerInvitationService') as CustomerInvitationService

    const tenantId = auth.tenantId
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope.selectedId ?? auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Verify competition exists
    const competition = await em.findOne(Competition, {
      id: parsed.competition_id,
      tenantId,
      deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    // Resolve role slugs → UUIDs
    const uniqueRoles = [...new Set(parsed.invitees.map(i => i.role))]
    const roleMap = new Map<string, string>()
    for (const slug of uniqueRoles) {
      const role = await em.findOne(CustomerRole, {
        slug,
        tenantId,
        deletedAt: null,
      } as FilterQuery<typeof CustomerRole.prototype>)
      if (!role) {
        return NextResponse.json({ error: `Customer role "${slug}" not found. Run seed/initialize first.` }, { status: 400 })
      }
      roleMap.set(slug, role.id)
    }

    // Resolve org slug from the database
    const orgRow = await rawFirst<{ slug: string }>(
      em,
      `SELECT slug FROM organizations WHERE id = ? LIMIT 1`,
      [organizationId],
    )
    const orgSlug = orgRow?.slug ?? parsed.org_slug
    const origin = req.headers.get('origin') || `${req.headers.get('x-forwarded-proto') ?? 'http'}://${req.headers.get('host')}` || 'http://localhost:3000'
    const baseAcceptUrl = `${origin}/${orgSlug}/portal/accept-invite`

    // Process each invitee
    const results: InviteResult[] = []
    const emailsToSend: Array<{ to: string; competitionName: string; displayName: string; role: string; acceptUrl: string }> = []

    for (const invitee of parsed.invitees) {
      const emailLower = invitee.email.toLowerCase().trim()

      // Match BOTH lookup-hash formats. `hashForLookup` returns the keyed `v2:` digest once a
      // pepper/encryption key is configured, but rows written before that carry the legacy
      // unkeyed digest — a single-format `=` comparison silently misses them, which is exactly
      // how an existing portal user slipped past this guard (issue #93). Core's own
      // `CustomerUserService.findByEmail` uses the same `$in` candidate set.
      const emailHashCandidates = lookupHashCandidates(emailLower)
      // Belt and braces: `email` is an encrypted column with `email_hash` as its lookup hash,
      // so plaintext only matches on tenants that have not been seeded with encryption yet.
      // It never produces a false positive — an encrypted value simply will not compare equal.
      const emailMatch = { $or: [{ emailHash: { $in: emailHashCandidates } }, { email: emailLower }] }

      // Check if user already exists. An existing CustomerUser must NOT be invited: the
      // accept-invite flow CREATES an account, so the invitation would be un-acceptable.
      // The operator attaches the existing account via Add Participant instead.
      const existingUser = await findOneWithDecryption(
        em,
        CustomerUser,
        { ...emailMatch, tenantId, deletedAt: null } as FilterQuery<typeof CustomerUser.prototype>,
        undefined,
        { tenantId, organizationId },
      )
      if (existingUser) {
        results.push({
          email: emailLower,
          status: 'skipped',
          invitationCreated: false,
          reasonCode: 'user_already_exists',
          reason: INVITE_SKIP_REASONS.user_already_exists,
        })
        continue
      }

      // Check for pending invitation
      const existingInvitation = await em.findOne(CustomerUserInvitation, {
        ...emailMatch,
        tenantId,
        acceptedAt: null,
        cancelledAt: null,
      } as FilterQuery<typeof CustomerUserInvitation.prototype>)
      if (existingInvitation && existingInvitation.expiresAt.getTime() > Date.now()) {
        results.push({
          email: emailLower,
          status: 'skipped',
          invitationCreated: false,
          reasonCode: 'invitation_already_pending',
          reason: INVITE_SKIP_REASONS.invitation_already_pending,
        })
        continue
      }

      // Create invitation
      try {
        const roleId = roleMap.get(invitee.role)!
        const { invitation, rawToken } = await invitationService.createInvitation(
          emailLower,
          { tenantId, organizationId },
          {
            roleIds: [roleId],
            displayName: invitee.display_name,
            invitedByUserId: auth.sub,
          },
        )

        // Create competition invitation mapping
        const competitionInvitation = em.create(CompetitionInvitation, {
          customerInvitationId: invitation.id,
          competitionId: parsed.competition_id,
          participationRole: invitee.role,
          tenantId,
          organizationId,
          createdAt: new Date(),
        })
        em.persist(competitionInvitation)

        const acceptUrl = `${baseAcceptUrl}?token=${encodeURIComponent(rawToken)}`

        emailsToSend.push({
          to: emailLower,
          competitionName: competition.name,
          displayName: invitee.display_name,
          role: invitee.role,
          acceptUrl,
        })

        results.push({ email: emailLower, status: 'sent', invitationCreated: true })
      } catch (err) {
        results.push({
          email: emailLower,
          status: 'error',
          invitationCreated: false,
          reason: err instanceof Error ? err.message : 'Failed to create invitation',
        })
      }
    }

    // Flush (and therefore COMMIT) every invitation BEFORE any email is attempted.
    // From here on, email delivery is a separate outcome: it can fail without
    // invalidating the invitations that already exist in the database.
    await em.flush()

    // Send emails with concurrency limit (4 at a time, with 1s delay between batches)
    // Resend allows max 5 requests/second
    const CONCURRENCY = 4
    const BATCH_DELAY_MS = 1000
    const emailOutcomes: EmailOutcome[] = []
    for (let i = 0; i < emailsToSend.length; i += CONCURRENCY) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
      const batch = emailsToSend.slice(i, i + CONCURRENCY)
      const emailResults = await Promise.allSettled(
        batch.map(e => sendInvitationEmail(e)),
      )
      emailResults.forEach((result, idx) => {
        emailOutcomes.push(
          result.status === 'rejected'
            ? { email: batch[idx].to, ok: false, error: result.reason }
            : { email: batch[idx].to, ok: true },
        )
      })
    }

    // A rejected email downgrades the row to `created` (invited, not notified) — never `error`.
    const finalResults = applyEmailOutcomes(results, emailOutcomes)
    const summary = summarizeInviteResults(finalResults)

    return NextResponse.json({
      total: parsed.invitees.length,
      sent: summary.sent,
      created: summary.created,
      skipped: summary.skipped,
      failed: summary.failed,
      invitationsCreated: summary.invitationsCreated,
      existingUsers: summary.existingUsers,
      errors: summary.errors,
      emailFailures: summary.emailFailures,
      results: finalResults,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[admin/bulk-invite] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Bulk invite participants',
  methods: {
    POST: {
      summary:
        'Create invitations and send emails for multiple participants. Creation and email delivery are reported separately: per-row status is sent | created (invited, email failed) | skipped | error (nothing created). An address that already has a CustomerUser is skipped with reasonCode "user_already_exists" and listed in existingUsers — attach that account with Add Participant instead, an invitation would be un-acceptable.',
    },
  },
}
