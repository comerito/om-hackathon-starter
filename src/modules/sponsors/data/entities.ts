import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums ────────────────────────────────────────────────────────

export const SponsorTier = {
  TITLE: 'title',
  GOLD: 'gold',
  SILVER: 'silver',
  PARTNER: 'partner',
  IN_KIND: 'in_kind',
} as const
export type SponsorTier = (typeof SponsorTier)[keyof typeof SponsorTier]

export const PrizeCategory = {
  TRACK_PLACEMENT: 'track_placement',
  SPECIAL_AWARD: 'special_award',
  SPONSOR_PRIZE: 'sponsor_prize',
  PEOPLES_CHOICE: 'peoples_choice',
} as const
export type PrizeCategory = (typeof PrizeCategory)[keyof typeof PrizeCategory]

// ── Entities ────────────────────────────────────────────────────────

@Entity({ tableName: 'sponsors_sponsor' })
export class Sponsor {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', default: 'partner' })
  tier: SponsorTier = SponsorTier.PARTNER

  @Property({ name: 'logo_url', type: 'varchar', length: 1000 })
  logoUrl!: string

  @Property({ name: 'website_url', type: 'varchar', length: 1000, nullable: true })
  websiteUrl?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  // Sponsor challenge (optional)
  @Property({ name: 'challenge_title', type: 'varchar', length: 255, nullable: true })
  challengeTitle?: string | null

  @Property({ name: 'challenge_description', type: 'text', nullable: true })
  challengeDescription?: string | null

  @Property({ name: 'challenge_resources_url', type: 'varchar', length: 1000, nullable: true })
  challengeResourcesUrl?: string | null

  // Contact
  @Property({ name: 'contact_name', type: 'varchar', length: 255, nullable: true })
  contactName?: string | null

  @Property({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string | null

  // Display
  @Property({ type: 'int', default: 0 })
  order: number = 0

  @Property({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean = true

  // Multi-tenancy
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

@Entity({ tableName: 'sponsors_prize' })
export class Prize {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', default: 'special_award' })
  category: PrizeCategory = PrizeCategory.SPECIAL_AWARD

  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Property({ name: 'sponsor_id', type: 'uuid', nullable: true })
  sponsorId?: string | null

  @Property({ type: 'varchar', length: 255, nullable: true })
  value?: string | null

  @Property({ type: 'int', nullable: true })
  rank?: number | null

  @Property({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl?: string | null

  // Award (set by admin after judging)
  @Property({ name: 'winning_project_id', type: 'uuid', nullable: true })
  winningProjectId?: string | null

  @Property({ name: 'winning_team_id', type: 'uuid', nullable: true })
  winningTeamId?: string | null

  @Property({ name: 'awarded_at', type: 'timestamptz', nullable: true })
  awardedAt?: Date | null

  @Property({ name: 'awarded_by', type: 'uuid', nullable: true })
  awardedBy?: string | null

  // Multi-tenancy
  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'int', default: 0 })
  order: number = 0

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'sponsors_peer_vote' })
@Unique({ properties: ['competitionId', 'voterId', 'projectId'] })
export class PeerVote {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'voter_id', type: 'uuid' })
  voterId!: string

  @Index()
  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  // Multi-tenancy
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()
}
