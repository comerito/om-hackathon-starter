import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core'

export const IncidentSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity]

export const IncidentStatus = {
  REPORTED: 'reported',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus]

@Entity({ tableName: 'incidents_report' })
export class IncidentReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'reporter_id', type: 'uuid', nullable: true })
  reporterId?: string | null

  @Property({ name: 'reported_user_id', type: 'uuid', nullable: true })
  reportedUserId?: string | null

  @Property({ type: 'text' })
  description!: string

  @Index()
  @Property({ type: 'text', default: 'low' })
  severity: IncidentSeverity = IncidentSeverity.LOW

  @Index()
  @Property({ type: 'text', default: 'reported' })
  status: IncidentStatus = IncidentStatus.REPORTED

  @Property({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes?: string | null

  @Property({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null

  @Property({ name: 'resolution_description', type: 'text', nullable: true })
  resolutionDescription?: string | null

  @Property({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
