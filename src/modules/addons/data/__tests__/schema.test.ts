import { MikroORM } from '@mikro-orm/core'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { AddonAssignment, AddonDeliveryAttempt, AddonDeliveryBatch } from '../entities'

describe('addon persistence metadata', () => {
  let orm: MikroORM<PostgreSqlDriver>

  beforeAll(async () => {
    orm = await MikroORM.init({
      driver: PostgreSqlDriver,
      dbName: 'addons_metadata_test',
      entities: [AddonAssignment, AddonDeliveryBatch, AddonDeliveryAttempt],
      metadataProvider: ReflectMetadataProvider,
    })
  })

  afterAll(async () => { await orm?.close() })

  it('preserves scalar nullability and defaults alongside scoped references', async () => {
    const sql = await orm.schema.getCreateSchemaSQL({ wrap: false })
    expect(sql).toContain('"assignment_id" uuid null')
    expect(sql).toContain('"mode" varchar(64) not null default \'mock\'')
    expect(sql).toContain('foreign key ("batch_id", "tenant_id", "organization_id", "mode") references "addons_delivery_batches" ("id", "tenant_id", "organization_id", "mode") on update restrict on delete restrict')
    expect(sql).toContain('foreign key ("assignment_id", "tenant_id", "organization_id", "customer_user_id") references "addons_assignments" ("id", "tenant_id", "organization_id", "customer_user_id") on update restrict on delete restrict')
  })

  it('retains the permanent identity and mode-specific pending/success slot', async () => {
    const sql = await orm.schema.getCreateSchemaSQL({ wrap: false })
    expect(sql).toContain('unique ("tenant_id", "organization_id", "competition_id", "customer_user_id", "addon_key")')
    expect(sql).toContain('where assignment_id is not null and status in (\'pending\', \'succeeded\')')
    expect(sql).not.toMatch(/where[^;]*deleted_at/)
  })

  it('keeps references out of hydration and scalar change sets', () => {
    const em = orm.em.fork()
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      organization_id: '33333333-3333-4333-8333-333333333333',
      batch_id: '44444444-4444-4444-8444-444444444444',
      customer_user_id: '55555555-5555-4555-8555-555555555555',
      assignment_id: null,
      mode: 'mock' as const, status: 'selected' as const,
      created_at: new Date(), updated_at: new Date(), is_active: true,
      deleted_at: null, reason_code: null, started_at: null, finished_at: null, attempt_number: null,
    }
    const attempt = em.map(AddonDeliveryAttempt, row)
    expect(attempt.batchId).toBe(row.batch_id)
    expect(attempt.assignmentId).toBeNull()
    expect(Reflect.get(attempt, 'batchReference')).toBeUndefined()
    expect(Reflect.get(attempt, 'assignmentReference')).toBeUndefined()
    attempt.assignmentId = '66666666-6666-4666-8666-666666666666'
    em.getUnitOfWork().computeChangeSets()
    const change = em.getUnitOfWork().getChangeSets().find((item) => item.entity === attempt)
    expect(change?.payload).toEqual({ assignmentId: attempt.assignmentId, updatedAt: expect.any(Date) })
  })
})
