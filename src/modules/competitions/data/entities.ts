import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'

// ── Enums (as string unions + const objects) ────────────────────────

export const CompetitionStage = {
  DRAFT: 'draft',
  OPEN: 'open',
  TEAM_FORMATION: 'team_formation',
  TRACK_SELECTION: 'track_selection',
  HACKING: 'hacking',
  DEMOS: 'demos',
  DELIBERATION: 'deliberation',
  FINISHED: 'finished',
  ARCHIVED: 'archived',
} as const
export type CompetitionStage = (typeof CompetitionStage)[keyof typeof CompetitionStage]

export const STAGE_ORDER: CompetitionStage[] = [
  CompetitionStage.DRAFT,
  CompetitionStage.OPEN,
  CompetitionStage.TEAM_FORMATION,
  CompetitionStage.TRACK_SELECTION,
  CompetitionStage.HACKING,
  CompetitionStage.DEMOS,
  CompetitionStage.DELIBERATION,
  CompetitionStage.FINISHED,
  CompetitionStage.ARCHIVED,
]

export const ParticipationRole = {
  PARTICIPANT: 'participant',
  MENTOR: 'mentor',
  JUDGE: 'judge',
} as const
export type ParticipationRole = (typeof ParticipationRole)[keyof typeof ParticipationRole]

export const AgendaItemType = {
  CEREMONY: 'ceremony',
  TALK: 'talk',
  WORKSHOP: 'workshop',
  BREAK: 'break',
  MEAL: 'meal',
  DEADLINE: 'deadline',
  DEMO_SESSION: 'demo_session',
  CUSTOM: 'custom',
} as const
export type AgendaItemType = (typeof AgendaItemType)[keyof typeof AgendaItemType]

export const AnnouncementPriority = {
  INFO: 'info',
  WARNING: 'warning',
  URGENT: 'urgent',
} as const
export type AnnouncementPriority = (typeof AnnouncementPriority)[keyof typeof AnnouncementPriority]

export const AnnouncementCategory = {
  GENERAL: 'general',
  LOGISTICS: 'logistics',
  TECHNICAL: 'technical',
  SCHEDULE: 'schedule',
  JUDGING: 'judging',
} as const
export type AnnouncementCategory = (typeof AnnouncementCategory)[keyof typeof AnnouncementCategory]

export const MilestoneStatus = {
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus]

// ── JSONB Config Interfaces ─────────────────────────────────────────

export interface StageConfig {
  allowSimultaneousFormationAndTrack: boolean
  allowTeamChangesDuringHacking: boolean
  teamChangeGracePeriodMinutes: number | null
  allowSoloParticipants: boolean
}

export interface DemoConfig {
  format: 'stage_presentation'
  presentationDurationMinutes: number
  qaDurationMinutes: number
  setupBufferMinutes: number
  finalistsPerTrack: number | null
}

export interface JudgingConfig {
  rounds: 1 | 2
  preliminaryJudgesPerProject: number
  finalistsPerTrack: number
  preliminaryWeight: number
  finalWeight: number
  projectDistribution: 'all' | 'distributed'
  finalRoundFormat: 'stage_presentation'
}

export interface PeerVotingConfig {
  enabled: boolean
  votesPerPerson: number
  votingStartsAt: string | null
  votingEndsAt: string | null
  allowVoteChange: boolean
}

// ── Entities ────────────────────────────────────────────────────────

