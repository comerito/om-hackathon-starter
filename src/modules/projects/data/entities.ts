import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SCORED = 'SCORED',
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

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

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'varchar(140)', nullable: true })
  tagline?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'problem_statement', type: 'text', nullable: true })
  problemStatement?: string | null

  @Property({ type: 'text', nullable: true })
  solution?: string | null

  @Property({ name: 'tech_stack', type: 'jsonb', default: '[]' })
  techStack: string[] = []

  @Property({ name: 'demo_url', type: 'text', nullable: true })
  demoUrl?: string | null

  @Property({ name: 'repo_url', type: 'text', nullable: true })
  repoUrl?: string | null

  @Property({ name: 'video_url', type: 'text', nullable: true })
  videoUrl?: string | null

  @Property({ name: 'presentation_url', type: 'text', nullable: true })
  presentationUrl?: string | null

  @Property({ name: 'screenshot_ids', type: 'jsonb', default: '[]' })
  screenshotIds: string[] = []

  @Property({ name: 'attachment_ids', type: 'jsonb', default: '[]' })
  attachmentIds: string[] = []

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

  @Index()
  @Enum({ items: () => ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus = ProjectStatus.DRAFT

  @Property({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date | null

  @Property({ name: 'final_score', type: 'float', nullable: true })
  finalScore?: number | null

  @Property({ name: 'peer_vote_count', type: 'integer', nullable: true })
  peerVoteCount?: number | null

  @Property({ type: 'integer', nullable: true })
  rank?: number | null

  @Property({ name: 'manual_rank_override', type: 'integer', nullable: true })
  manualRankOverride?: number | null

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
