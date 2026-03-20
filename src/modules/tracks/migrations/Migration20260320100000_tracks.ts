import { Migration } from '@mikro-orm/migrations';

export class Migration20260320100000_tracks extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "tracks_track" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "color" varchar(7) not null default '#6366f1', "icon_url" varchar(500) null, "max_teams" int null, "sort_order" int not null default 0, "mentor_ids" jsonb not null default '[]', "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "tracks_track_pkey" primary key ("id"));`);
    this.addSql(`create index "tracks_track_competition_id_index" on "tracks_track" ("competition_id");`);
    this.addSql(`create index "tracks_track_tenant_id_index" on "tracks_track" ("tenant_id");`);
    this.addSql(`create index "tracks_track_organization_id_index" on "tracks_track" ("organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "tracks_track" cascade;`);
  }
}
