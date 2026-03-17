import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum JudgingRound {
  PRELIMINARY = 'PRELIMINARY',
  FINAL = 'FINAL',
}

export enum CriterionRound {
  PRELIMINARY = 'PRELIMINARY',
  FINAL = 'FINAL',
  BOTH = 'BOTH',
}

export enum DemoStatus {
  QUEUED = 'QUEUED',
  ON_DECK = 'ON_DECK',
  PRESENTING = 'PRESENTING',
  QA = 'QA',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

// ---------------------------------------------------------------------------
// JudgePanel
// ---------------------------------------------------------------------------

@Entity({ tableName: 'judging_panel' })
export class JudgePanel {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'text' })
  name!: string

  @Enum({ items: () => JudgingRound, default: JudgingRound.PRELIMINARY })
  round: JudgingRound = JudgingRound.PRELIMINARY

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

// ---------------------------------------------------------------------------
// JudgePanelJudge
// ---------------------------------------------------------------------------

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

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}

// ---------------------------------------------------------------------------
// JudgePanelTrack
// ---------------------------------------------------------------------------

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

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string
}

// ---------------------------------------------------------------------------
// JudgingCriterion
// ---------------------------------------------------------------------------

@Entity({ tableName: 'judging_criterion' })
export class JudgingCriterion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Enum({ items: () => CriterionRound, default: CriterionRound.BOTH })
  round: CriterionRound = CriterionRound.BOTH

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'max_score', type: 'integer', default: 10 })
  maxScore: number = 10

  @Property({ type: 'float' })
  weight!: number

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

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

// ---------------------------------------------------------------------------
// ProjectScore
// ---------------------------------------------------------------------------

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
  @Enum({ items: () => JudgingRound })
  round!: JudgingRound

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

  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

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
// CriterionScore
// ---------------------------------------------------------------------------

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

  @Property({ type: 'integer' })
  score!: number

  @Property({ type: 'text', nullable: true })
  note?: string | null

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

// ---------------------------------------------------------------------------
// DemoSession
// ---------------------------------------------------------------------------

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

  @Property({ name: 'presentation_order', type: 'integer' })
  presentationOrder!: number

  @Property({ name: 'scheduled_start', type: 'timestamptz', nullable: true })
  scheduledStart?: Date | null

  @Property({ name: 'presentation_duration_minutes', type: 'integer', default: 3 })
  presentationDurationMinutes: number = 3

  @Property({ name: 'qa_duration_minutes', type: 'integer', default: 2 })
  qaDurationMinutes: number = 2

  @Index()
  @Enum({ items: () => DemoStatus, default: DemoStatus.QUEUED })
  status: DemoStatus = DemoStatus.QUEUED

  @Property({ name: 'actual_start', type: 'timestamptz', nullable: true })
  actualStart?: Date | null

  @Property({ name: 'actual_end', type: 'timestamptz', nullable: true })
  actualEnd?: Date | null

  @Index()
  @Enum({ items: () => JudgingRound })
  round!: JudgingRound

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
