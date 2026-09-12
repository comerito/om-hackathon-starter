import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { JudgePanel } from '../../data/entities'
import { findEligibleJudgeIds } from '../../lib/judgeEligibility'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
}

// GET: customer users who may be added as judges to the given panel.
// Scoped to the judges of the panel's own competition — see lib/judgeEligibility.ts.
export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const panelId = url.searchParams.get('panel_id')
    if (!panelId) return NextResponse.json({ error: 'panel_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const panel = await em.findOne(JudgePanel, {
      id: panelId, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<JudgePanel>)
    if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

    const judgeIds = await findEligibleJudgeIds(em, {
      competitionId: panel.competitionId,
      tenantId: auth.tenantId,
    })
    if (!judgeIds.length) return NextResponse.json({ items: [] })

    // display_name / email are declared encryptable on customer_users, so they must be read
    // through findWithDecryption — a raw select would hand back ciphertext once a tenant has
    // encryption seeded.
    const users = await findWithDecryption(
      em,
      CustomerUser,
      { id: { $in: judgeIds }, tenantId: auth.tenantId, deletedAt: null } as FilterQuery<CustomerUser>,
      undefined,
      { tenantId: auth.tenantId, organizationId: auth.orgId ?? null },
    )
    const byId = new Map(users.map((u) => [u.id, u]))

    const items: Array<{ id: string; display_name: string; email: string | null; is_active: boolean }> = []
    for (const id of judgeIds) {
      const user = byId.get(id)
      if (!user) continue
      items.push({
        id: user.id,
        display_name: user.displayName || user.email || user.id.slice(0, 8),
        email: user.email ?? null,
        is_active: user.isActive,
      })
    }
    items.sort((a, b) => a.display_name.localeCompare(b.display_name))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[eligible-judges] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging',
  summary: 'Judges assignable to a panel',
  methods: {
    GET: { summary: "List customer users holding the judge role in the panel's competition" },
  },
}
