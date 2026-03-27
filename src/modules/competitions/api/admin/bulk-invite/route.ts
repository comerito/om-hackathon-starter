import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { sendEmail } from '@open-mercato/shared/lib/email/send'
import { hashForLookup } from '@open-mercato/shared/lib/encryption/aes'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CustomerInvitationService } from '@open-mercato/core/modules/customer_accounts/services/customerInvitationService'
import { CustomerRole, CustomerUser, CustomerUserInvitation } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { Competition, CompetitionInvitation } from '../../../data/entities'
import { bulkInviteSchema } from '../../../data/validators'
import { InvitationEmail } from '../../../emails/InvitationEmail'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

type InviteResult = {
  email: string
  status: 'sent' | 'skipped' | 'error'
  reason?: string
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
    const orgRow = await em.getConnection().execute(
      `SELECT slug FROM organizations WHERE id = ? LIMIT 1`,
      [organizationId],
    )
    const orgSlug = (orgRow as Array<{ slug: string }>)[0]?.slug ?? parsed.org_slug
    const origin = req.headers.get('origin') || `${req.headers.get('x-forwarded-proto') ?? 'http'}://${req.headers.get('host')}` || 'http://localhost:3000'
    const baseAcceptUrl = `${origin}/${orgSlug}/portal/accept-invite`

    // Process each invitee
    const results: InviteResult[] = []
    const emailsToSend: Array<{ to: string; subject: string; react: React.ReactElement }> = []

    for (const invitee of parsed.invitees) {
      const emailLower = invitee.email.toLowerCase().trim()

      // Check if user already exists
      const emailHash = hashForLookup(emailLower)
      const existingUser = await em.findOne(CustomerUser, {
        emailHash,
        tenantId,
        deletedAt: null,
      } as FilterQuery<typeof CustomerUser.prototype>)
      if (existingUser) {
        results.push({ email: emailLower, status: 'skipped', reason: 'User already exists' })
        continue
      }

      // Check for pending invitation
      const existingInvitation = await em.findOne(CustomerUserInvitation, {
        emailHash,
        tenantId,
        acceptedAt: null,
        cancelledAt: null,
      } as FilterQuery<typeof CustomerUserInvitation.prototype>)
      if (existingInvitation && existingInvitation.expiresAt.getTime() > Date.now()) {
        results.push({ email: emailLower, status: 'skipped', reason: 'Invitation already pending' })
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
          subject: `You're invited to ${competition.name}`,
          react: InvitationEmail({
            competitionName: competition.name,
            displayName: invitee.display_name,
            role: invitee.role,
            acceptUrl,
          }) as React.ReactElement,
        })

        results.push({ email: emailLower, status: 'sent' })
      } catch (err) {
        results.push({ email: emailLower, status: 'error', reason: err instanceof Error ? err.message : 'Failed to create invitation' })
      }
    }

    // Flush all competition invitation records
    await em.flush()

    // Send emails with concurrency limit (10 at a time)
    const CONCURRENCY = 10
    for (let i = 0; i < emailsToSend.length; i += CONCURRENCY) {
      const batch = emailsToSend.slice(i, i + CONCURRENCY)
      const emailResults = await Promise.allSettled(
        batch.map(e => sendEmail(e)),
      )
      // Mark failures
      emailResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          const email = batch[idx].to
          const existingResult = results.find(r => r.email === email)
          if (existingResult) {
            existingResult.status = 'error'
            existingResult.reason = `Email send failed: ${result.reason}`
          }
        }
      })
    }

    const sent = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error')

    return NextResponse.json({
      total: parsed.invitees.length,
      sent,
      skipped,
      errors: errors.map(e => ({ email: e.email, reason: e.reason })),
      results,
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
  methods: { POST: { summary: 'Create invitations and send emails for multiple participants from CSV' } },
}
