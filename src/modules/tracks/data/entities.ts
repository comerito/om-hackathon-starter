import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core'

@Entity({ tableName: 'tracks_track' })
export class Track {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'varchar', length: 7, default: "'#6366f1'" })
  color: string = '#6366f1'

  @Property({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl?: string | null

  @Property({ name: 'max_teams', type: 'int', nullable: true })
  maxTeams?: number | null

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  order: number = 0

  @Property({ type: 'varchar', length: 100, nullable: true })
  category?: string | null

  @Property({ type: 'varchar', length: 50, nullable: true })
  badge?: string | null

  @Property({ name: 'mentor_ids', type: 'jsonb', default: "'[]'" })
  mentorIds: string[] = []

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
