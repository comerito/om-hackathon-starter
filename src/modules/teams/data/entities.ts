import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TeamStatus {
  ACTIVE = 'ACTIVE',
  DISQUALIFIED = 'DISQUALIFIED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum TeamRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum InvitationType {
  INVITE = 'INVITE',
  JOIN_REQUEST = 'JOIN_REQUEST',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

@Entity({ tableName: 'teams_team' })
export class Team {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string | null

  @Index()
  @Enum({ items: () => TeamStatus, default: TeamStatus.ACTIVE })
  status: TeamStatus = TeamStatus.ACTIVE

  @Property({ name: 'disqualification_reason', type: 'text', nullable: true })
  disqualificationReason?: string | null

  @Property({ name: 'disqualified_at', type: 'timestamptz', nullable: true })
  disqualifiedAt?: Date | null

  @Property({ name: 'disqualified_by', type: 'uuid', nullable: true })
  disqualifiedBy?: string | null

  @Property({ name: 'presentation_order', type: 'integer', nullable: true })
  presentationOrder?: number | null

  @Property({ name: 'presentation_time_slot', type: 'timestamptz', nullable: true })
  presentationTimeSlot?: Date | null

  @Property({ name: 'is_finalist', type: 'boolean', default: false })
  isFinalist: boolean = false

  @Property({ name: 'table_number', type: 'integer', nullable: true })
  tableNumber?: number | null

  @Property({ name: 'table_location', type: 'text', nullable: true })
  tableLocation?: string | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

// ---------------------------------------------------------------------------
// TeamMember
// ---------------------------------------------------------------------------

@Entity({ tableName: 'teams_team_member' })
@Unique({ properties: ['competitionId', 'customerUserId'] })
export class TeamMember {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Index()
  @Property({ name: 'customer_user_id', type: 'uuid' })
  customerUserId!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Enum({ items: () => TeamRole, default: TeamRole.MEMBER })
  role: TeamRole = TeamRole.MEMBER

  @Property({ name: 'joined_at', type: 'timestamptz', onCreate: () => new Date() })
  joinedAt: Date = new Date()

  @Property({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt?: Date | null

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}

// ---------------------------------------------------------------------------
// TeamInvitation
// ---------------------------------------------------------------------------

@Entity({ tableName: 'teams_invitation' })
export class TeamInvitation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Property({ name: 'inviter_id', type: 'uuid' })
  inviterId!: string

  @Index()
  @Property({ name: 'invitee_id', type: 'uuid' })
  inviteeId!: string

  @Enum({ items: () => InvitationType, default: InvitationType.INVITE })
  type: InvitationType = InvitationType.INVITE

  @Index()
  @Enum({ items: () => InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus = InvitationStatus.PENDING

  @Property({ type: 'text', nullable: true })
  message?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date | null

  @Property({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}
