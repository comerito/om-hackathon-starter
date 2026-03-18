import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

// ---------------------------------------------------------------------------
// IncidentReport
// ---------------------------------------------------------------------------

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

  @Enum({ items: () => IncidentSeverity, default: IncidentSeverity.MEDIUM })
  severity: IncidentSeverity = IncidentSeverity.MEDIUM

  @Enum({ items: () => IncidentStatus, default: IncidentStatus.REPORTED })
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

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
