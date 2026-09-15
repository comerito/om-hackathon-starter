import { randomUUID } from 'node:crypto'
import { Check, Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import type { AddonKey, AttemptStatus, BatchStatus, DeliveryMode, ParticipationRole, ReasonCode, SelectionKind } from './validators'

// Natural keys deliberately include inactive and soft-deleted history.
@Entity({ tableName: 'addons_assignments' })
@Unique({ name: 'addons_assignment_identity', properties: ['tenantId', 'organizationId', 'competitionId', 'customerUserId', 'addonKey'] })
@Unique({ name: 'addons_assignment_scoped_id', properties: ['id', 'tenantId', 'organizationId', 'customerUserId'] })
@Check({ name: 'addons_assignment_key', expression: "addon_key = 'mercato_sandboxes'" })
export class AddonAssignment {

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID()

  @Index()
  @Property({ type: 'uuid', fieldName: 'tenant_id' })
  tenantId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'organization_id' })
  organizationId!: string

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date()

  @Property({ type: 'timestamptz', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive: boolean = true

  @Property({ type: 'timestamptz', fieldName: 'deleted_at', nullable: true })
  deletedAt: Date | null = null

  @Index()
  @Property({ type: 'uuid', fieldName: 'competition_id' })
  competitionId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'customer_user_id' })
  customerUserId!: string

  @Property({ type: 'varchar', length: 64, fieldName: 'addon_key' })
  addonKey: AddonKey = 'mercato_sandboxes'

  @Property({ type: 'timestamptz', fieldName: 'assigned_at' })
  assignedAt!: Date

  @Index()
  @Property({ type: 'uuid', fieldName: 'assigned_by' })
  assignedBy!: string

}

@Entity({ tableName: 'addons_delivery_batches' })
@Unique({ name: 'addons_batch_request', properties: ['tenantId', 'organizationId', 'requestId'] })
@Unique({ name: 'addons_batch_scoped_id', properties: ['id', 'tenantId', 'organizationId', 'mode'] })
@Index({ name: 'addons_batch_history', properties: ['tenantId', 'organizationId', 'competitionId', 'createdAt', 'id'] })
@Check({ name: 'addons_batch_key', expression: "addon_key = 'mercato_sandboxes'" })
@Check({ name: 'addons_batch_mode', expression: "mode in ('mock', 'real')" })
@Check({ name: 'addons_batch_status', expression: "status in ('draft', 'completed', 'completed_with_errors', 'cancelled', 'expired')" })
@Check({ name: 'addons_batch_roles', expression: "jsonb_typeof(roles) = 'array' and roles <@ '[\"participant\",\"mentor\",\"judge\"]'::jsonb" })
@Check({ name: 'addons_batch_selection', expression: "(selection_kind = 'explicit' and requested_customer_user_ids is not null and jsonb_typeof(requested_customer_user_ids) = 'array') or (selection_kind = 'all_filtered' and requested_customer_user_ids is null)" })
@Check({ name: 'addons_batch_counts', expression: "recipient_count between 1 and 1000 and succeeded_count >= 0 and failed_count >= 0 and skipped_count >= 0 and succeeded_count + failed_count + skipped_count <= recipient_count" })
@Check({ name: 'addons_batch_outcome', expression: "(status in ('completed', 'completed_with_errors') and succeeded_count + failed_count + skipped_count = recipient_count and confirmed_at is not null and finished_at is not null and ((status = 'completed' and failed_count = 0) or (status = 'completed_with_errors' and failed_count > 0))) or (status in ('draft', 'cancelled', 'expired') and succeeded_count = 0 and failed_count = 0 and skipped_count = 0 and confirmed_at is null and ((status = 'draft' and finished_at is null) or (status in ('cancelled', 'expired') and finished_at is not null)))" })
export class AddonDeliveryBatch {

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID()

  @Index()
  @Property({ type: 'uuid', fieldName: 'tenant_id' })
  tenantId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'organization_id' })
  organizationId!: string

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date()

  @Property({ type: 'timestamptz', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive: boolean = true

  @Property({ type: 'timestamptz', fieldName: 'deleted_at', nullable: true })
  deletedAt: Date | null = null

  @Index()
  @Property({ type: 'uuid', fieldName: 'competition_id' })
  competitionId!: string

  @Property({ type: 'varchar', length: 64, fieldName: 'addon_key' })
  addonKey: AddonKey = 'mercato_sandboxes'

  @Property({ type: 'varchar', length: 64, fieldName: 'mode' })
  mode: DeliveryMode = 'mock'

  @Index()
  @Property({ type: 'uuid', fieldName: 'created_by' })
  createdBy!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'request_id' })
  requestId!: string

  @Property({ type: 'varchar', length: 64, fieldName: 'selection_kind' })
  selectionKind!: SelectionKind

  @Property({ type: 'jsonb', fieldName: 'roles' })
  roles: ParticipationRole[] = []

  @Property({ type: 'jsonb', fieldName: 'requested_customer_user_ids', nullable: true })
  requestedCustomerUserIds: string[] | null = null

  @Property({ type: 'varchar', length: 64, fieldName: 'status' })
  status: BatchStatus = 'draft'

  @Property({ type: 'timestamptz', fieldName: 'expires_at' })
  expiresAt!: Date

  @Property({ type: 'timestamptz', fieldName: 'confirmed_at', nullable: true })
  confirmedAt: Date | null = null

  @Property({ type: 'timestamptz', fieldName: 'finished_at', nullable: true })
  finishedAt: Date | null = null

  @Property({ type: 'integer', fieldName: 'recipient_count' })
  recipientCount!: number

  @Property({ type: 'integer', fieldName: 'succeeded_count', default: 0 })
  succeededCount: number = 0

  @Property({ type: 'integer', fieldName: 'failed_count', default: 0 })
  failedCount: number = 0

  @Property({ type: 'integer', fieldName: 'skipped_count', default: 0 })
  skippedCount: number = 0
}

