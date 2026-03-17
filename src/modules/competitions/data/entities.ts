import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

export enum CompetitionStage {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  TEAM_FORMATION = 'TEAM_FORMATION',
  TRACK_SELECTION = 'TRACK_SELECTION',
  HACKING = 'HACKING',
  DEMOS = 'DEMOS',
  DELIBERATION = 'DELIBERATION',
  FINISHED = 'FINISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity({ tableName: 'competitions_competition' })
@Unique({ properties: ['slug', 'tenantId'] })
export class Competition {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  slug!: string

  @Property({ name: 'description', type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', nullable: true })
  location?: string | null

  @Property({ name: 'starts_at', type: Date })
  startsAt!: Date

  @Property({ name: 'ends_at', type: Date })
  endsAt!: Date

  @Property({ type: 'text', default: 'Europe/Warsaw' })
  timezone: string = 'Europe/Warsaw'

  @Enum({ items: () => CompetitionStage, default: CompetitionStage.DRAFT })
  stage: CompetitionStage = CompetitionStage.DRAFT

  // Team constraints
  @Property({ name: 'min_team_size', type: 'integer', default: 2 })
  minTeamSize: number = 2

  @Property({ name: 'max_team_size', type: 'integer', default: 5 })
  maxTeamSize: number = 5

  @Property({ name: 'max_teams_per_track', type: 'integer', nullable: true })
  maxTeamsPerTrack?: number | null

  @Property({ name: 'allow_track_change', type: 'boolean', default: false })
  allowTrackChange: boolean = false

  // Deadlines
  @Property({ name: 'project_submission_deadline', type: Date, nullable: true })
  projectSubmissionDeadline?: Date | null

  @Property({ name: 'judging_deadline', type: Date, nullable: true })
  judgingDeadline?: Date | null

  // JSONB configuration objects
  @Property({ name: 'stage_config', type: 'jsonb', default: '{}' })
  stageConfig: Record<string, unknown> = {}

  @Property({ name: 'demo_config', type: 'jsonb', default: '{}' })
  demoConfig: Record<string, unknown> = {}

  @Property({ name: 'judging_config', type: 'jsonb', default: '{}' })
  judgingConfig: Record<string, unknown> = {}

  @Property({ name: 'peer_voting_config', type: 'jsonb', default: '{}' })
  peerVotingConfig: Record<string, unknown> = {}

  // Legal
  @Property({ name: 'code_of_conduct_url', type: 'text' })
  codeOfConductUrl!: string

  @Property({ name: 'rules_url', type: 'text', nullable: true })
  rulesUrl?: string | null

  @Property({ name: 'privacy_policy_url', type: 'text', nullable: true })
  privacyPolicyUrl?: string | null

  // Media
  @Property({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl?: string | null

  // Multi-tenancy
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
