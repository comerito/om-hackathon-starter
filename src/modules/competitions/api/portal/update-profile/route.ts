import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ParticipantProfile } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = { GET: { requireCustomerAuth: true }, PUT: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const profile = await em.findOne(ParticipantProfile, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
    })

    return NextResponse.json({
      ok: true,
      profile: profile ? {
        id: profile.id,
        bio: profile.bio,
        organization: profile.organization,
        avatar_url: profile.avatarUrl,
        portfolio_url: profile.portfolioUrl,
        office_hours_url: profile.officeHoursUrl,
        specialty: profile.specialty,
        skills: profile.skills,
        social_links: profile.socialLinks,
        notification_preferences: profile.notificationPreferences,
      } : null,
    })
  } catch (error) {
    console.error('[portal/update-profile] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    let profile = await em.findOne(ParticipantProfile, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
    })

    if (!profile) {
      profile = new ParticipantProfile()
      profile.customerUserId = auth.sub
      profile.tenantId = auth.tenantId
      profile.organizationId = auth.orgId
      em.persist(profile)
    }

    // Update fields if provided
    if (body.bio !== undefined) profile.bio = body.bio
    if (body.organization !== undefined) profile.organization = body.organization
    if (body.skills !== undefined) profile.skills = body.skills
    if (body.social_links !== undefined) profile.socialLinks = body.social_links
    if (body.avatar_url !== undefined) profile.avatarUrl = body.avatar_url
    if (body.portfolio_url !== undefined) profile.portfolioUrl = body.portfolio_url
    if (body.office_hours_url !== undefined) profile.officeHoursUrl = body.office_hours_url
    if (body.specialty !== undefined) profile.specialty = body.specialty
    if (body.notification_preferences !== undefined) profile.notificationPreferences = body.notification_preferences

    await em.flush()

    return NextResponse.json({ ok: true, profile: {
      id: profile.id,
      bio: profile.bio,
      organization: profile.organization,
      avatar_url: profile.avatarUrl,
      portfolio_url: profile.portfolioUrl,
      office_hours_url: profile.officeHoursUrl,
      specialty: profile.specialty,
      skills: profile.skills,
      social_links: profile.socialLinks,
      notification_preferences: profile.notificationPreferences,
    }})
  } catch (error) {
    console.error('[portal/update-profile] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Update participant profile',
  methods: { PUT: { summary: 'Update current user participant profile (portal)' } },
}
