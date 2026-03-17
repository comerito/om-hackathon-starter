import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SponsorTier {
  TITLE = 'TITLE',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  PARTNER = 'PARTNER',
  IN_KIND = 'IN_KIND',
}

export enum PrizeCategory {
  TRACK_PLACEMENT = 'TRACK_PLACEMENT',
  SPECIAL_AWARD = 'SPECIAL_AWARD',
  SPONSOR_PRIZE = 'SPONSOR_PRIZE',
  PEOPLES_CHOICE = 'PEOPLES_CHOICE',
}

// ---------------------------------------------------------------------------
// Sponsor
// ---------------------------------------------------------------------------

@Entity({ tableName: 'sponsors_sponsor' })
export class Sponsor {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'text' })
  name!: string

  @Enum({ items: () => SponsorTier, default: SponsorTier.PARTNER })
  tier: SponsorTier = SponsorTier.PARTNER

  @Property({ name: 'logo_url', type: 'text' })
  logoUrl!: string

  @Property({ name: 'website_url', type: 'text', nullable: true })
  websiteUrl?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'challenge_title', type: 'text', nullable: true })
  challengeTitle?: string | null

  @Property({ name: 'challenge_description', type: 'text', nullable: true })
  challengeDescription?: string | null

  @Property({ name: 'challenge_resources_url', type: 'text', nullable: true })
  challengeResourcesUrl?: string | null

  @Property({ name: 'contact_name', type: 'text', nullable: true })
  contactName?: string | null

  @Property({ name: 'contact_email', type: 'text', nullable: true })
  contactEmail?: string | null

  @Property({ name: 'order', type: 'integer', default: 0 })
  order: number = 0

  @Property({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean = true

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
}

// ---------------------------------------------------------------------------
// Prize
// ---------------------------------------------------------------------------

@Entity({ tableName: 'sponsors_prize' })
export class Prize {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Enum({ items: () => PrizeCategory, default: PrizeCategory.SPECIAL_AWARD })
  category: PrizeCategory = PrizeCategory.SPECIAL_AWARD

  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Property({ name: 'sponsor_id', type: 'uuid', nullable: true })
  sponsorId?: string | null

  @Property({ type: 'text', nullable: true })
  value?: string | null

  @Property({ type: 'integer', nullable: true })
  rank?: number | null

  @Property({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl?: string | null

  @Property({ name: 'winning_project_id', type: 'uuid', nullable: true })
  winningProjectId?: string | null

  @Property({ name: 'winning_team_id', type: 'uuid', nullable: true })
  winningTeamId?: string | null

  @Property({ name: 'awarded_at', type: 'timestamptz', nullable: true })
  awardedAt?: Date | null

  @Property({ name: 'awarded_by', type: 'uuid', nullable: true })
  awardedBy?: string | null

  @Property({ name: 'order', type: 'integer', default: 0 })
  order: number = 0

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

// ---------------------------------------------------------------------------
// PeerVote
// ---------------------------------------------------------------------------

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

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
