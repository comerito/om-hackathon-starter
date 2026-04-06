import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ParticipantProfile, CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ALLOWED_SKILLS = new Set([
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'Swift',
  'Kotlin', 'PHP', 'SQL', 'HTML/CSS', 'Solidity',
  'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot',
  'React Native', 'Flutter', 'iOS Development', 'Android Development',
  'REST APIs', 'GraphQL', 'WebSockets',
  'PostgreSQL', 'MongoDB', 'Redis', 'Firebase',
  'AWS', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes', 'CI/CD',
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'LLM/AI Agents',
  'Data Analysis', 'Data Visualization', 'Data Engineering',
  'Blockchain', 'Smart Contracts', 'Web3',
  'Software Architecture', 'System Design', 'API Design', 'Microservices',
  'UI/UX Design', 'Figma', 'Graphic Design', 'Prototyping', 'User Research',
  'Interaction Design', 'Design Systems', 'Accessibility',
  'Manual Testing', 'Test Automation', 'Performance Testing', 'Security Testing',
  'Product Management', 'Project Management', 'Agile/Scrum', 'Technical Writing',
  'Public Speaking', 'Pitch/Presentation', 'Business Strategy', 'Marketing',
  'Cybersecurity', 'DevOps', 'Embedded Systems', 'IoT',
])
const MAX_SKILLS = 10

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

    // Also fetch github_username from participation record
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
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
        github_username: participation?.githubUsername ?? null,
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
    if (body.skills !== undefined) {
      if (!Array.isArray(body.skills)) return NextResponse.json({ error: 'skills must be an array' }, { status: 422 })
      if (body.skills.length > MAX_SKILLS) return NextResponse.json({ error: `Maximum ${MAX_SKILLS} skills allowed` }, { status: 422 })
      const invalid = body.skills.filter((s: unknown) => typeof s !== 'string' || !ALLOWED_SKILLS.has(s))
      if (invalid.length > 0) return NextResponse.json({ error: 'Invalid skills: ' + invalid.join(', ') }, { status: 422 })
      profile.skills = body.skills
    }
    if (body.social_links !== undefined) profile.socialLinks = body.social_links
    if (body.avatar_url !== undefined) profile.avatarUrl = body.avatar_url
    if (body.portfolio_url !== undefined) profile.portfolioUrl = body.portfolio_url
    if (body.office_hours_url !== undefined) profile.officeHoursUrl = body.office_hours_url
    if (body.specialty !== undefined) profile.specialty = body.specialty
    if (body.notification_preferences !== undefined) profile.notificationPreferences = body.notification_preferences

    // Update github_username on participation record
    if (body.github_username !== undefined) {
      const participation = await em.findOne(CompetitionParticipation, {
        customerUserId: auth.sub,
        tenantId: auth.tenantId,
        deletedAt: null,
      })
      if (participation) {
        participation.githubUsername = body.github_username || null
      }
    }

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
      github_username: body.github_username ?? null,
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
