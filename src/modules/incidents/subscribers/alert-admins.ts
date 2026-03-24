export const metadata = {
  event: 'incidents.report.created',
  persistent: true,
  id: 'incidents:alert-admins',
}

export default async function handler(
  payload: { incidentId: string; severity: string; competitionId: string; isAnonymous: boolean; tenantId: string; organizationId: string },
  _ctx: { resolve: <T = unknown>(name: string) => T },
) {
  // Only alert on HIGH or CRITICAL severity
  if (payload.severity !== 'high' && payload.severity !== 'critical') return

  console.log(
    `[incidents:alert-admins] HIGH/CRITICAL incident ${payload.incidentId} reported` +
    ` (severity: ${payload.severity}, anonymous: ${payload.isAnonymous}).` +
    ` Competition: ${payload.competitionId}. Admin notification should be sent.`,
  )

  // In production, this would create a notification for all admin users
  // via the notifications module. For now, the event emission + log serves
  // as the trigger point.
}
