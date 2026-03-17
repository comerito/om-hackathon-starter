import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'tracks_track' })
export class Track {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Index()
  @Property({ name: 'competition_id', type: 'uuid' })
  competitionId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', default: '#6366f1' })
  color: string = '#6366f1'

  @Property({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl?: string | null

  @Property({ name: 'max_teams', type: 'integer', nullable: true })
  maxTeams?: number | null

  @Property({ name: 'order', type: 'integer', default: 0 })
  order: number = 0

  /** Use GIN index (jsonb_path_ops) for fast @> containment queries on mentor UUIDs */
  @Property({ name: 'mentor_ids', type: 'jsonb', default: '[]' })
  mentorIds: string[] = []

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
}