@Entity({ tableName: 'addons_delivery_attempts' })
@Unique({ name: 'addons_attempt_batch_customer', properties: ['batchId', 'customerUserId'] })
@Index({ name: 'addons_attempt_evidence', properties: ['tenantId', 'organizationId', 'assignmentId', 'mode', 'status'] })
@Unique({
  name: 'addons_attempt_delivery_slot',
  properties: ['tenantId', 'organizationId', 'assignmentId', 'mode'],
  where: "assignment_id is not null and status in ('pending', 'succeeded')",
})
@Check({ name: 'addons_attempt_mode', expression: "mode in ('mock', 'real')" })
@Check({ name: 'addons_attempt_status', expression: "status in ('selected', 'pending', 'succeeded', 'failed', 'skipped', 'cancelled', 'expired')" })
@Check({ name: 'addons_attempt_number', expression: "attempt_number is null or attempt_number > 0" })
@Check({ name: 'addons_attempt_outcome', expression: "(status = 'selected' and assignment_id is null and reason_code is null and attempt_number is null and started_at is null and finished_at is null)\nor (status = 'pending' and assignment_id is not null and reason_code is null and attempt_number is null and started_at is not null and finished_at is null)\nor (status = 'succeeded' and assignment_id is not null and reason_code is null and attempt_number is not null and started_at is not null and finished_at is not null)\nor (status = 'failed' and assignment_id is not null and reason_code is not null and reason_code = 'mock_failure' and mode = 'mock' and attempt_number is not null and started_at is not null and finished_at is not null)\nor (status = 'skipped' and reason_code is not null and reason_code in ('already_succeeded', 'already_pending', 'no_longer_eligible', 'assignment_unavailable') and attempt_number is null and started_at is null and finished_at is not null and ((reason_code = 'no_longer_eligible' and assignment_id is null) or (reason_code <> 'no_longer_eligible' and assignment_id is not null)))\nor (status in ('cancelled', 'expired') and assignment_id is null and reason_code is null and attempt_number is null and started_at is null and finished_at is not null)" })
export class AddonDeliveryAttempt {

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID()

  @Index()
  @Property({ type: 'uuid', fieldName: 'tenant_id' })
  tenantId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'organization_id' })
  organizationId!: string

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date()

  @Property({ type: 'timestamptz', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive: boolean = true

  @Property({ type: 'timestamptz', fieldName: 'deleted_at', nullable: true })
  deletedAt: Date | null = null

  @Index()
  @Property({ type: 'uuid', fieldName: 'batch_id' })
  batchId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'customer_user_id' })
  customerUserId!: string

  @Index()
  @Property({ type: 'uuid', fieldName: 'assignment_id', nullable: true })
  assignmentId: string | null = null

  // Schema-only references share scalar columns. Keep them after IDs and before mode:
  // MikroORM preserves the first column nullability and the last column default.
  @ManyToOne(() => AddonDeliveryBatch, {
    joinColumns: ['batch_id', 'tenant_id', 'organization_id', 'mode'],
    referencedColumnNames: ['id', 'tenant_id', 'organization_id', 'mode'],
    columnTypes: ['uuid', 'uuid', 'uuid', 'varchar(64)'],
    foreignKeyName: 'addons_attempt_batch_scope_fk',
    hydrate: false,
    hidden: true,
    nullable: false,
    ownColumns: [],
    cascade: [],
    deleteRule: 'restrict',
    updateRule: 'restrict',
  })
  private batchReference?: AddonDeliveryBatch

  @ManyToOne(() => AddonAssignment, {
    joinColumns: ['assignment_id', 'tenant_id', 'organization_id', 'customer_user_id'],
    referencedColumnNames: ['id', 'tenant_id', 'organization_id', 'customer_user_id'],
    columnTypes: ['uuid', 'uuid', 'uuid', 'uuid'],
    foreignKeyName: 'addons_attempt_assignment_scope_fk',
    hydrate: false,
    hidden: true,
    nullable: true,
    ownColumns: [],
    cascade: [],
    deleteRule: 'restrict',
    updateRule: 'restrict',
  })
  private assignmentReference?: AddonAssignment

  @Property({ type: 'varchar', length: 64, fieldName: 'mode' })
  mode: DeliveryMode = 'mock'

  @Property({ type: 'varchar', length: 64, fieldName: 'status' })
  status: AttemptStatus = 'selected'

  @Property({ type: 'varchar', length: 64, fieldName: 'reason_code', nullable: true })
  reasonCode: ReasonCode | null = null

  @Property({ type: 'timestamptz', fieldName: 'started_at', nullable: true })
  startedAt: Date | null = null

  @Property({ type: 'timestamptz', fieldName: 'finished_at', nullable: true })
  finishedAt: Date | null = null

  @Property({ type: 'integer', fieldName: 'attempt_number', nullable: true })
  attemptNumber: number | null = null
}
