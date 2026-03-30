import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums (as string unions + const objects) ────────────────────────

export const TeamStatus = {
  ACTIVE: 'active',
  DISQUALIFIED: 'disqualified',
  WITHDRAWN: 'withdrawn',
} as const
export type TeamStatus = (typeof TeamStatus)[keyof typeof TeamStatus]

export const TeamRole = {
  OWNER: 'owner',
  MEMBER: 'member',
} as const
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole]

export const InvitationType = {
  INVITE: 'invite',
  JOIN_REQUEST: 'join_request',
} as const
export type InvitationType = (typeof InvitationType)[keyof typeof InvitationType]

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus]

// ── Entities ────────────────────────────────────────────────────────

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

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null

  @Property({ type: 'text', default: 'active' })
  status: TeamStatus = TeamStatus.ACTIVE

  @Property({ name: 'disqualification_reason', type: 'text', nullable: true })
  disqualificationReason?: string | null

  @Property({ name: 'disqualified_at', type: 'timestamptz', nullable: true })
  disqualifiedAt?: Date | null

  @Property({ name: 'disqualified_by', type: 'uuid', nullable: true })
  disqualifiedBy?: string | null

  @Property({ name: 'presentation_order', type: 'int', nullable: true })
  presentationOrder?: number | null

  @Property({ name: 'presentation_time_slot', type: 'timestamptz', nullable: true })
  presentationTimeSlot?: Date | null

  @Property({ name: 'is_finalist', type: 'boolean', default: false })
  isFinalist: boolean = false

  @Property({ name: 'table_number', type: 'int', nullable: true })
  tableNumber?: number | null

  @Property({ name: 'table_location', type: 'varchar', length: 255, nullable: true })
  tableLocation?: string | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

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

  @Property({ type: 'text', default: 'member' })
  role: TeamRole = TeamRole.MEMBER

  @Property({ type: 'varchar', length: 255, nullable: true })
  title?: string | null

  @Property({ name: 'joined_at', type: 'timestamptz', onCreate: () => new Date() })
  joinedAt: Date = new Date()

  @Property({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt?: Date | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

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

  @Property({ type: 'text', default: 'invite' })
  type: InvitationType = InvitationType.INVITE

  @Index()
  @Property({ type: 'text', default: 'pending' })
  status: InvitationStatus = InvitationStatus.PENDING

  @Property({ type: 'text', nullable: true })
  message?: string | null

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date | null

  @Property({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string
}

export const TeamResourceType = {
  FILE: 'file',
  LINK: 'link',
  REPOSITORY: 'repository',
} as const
export type TeamResourceType = (typeof TeamResourceType)[keyof typeof TeamResourceType]

@Entity({ tableName: 'teams_resource' })
export class TeamResource {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', default: 'link' })
  type: TeamResourceType = TeamResourceType.LINK

  @Property({ type: 'varchar', length: 1000, nullable: true })
  url?: string | null

  @Property({ name: 'file_id', type: 'uuid', nullable: true })
  fileId?: string | null

  @Property({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown> = {}

  @Property({ name: 'added_by', type: 'uuid' })
  addedBy!: string

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

// ── Team ↔ Track junction (M2M) ──────────────────────────────────

@Entity({ tableName: 'teams_team_track' })
@Unique({ properties: ['teamId', 'trackId'] })
export class TeamTrack {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Index()
  @Property({ name: 'track_id', type: 'uuid' })
  trackId!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()
}
