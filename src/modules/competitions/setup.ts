import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CustomerRole,
  CustomerRoleAcl,
} from '@open-mercato/core/modules/customer_accounts/data/entities'

interface SeedScope {
  tenantId: string
  organizationId: string
}

const HACKATHON_ROLES = [
  {
    name: 'Participant',
    slug: 'participant',
    description: 'Hackathon participant — can form teams, submit projects, and vote',
    isDefault: true,
    customerAssignable: true,
  },
  {
    name: 'Mentor',
    slug: 'mentor',
    description: 'Hackathon mentor — can view teams and projects, provide guidance',
    isDefault: false,
    customerAssignable: true,
  },
  {
    name: 'Judge',
    slug: 'judge',
    description: 'Hackathon judge — can score projects and view assigned submissions',
    isDefault: false,
    customerAssignable: true,
  },
]

async function seedHackathonRoles(em: EntityManager, scope: SeedScope): Promise<void> {
  // Flip the core "buyer" role's isDefault to false so "participant" becomes the default
  const buyerRole = await em.findOne(CustomerRole, {
    tenantId: scope.tenantId,
    slug: 'buyer',
    deletedAt: null,
  })
  if (buyerRole && buyerRole.isDefault) {
    buyerRole.isDefault = false
    em.persist(buyerRole)
  }

  for (const roleDef of HACKATHON_ROLES) {
    const existing = await em.findOne(CustomerRole, {
      tenantId: scope.tenantId,
      slug: roleDef.slug,
      deletedAt: null,
    })
    if (existing) continue

    const role = em.create(CustomerRole, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      name: roleDef.name,
      slug: roleDef.slug,
      description: roleDef.description,
      isSystem: true,
      customerAssignable: roleDef.customerAssignable,
      isDefault: roleDef.isDefault,
      createdAt: new Date(),
    } as any)
    em.persist(role)

    const acl = em.create(CustomerRoleAcl, {
      role,
      tenantId: scope.tenantId,
      featuresJson: [],
      isPortalAdmin: false,
      createdAt: new Date(),
    } as any)
    em.persist(acl)
  }
  await em.flush()
}

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'competitions.view', 'competitions.create', 'competitions.edit', 'competitions.delete',
      'competitions.stages.manage', 'competitions.agenda.manage', 'competitions.announcements.manage',
      'competitions.participants.manage', 'competitions.checkin.manage',
    ],
    admin: [
      'competitions.view', 'competitions.create', 'competitions.edit', 'competitions.delete',
      'competitions.stages.manage', 'competitions.agenda.manage', 'competitions.announcements.manage',
      'competitions.participants.manage', 'competitions.checkin.manage',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
    mentor: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
    judge: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
  },

  async onTenantCreated({ em, tenantId, organizationId }) {
    await seedHackathonRoles(em, { tenantId, organizationId })
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    await seedHackathonRoles(em, { tenantId, organizationId })
  },
}

export default setup
