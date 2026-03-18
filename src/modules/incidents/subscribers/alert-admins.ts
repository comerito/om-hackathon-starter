/**
 * Alert admins subscriber.
 *
 * When an incident report is created with HIGH or CRITICAL severity,
 * this subscriber sends an urgent notification to all admin users.
 */

export const metadata = {
  event: 'incidents.report.created',
  sync: false,
  priority: 10,
  id: 'incidents:alert-admins-on-high-severity',
}

interface IncidentCreatedPayload {
  id: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: IncidentCreatedPayload,
): Promise<void> {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Fetch the incident to check severity
    const incident = await knex('incidents_report')
      .where({
        id: payload.id,
        tenant_id: payload.tenantId,
        organization_id: payload.organizationId,
      })
      .select('id', 'severity', 'description', 'competition_id')
      .first()

    if (!incident) return

    const highSeverityLevels = ['HIGH', 'CRITICAL']
    if (!highSeverityLevels.includes(incident.severity)) return

    // Send notification to all admin users
    try {
      const notificationService = container.resolve('notificationService') as {
        sendToRole?: (params: {
          roleId: string
          tenantId: string
          organizationId: string
          notification: {
            typeId: string
            title: string
            body: string
            priority: string
            data?: Record<string, unknown>
          }
        }) => Promise<void>
      }

      if (typeof notificationService?.sendToRole === 'function') {
        const severityEmoji = incident.severity === 'CRITICAL' ? '[CRITICAL]' : '[HIGH]'
        const truncatedDesc = incident.description?.length > 200
          ? incident.description.slice(0, 200) + '...'
          : incident.description

        await notificationService.sendToRole({
          roleId: 'admin',
          tenantId: payload.tenantId,
          organizationId: payload.organizationId,
          notification: {
            typeId: 'incidents.high_severity',
            title: `${severityEmoji} Incident Reported`,
            body: truncatedDesc || 'A high-severity incident has been reported.',
            priority: 'urgent',
            data: {
              incidentId: incident.id,
              competitionId: incident.competition_id,
              severity: incident.severity,
            },
          },
        })
      }
    } catch (notifErr) {
      console.warn('[incidents] Failed to send admin notification', {
        incidentId: incident.id,
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      })
    }

    console.info('[incidents] High-severity incident alert sent to admins', {
      incidentId: incident.id,
      severity: incident.severity,
    })
  } catch (err) {
    console.warn('[incidents] Failed to process alert-admins subscriber', {
      incidentId: payload.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
