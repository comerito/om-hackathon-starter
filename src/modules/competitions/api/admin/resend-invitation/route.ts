import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CustomerInvitationService } from '@open-mercato/core/modules/customer_accounts/services/customerInvitationService'
import { CustomerUserInvitation } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { Competition, CompetitionInvitation } from '../../../data/entities'
import { sendInvitationEmail } from '../../../lib/sendInvitationEmail'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const schema = z.object({
  competition_invitation_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const invitationService = container.resolve('customerInvitationService') as CustomerInvitationService

    // Load competition invitation
    const compInvite = await em.findOne(CompetitionInvitation, {
      id: parsed.competition_invitation_id,
      tenantId: auth.tenantId,
    } as FilterQuery<CompetitionInvitation>)
    if (!compInvite) {
      return NextResponse.json({ error: 'Competition invitation not found' }, { status: 404 })
    }

    // Load the framework invitation
    const invitation = await em.findOne(CustomerUserInvitation, {
      id: compInvite.customerInvitationId,
    } as FilterQuery<CustomerUserInvitation>)
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation record not found' }, { status: 404 })
    }

    // If already accepted, can't resend
    if (invitation.acceptedAt) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    // Load competition for name
    const competition = await em.findOne(Competition, {
      id: compInvite.competitionId,
      deletedAt: null,
    } as FilterQuery<Competition>)

    // If expired or cancelled, create a new invitation
    const isExpired = invitation.expiresAt.getTime() < Date.now()
    const isCancelled = !!invitation.cancelledAt
    let rawToken: string

    if (isExpired || isCancelled) {
      // Cancel old one
      if (!invitation.cancelledAt) {
        invitation.cancelledAt = new Date()
        em.persist(invitation)
      }

      // Create new invitation
      const organizationId = auth.orgId!
      const result = await invitationService.createInvitation(
        invitation.email,
        { tenantId: auth.tenantId, organizationId },
        {
          roleIds: invitation.roleIdsJson ?? [],
          displayName: invitation.displayName,
          invitedByUserId: auth.sub,
        },
      )
      rawToken = result.rawToken

      // Update competition invitation to point to new framework invitation
      compInvite.customerInvitationId = result.invitation.id
      em.persist(compInvite)
      await em.flush()
    } else {
      // Still valid — we need the raw token, but we can't recover it (it's hashed).
      // Create a fresh invitation and cancel the old one
      if (!invitation.cancelledAt) {
        invitation.cancelledAt = new Date()
        em.persist(invitation)
      }

      const organizationId = auth.orgId!
      const result = await invitationService.createInvitation(
        invitation.email,
        { tenantId: auth.tenantId, organizationId },
        {
          roleIds: invitation.roleIdsJson ?? [],
          displayName: invitation.displayName,
          invitedByUserId: auth.sub,
        },
      )
      rawToken = result.rawToken

      compInvite.customerInvitationId = result.invitation.id
      em.persist(compInvite)
      await em.flush()
    }

    // Build accept URL
    const orgRow = await em.getConnection().execute(
      `SELECT slug FROM organizations WHERE id = ? LIMIT 1`,
      [auth.orgId],
    )
    const orgSlug = (orgRow as Array<{ slug: string }>)[0]?.slug ?? 'default'
    const origin = req.headers.get('origin') || `${req.headers.get('x-forwarded-proto') ?? 'http'}://${req.headers.get('host')}` || 'http://localhost:3000'
    const acceptUrl = `${origin}/${orgSlug}/portal/accept-invite?token=${encodeURIComponent(rawToken)}`

    // Send email
    await sendInvitationEmail({
      to: invitation.email,
      competitionName: competition?.name ?? 'Hackathon',
      displayName: invitation.displayName ?? invitation.email.split('@')[0],
      role: compInvite.participationRole,
      acceptUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[admin/resend-invitation] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Resend invitation',
  methods: { POST: { summary: 'Resend or regenerate an invitation email' } },
}
