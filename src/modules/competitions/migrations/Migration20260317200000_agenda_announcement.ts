import { Migration } from '@mikro-orm/migrations'

export class Migration20260317200000_agenda_announcement extends Migration {
  override async up(): Promise<void> {
    // --- competitions_agenda_item ---
    this.addSql(`
      create table "competitions_agenda_item" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "title" text not null,
        "description" text null,
        "type" text check ("type" in ('ceremony','talk','workshop','break','meal','deadline','demo_session','custom')) not null default 'custom',
        "starts_at" timestamptz not null,
        "ends_at" timestamptz not null,
        "location" text null,
        "speaker_name" text null,
        "speaker_bio" text null,
        "track_id" uuid null,
        "is_mandatory" boolean not null default false,
        "order" integer not null default 0,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "competitions_agenda_item_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "competitions_agenda_item_competition_id_index" on "competitions_agenda_item" ("competition_id");`)
    this.addSql(`create index "competitions_agenda_item_tenant_id_index" on "competitions_agenda_item" ("tenant_id");`)
    this.addSql(`create index "competitions_agenda_item_organization_id_index" on "competitions_agenda_item" ("organization_id");`)
    this.addSql(`create index "competitions_agenda_item_starts_at_index" on "competitions_agenda_item" ("starts_at");`)
    this.addSql(`create index "competitions_agenda_item_type_index" on "competitions_agenda_item" ("type");`)

    // --- competitions_announcement ---
    this.addSql(`
      create table "competitions_announcement" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "author_id" uuid not null,
        "title" text not null,
        "content" text not null,
        "priority" text check ("priority" in ('info','warning','urgent')) not null default 'info',
        "target_roles" jsonb not null default '[]',
        "target_track_ids" jsonb not null default '[]',
        "pinned" boolean not null default false,
        "published_at" timestamptz not null default now(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        constraint "competitions_announcement_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "competitions_announcement_competition_id_index" on "competitions_announcement" ("competition_id");`)
    this.addSql(`create index "competitions_announcement_tenant_id_index" on "competitions_announcement" ("tenant_id");`)
    this.addSql(`create index "competitions_announcement_organization_id_index" on "competitions_announcement" ("organization_id");`)
    this.addSql(`create index "competitions_announcement_published_at_index" on "competitions_announcement" ("published_at");`)
    this.addSql(`create index "competitions_announcement_priority_index" on "competitions_announcement" ("priority");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "competitions_announcement" cascade;`)
    this.addSql(`drop table if exists "competitions_agenda_item" cascade;`)
  }
}