@Entity({ tableName: 'competitions_competition' })
@Unique({ properties: ['slug', 'tenantId'] })
export class Competition {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'varchar', length: 255 })
  slug!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'varchar', length: 500, nullable: true })
  location?: string | null

  @Property({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date

  @Property({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date

  @Property({ type: 'varchar', length: 50, default: 'Europe/Warsaw' })
  timezone: string = 'Europe/Warsaw'

  @Property({ type: 'text', default: 'draft' })
  stage: CompetitionStage = CompetitionStage.DRAFT

  @Property({ name: 'min_team_size', type: 'int', default: 2 })
  minTeamSize: number = 2

  @Property({ name: 'max_team_size', type: 'int', default: 5 })
  maxTeamSize: number = 5

  @Property({ name: 'max_teams_per_track', type: 'int', nullable: true })
  maxTeamsPerTrack?: number | null

  @Property({ name: 'allow_track_change', type: 'boolean', default: false })
  allowTrackChange: boolean = false

  @Property({ name: 'project_submission_deadline', type: 'timestamptz', nullable: true })
  projectSubmissionDeadline?: Date | null

  @Property({ name: 'judging_deadline', type: 'timestamptz', nullable: true })
  judgingDeadline?: Date | null

  @Property({ name: 'stage_config', type: 'jsonb', default: '{}' })
  stageConfig: StageConfig = {
    allowSimultaneousFormationAndTrack: false,
    allowTeamChangesDuringHacking: false,
    teamChangeGracePeriodMinutes: null,
    allowSoloParticipants: false,
  }

  @Property({ name: 'demo_config', type: 'jsonb', default: '{}' })
  demoConfig: DemoConfig = {
    format: 'stage_presentation',
    presentationDurationMinutes: 3,
    qaDurationMinutes: 2,
    setupBufferMinutes: 1,
    finalistsPerTrack: null,
  }

  @Property({ name: 'judging_config', type: 'jsonb', default: '{}' })
  judgingConfig: JudgingConfig = {
    rounds: 1,
    preliminaryJudgesPerProject: 3,
    finalistsPerTrack: 3,
    preliminaryWeight: 0.4,
    finalWeight: 0.6,
    projectDistribution: 'all',
    finalRoundFormat: 'stage_presentation',
  }

  @Property({ name: 'peer_voting_config', type: 'jsonb', default: '{}' })
  peerVotingConfig: PeerVotingConfig = {
    enabled: true,
    votesPerPerson: 3,
    votingStartsAt: null,
    votingEndsAt: null,
    allowVoteChange: false,
  }

  @Property({ name: 'info_cards', type: 'jsonb', default: '[]' })
  infoCards: Array<{ key: string; label: string; value: string; icon?: string }> = []

  @Property({ name: 'code_of_conduct_url', type: 'varchar', length: 1000 })
  codeOfConductUrl!: string

  @Property({ name: 'rules_url', type: 'varchar', length: 1000, nullable: true })
  rulesUrl?: string | null

  @Property({ name: 'privacy_policy_url', type: 'varchar', length: 1000, nullable: true })
  privacyPolicyUrl?: string | null

  @Property({ name: 'cover_image_url', type: 'varchar', length: 1000, nullable: true })
  coverImageUrl?: string | null

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

@Entity({ tableName: 'competitions_participation' })
@Unique({ properties: ['competitionId', 'customerUserId'] })
export class CompetitionParticipation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Index()
  @Property({ name: 'customer_user_id', type: 'uuid' })
  customerUserId!: string

  @Property({ type: 'text', default: 'participant' })
  role: ParticipationRole = ParticipationRole.PARTICIPANT

  @Property({ name: 'checked_in', type: 'boolean', default: false })
  checkedIn: boolean = false

  @Property({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt?: Date | null

  @Property({ name: 'badge_printed', type: 'boolean', default: false })
  badgePrinted: boolean = false

  @Property({ name: 'coc_accepted', type: 'boolean', default: false })
  cocAccepted: boolean = false

  @Property({ name: 'coc_accepted_at', type: 'timestamptz', nullable: true })
  cocAcceptedAt?: Date | null

  @Property({ name: 'privacy_policy_accepted', type: 'boolean', default: false })
  privacyPolicyAccepted: boolean = false

  @Property({ name: 'privacy_policy_accepted_at', type: 'timestamptz', nullable: true })
  privacyPolicyAcceptedAt?: Date | null

  @Property({ name: 'profile_complete', type: 'boolean', default: false })
  profileComplete: boolean = false

  @Property({ name: 'looking_for_team', type: 'boolean', default: false })
  lookingForTeam: boolean = false

  @Property({ name: 'looking_for_team_description', type: 'text', nullable: true })
  lookingForTeamDescription?: string | null

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

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'competitions_participant_profile' })
@Unique({ properties: ['customerUserId', 'tenantId'] })
export class ParticipantProfile {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'customer_user_id', type: 'uuid' })
  customerUserId!: string

  @Property({ type: 'text', nullable: true })
  bio?: string | null

  @Property({ type: 'varchar', length: 255, nullable: true })
  organization?: string | null

  @Property({ name: 'avatar_url', type: 'varchar', length: 1000, nullable: true })
  avatarUrl?: string | null

  @Property({ name: 'portfolio_url', type: 'varchar', length: 1000, nullable: true })
  portfolioUrl?: string | null

  @Property({ name: 'office_hours_url', type: 'varchar', length: 1000, nullable: true })
  officeHoursUrl?: string | null

  @Property({ type: 'varchar', length: 100, nullable: true })
  specialty?: string | null

  @Property({ type: 'jsonb', default: '[]' })
  skills: string[] = []

  @Property({ name: 'social_links', type: 'jsonb', default: '{}' })
  socialLinks: { github?: string; linkedin?: string; twitter?: string; website?: string } = {}

  @Property({ name: 'notification_preferences', type: 'jsonb', default: '{}' })
  notificationPreferences: { email_digest?: boolean; slack_alerts?: boolean; sms_urgent?: boolean } = {}

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

@Entity({ tableName: 'competitions_agenda_item' })
export class AgendaItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', default: 'custom' })
  type: AgendaItemType = AgendaItemType.CUSTOM

  @Property({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date

  @Property({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date

  @Property({ type: 'varchar', length: 255, nullable: true })
  location?: string | null

  @Property({ name: 'speaker_name', type: 'varchar', length: 255, nullable: true })
  speakerName?: string | null

  @Property({ name: 'speaker_bio', type: 'text', nullable: true })
  speakerBio?: string | null

  @Property({ name: 'speaker_photo_url', type: 'varchar', length: 1000, nullable: true })
  speakerPhotoUrl?: string | null

  @Property({ name: 'track_id', type: 'uuid', nullable: true })
  trackId?: string | null

  @Property({ name: 'is_mandatory', type: 'boolean', default: false })
  isMandatory: boolean = false

  @Property({ type: 'int', default: 0, name: 'sort_order' })
  order: number = 0

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

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'competitions_announcement' })
export class Announcement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'author_id', type: 'uuid' })
  authorId!: string

  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'text', default: 'info' })
  priority: AnnouncementPriority = AnnouncementPriority.INFO

  @Property({ type: 'text', default: 'general' })
  category: AnnouncementCategory = AnnouncementCategory.GENERAL

  @Property({ name: 'action_url', type: 'varchar', length: 1000, nullable: true })
  actionUrl?: string | null

  @Property({ name: 'action_label', type: 'varchar', length: 255, nullable: true })
  actionLabel?: string | null

  @Property({ name: 'target_roles', type: 'jsonb', default: '[]' })
  targetRoles: string[] = []

  @Property({ name: 'target_track_ids', type: 'jsonb', default: '[]' })
  targetTrackIds: string[] = []

  @Property({ type: 'boolean', default: false })
  pinned: boolean = false

  @Property({ name: 'published_at', type: 'timestamptz', onCreate: () => new Date() })
  publishedAt: Date = new Date()

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

  @Property({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'competitions_milestone' })
export class Milestone {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date

  @Property({ type: 'text', default: 'upcoming' })
  status: MilestoneStatus = MilestoneStatus.UPCOMING

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

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

// ── Competition Invitation (maps framework invitation → competition + role) ──

@Entity({ tableName: 'competitions_invitation' })
@Unique({ properties: ['customerInvitationId'] })
export class CompetitionInvitation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'customer_invitation_id', type: 'uuid' })
  customerInvitationId!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ name: 'participation_role', type: 'text', default: 'participant' })
  participationRole: ParticipationRole = ParticipationRole.PARTICIPANT

  @Index()
  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Index()
  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'created_at', type: 'timestamptz', onCreate: () => new Date() })
  createdAt: Date = new Date()
}
