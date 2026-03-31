import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CustomerInvitationService } from '@open-mercato/core/modules/customer_accounts/services/customerInvitationService'
import { Competition, CompetitionInvitation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = {
  GET: {},
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'token parameter required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const invitationService = container.resolve('customerInvitationService') as CustomerInvitationService
    const locale = await resolvePortalLocale(req, { container })

    // Validate token
    const invitation = await invitationService.findByToken(token)
    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
    }

    // Look up competition invitation metadata
    const competitionInvitation = await em.findOne(CompetitionInvitation, {
      customerInvitationId: invitation.id,
    } as FilterQuery<CompetitionInvitation>)

    let competitionName: string | null = null
    let role: string | null = null

    if (competitionInvitation) {
      const competition = await em.findOne(Competition, {
        id: competitionInvitation.competitionId,
        deletedAt: null,
      } as FilterQuery<Competition>)
      const [translatedCompetition] = competition ? await applyPortalTranslationOverlays([{
        id: competition.id,
        name: competition.name,
      }], {
        entityType: 'competitions:competition',
        locale,
        tenantId: competition.tenantId,
        organizationId: competition.organizationId,
        container,
      }) : []
      competitionName = translatedCompetition?.name ?? competition?.name ?? null
      role = competitionInvitation.participationRole
    }

    // Mask email for privacy (show first 2 chars + domain)
    const email = invitation.email
    const [local, domain] = email.split('@')
    const maskedEmail = local.length > 2
      ? `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 6))}@${domain}`
      : `${local}@${domain}`

    return NextResponse.json({
      display_name: invitation.displayName ?? null,
      email_masked: maskedEmail,
      competition_name: competitionName,
      role,
      expires_at: invitation.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[portal/invite-info] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Invitation info (portal)',
  methods: { GET: { summary: 'Get public info about an invitation by token' } },
}
