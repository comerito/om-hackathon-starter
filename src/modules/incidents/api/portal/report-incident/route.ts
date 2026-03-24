import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { IncidentReport } from '../../../data/entities'
import { createIncidentSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = { POST: { requireCustomerAuth: true } }

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const parsed = createIncidentSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const now = new Date()

    const report = em.create(IncidentReport, {
      competitionId: parsed.competition_id,
      reporterId: parsed.anonymous ? null : auth.sub,
      reportedUserId: parsed.reported_user_id ?? null,
      description: parsed.description,
      severity: parsed.severity,
      status: 'reported' as const,
      tenantId: auth.tenantId!,
      organizationId: auth.orgId!,
      createdAt: now,
      updatedAt: now,
    })
    await em.persistAndFlush(report)

    // Emit event — for HIGH/CRITICAL, this triggers admin notification
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('incidents.report.created', {
        incidentId: report.id,
        severity: report.severity,
        competitionId: report.competitionId,
        isAnonymous: parsed.anonymous,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch (e) { console.error('[portal/report-incident] Event emit error:', e) }

    return NextResponse.json({ ok: true, incident_id: report.id })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    console.error('[portal/report-incident] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Report incident',
  methods: { POST: { summary: 'File an incident report (anonymous allowed)' } },
}
