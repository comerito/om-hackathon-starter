import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums (as const objects) ──────────────��─────────────────────────

export const BountyPRStatus = {
  DETECTED: 'detected',
  CLASSIFIED: 'classified',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DUPLICATE: 'duplicate',
} as const
export type BountyPRStatus = (typeof BountyPRStatus)[keyof typeof BountyPRStatus]

export const BountyCategory = {
  CRITICAL_BUG_FIX: 'critical_bug_fix',
  REGULAR_BUG_FIX: 'regular_bug_fix',
  NEW_IMPROVED_TEST: 'new_improved_test',
  DOCUMENTATION_IMPROVEMENT: 'documentation_improvement',
  MINOR_FIX: 'minor_fix',
} as const
export type BountyCategory = (typeof BountyCategory)[keyof typeof BountyCategory]

export const BOUNTY_POINTS: Record<BountyCategory, number> = {
  critical_bug_fix: 10,
  regular_bug_fix: 5,
  new_improved_test: 3,
  documentation_improvement: 2,
  minor_fix: 1,
}

export const BountyActivityType = {
  PR_DETECTED: 'pr_detected',
  PR_CLASSIFIED: 'pr_classified',
  PR_APPROVED: 'pr_approved',
  PR_REJECTED: 'pr_rejected',
  PR_DUPLICATE: 'pr_duplicate',
  POINTS_ADJUSTED: 'points_adjusted',
  POINTS_REVOKED: 'points_revoked',
  CLASSIFICATION_OVERRIDDEN: 'classification_overridden',
  MANUAL_REFRESH: 'manual_refresh',
} as const
export type BountyActivityType = (typeof BountyActivityType)[keyof typeof BountyActivityType]

// ── Types (stored as JSONB) ──���──────────────────────────────────────

export interface BountyClassification {
  category: BountyCategory
  points: number
  reasoning: string
}

// ── Entities ────────────────────────────────────────────────────────

@Entity({ tableName: 'bounties_pull_request' })
@Unique({ properties: ['githubPrId', 'tenantId'] })
export class BountyPullRequest {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  // GitHub data
  @Property({ name: 'github_pr_id', type: 'bigint' })
  githubPrId!: string

  @Property({ name: 'github_pr_number', type: 'int' })
  githubPrNumber!: number

  @Property({ name: 'github_pr_url', type: 'text' })
  githubPrUrl!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'diff_content', type: 'text', nullable: true })
  diffContent?: string | null

  @Property({ name: 'github_author', type: 'varchar', length: 255 })
  githubAuthor!: string

  // Cross-module FK IDs (no ORM relationships)
  @Index()
  @Property({ name: 'participant_id', type: 'uuid', nullable: true })
  participantId?: string | null

  @Index()
  @Property({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string | null

  // Status & classification
  @Index()
  @Property({ type: 'text', default: 'detected' })
  status: BountyPRStatus = BountyPRStatus.DETECTED

  @Property({ type: 'jsonb', nullable: true })
  classifications?: BountyClassification[] | null

  @Property({ name: 'classification_confidence', type: 'float', nullable: true })
  classificationConfidence?: number | null

  @Property({ name: 'classification_summary', type: 'text', nullable: true })
  classificationSummary?: string | null

  // Points
  @Property({ name: 'total_points', type: 'int', default: 0 })
  totalPoints: number = 0

  @Property({ name: 'points_override', type: 'jsonb', nullable: true })
  pointsOverride?: BountyClassification[] | null

  // Duplicate detection
  @Property({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate: boolean = false

  @Property({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId?: string | null

  @Property({ name: 'duplicate_marked_by', type: 'varchar', length: 50, nullable: true })
  duplicateMarkedBy?: string | null

  @Property({ name: 'duplicate_similarity', type: 'float', nullable: true })
  duplicateSimilarity?: number | null

  // Timestamps
  @Property({ name: 'github_created_at', type: 'timestamptz' })
  githubCreatedAt!: Date

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'bounties_activity_log' })
export class BountyActivityLog {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  type!: BountyActivityType

  @Index()
  @Property({ name: 'pull_request_id', type: 'uuid', nullable: true })
  pullRequestId?: string | null

  @Property({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string | null

  @Property({ type: 'text' })
  message!: string

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Index()
  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()
}
