import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums ────────────────────────────────────────────────────────

export const JudgingRound = {
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
} as const
export type JudgingRound = (typeof JudgingRound)[keyof typeof JudgingRound]

export const CriterionRound = {
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
  BOTH: 'both',
} as const
export type CriterionRound = (typeof CriterionRound)[keyof typeof CriterionRound]

export const DemoStatus = {
  QUEUED: 'queued',
  ON_DECK: 'on_deck',
  PRESENTING: 'presenting',
  QA: 'qa',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
} as const
export type DemoStatus = (typeof DemoStatus)[keyof typeof DemoStatus]

// ── Entities ────────────────────────────────────────────────────────

@Entity({ tableName: 'judging_panel' })
export class JudgePanel {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', default: 'preliminary' })
  round: JudgingRound = JudgingRound.PRELIMINARY

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'judging_panel_judge' })
@Unique({ properties: ['panelId', 'judgeId'] })
export class JudgePanelJudge {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'panel_id', type: 'uuid' })
  panelId!: string

  @Property({ name: 'judge_id', type: 'uuid' })
  judgeId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}

@Entity({ tableName: 'judging_panel_track' })
@Unique({ properties: ['panelId', 'trackId'] })
export class JudgePanelTrack {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'panel_id', type: 'uuid' })
  panelId!: string

  @Property({ name: 'track_id', type: 'uuid' })
  trackId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}

@Entity({ tableName: 'judging_criterion' })
export class JudgingCriterion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Property({ type: 'text', default: 'both' })
  round: CriterionRound = CriterionRound.BOTH

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'max_score', type: 'int', default: 10 })
  maxScore: number = 10

  @Property({ type: 'float' })
  weight!: number

  @Property({ type: 'int', default: 0 })
  order: number = 0

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'judging_project_score' })
@Unique({ properties: ['projectId', 'judgeId', 'round'] })
export class ProjectScore {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Index()
  @Property({ name: 'judge_id', type: 'uuid' })
  judgeId!: string

  @Property({ name: 'judge_panel_id', type: 'uuid' })
  judgePanelId!: string

  @Index()
  @Property({ type: 'text', default: 'preliminary' })
  round: JudgingRound = JudgingRound.PRELIMINARY

  @Property({ name: 'total_score', type: 'float', nullable: true })
  totalScore?: number | null

  @Property({ type: 'text', nullable: true })
  comment?: string | null

  @Property({ name: 'private_notes', type: 'text', nullable: true })
  privateNotes?: string | null

  @Property({ name: 'conflict_of_interest', type: 'boolean', default: false })
  conflictOfInterest: boolean = false

  @Property({ name: 'is_submitted', type: 'boolean', default: false })
  isSubmitted: boolean = false

  @Property({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'judging_criterion_score' })
@Unique({ properties: ['projectScoreId', 'criterionId'] })
export class CriterionScore {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'project_score_id', type: 'uuid' })
  projectScoreId!: string

  @Property({ name: 'criterion_id', type: 'uuid' })
  criterionId!: string

  @Property({ type: 'int' })
  score!: number

  @Property({ type: 'text', nullable: true })
  note?: string | null

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'updated_at', type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'judging_demo_session' })
export class DemoSession {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'team_id', type: 'uuid' })
  teamId!: string

  @Index()
  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Property({ name: 'track_id', type: 'uuid' })
  trackId!: string

  @Property({ name: 'presentation_order', type: 'int' })
  presentationOrder!: number

  @Property({ name: 'scheduled_start', type: 'timestamptz', nullable: true })
  scheduledStart?: Date | null

  @Property({ name: 'presentation_duration_minutes', type: 'int', default: 3 })
  presentationDurationMinutes: number = 3

  @Property({ name: 'qa_duration_minutes', type: 'int', default: 2 })
  qaDurationMinutes: number = 2

  @Index()
  @Property({ type: 'text', default: 'queued' })
  status: DemoStatus = DemoStatus.QUEUED

  @Property({ name: 'actual_start', type: 'timestamptz', nullable: true })
  actualStart?: Date | null

  @Property({ name: 'actual_end', type: 'timestamptz', nullable: true })
  actualEnd?: Date | null

  @Index()
  @Property({ type: 'text', default: 'preliminary' })
  round: JudgingRound = JudgingRound.PRELIMINARY

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
