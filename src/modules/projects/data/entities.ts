import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums (as string unions + const objects) ────────────────────────

export const ProjectStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNDER_REVIEW: 'under_review',
  SCORED: 'scored',
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

// ── Entities ────────────────────────────────────────────────────────

@Entity({ tableName: 'projects_project' })
@Unique({ properties: ['teamId', 'competitionId'] })
export class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'track_id', type: 'uuid' })
  trackId!: string

  // Content
  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'varchar', length: 140, nullable: true })
  tagline?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'problem_statement', type: 'text', nullable: true })
  problemStatement?: string | null

  @Property({ type: 'text', nullable: true })
  solution?: string | null

  @Property({ name: 'tech_stack', type: 'jsonb', default: '[]' })
  techStack: string[] = []

  // Links
  @Property({ name: 'demo_url', type: 'varchar', length: 1000, nullable: true })
  demoUrl?: string | null

  @Property({ name: 'repo_url', type: 'varchar', length: 1000, nullable: true })
  repoUrl?: string | null

  @Property({ name: 'video_url', type: 'varchar', length: 1000, nullable: true })
  videoUrl?: string | null

  @Property({ name: 'presentation_url', type: 'varchar', length: 1000, nullable: true })
  presentationUrl?: string | null

  // Media (attachment IDs from OM attachments module)
  @Property({ name: 'screenshot_ids', type: 'jsonb', default: '[]' })
  screenshotIds: string[] = []

  @Property({ name: 'attachment_ids', type: 'jsonb', default: '[]' })
  attachmentIds: string[] = []

  // Originality Disclosure
  @Property({ name: 'uses_preexisting_code', type: 'boolean', default: false })
  usesPreexistingCode: boolean = false

  @Property({ name: 'preexisting_code_description', type: 'text', nullable: true })
  preexistingCodeDescription?: string | null

  @Property({ name: 'built_during_hackathon_description', type: 'text', nullable: true })
  builtDuringHackathonDescription?: string | null

  @Property({ name: 'flagged_for_reuse', type: 'boolean', default: false })
  flaggedForReuse: boolean = false

  @Property({ name: 'flagged_by', type: 'uuid', nullable: true })
  flaggedBy?: string | null

  @Property({ name: 'flagged_at', type: 'timestamptz', nullable: true })
  flaggedAt?: Date | null

  @Property({ name: 'flagged_reason', type: 'text', nullable: true })
  flaggedReason?: string | null

  // Status
  @Index()
  @Property({ type: 'text', default: 'draft' })
  status: ProjectStatus = ProjectStatus.DRAFT

  @Property({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date | null

  // Scoring (computed, cached)
  @Property({ name: 'final_score', type: 'float', nullable: true })
  finalScore?: number | null

  @Property({ name: 'peer_vote_count', type: 'int', nullable: true })
  peerVoteCount?: number | null

  @Property({ type: 'int', nullable: true })
  rank?: number | null

  @Property({ name: 'manual_rank_override', type: 'int', nullable: true })
  manualRankOverride?: number | null

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
