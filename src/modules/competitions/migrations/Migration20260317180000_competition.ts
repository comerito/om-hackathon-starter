import { Migration } from '@mikro-orm/migrations'

export class Migration20260317180000_competition extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "competitions_competition" (
        "id" uuid not null default gen_random_uuid(),
        "name" text not null,
        "slug" text not null,
        "description" text null,
        "location" text null,
        "starts_at" timestamptz not null,
        "ends_at" timestamptz not null,
        "timezone" text not null default 'Europe/Warsaw',
        "stage" text check ("stage" in ('DRAFT','OPEN','TEAM_FORMATION','TRACK_SELECTION','HACKING','DEMOS','DELIBERATION','FINISHED','ARCHIVED')) not null default 'DRAFT',
        "min_team_size" int not null default 2,
        "max_team_size" int not null default 5,
        "max_teams_per_track" int null,
        "allow_track_change" boolean not null default false,
        "project_submission_deadline" timestamptz null,
        "judging_deadline" timestamptz null,
        "stage_config" jsonb not null default '{}',
        "demo_config" jsonb not null default '{}',
        "judging_config" jsonb not null default '{}',
        "peer_voting_config" jsonb not null default '{}',
        "code_of_conduct_url" text not null,
        "rules_url" text null,
        "privacy_policy_url" text null,
        "cover_image_url" text null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "competitions_competition_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "competitions_competition_tenant_id_index" on "competitions_competition" ("tenant_id");`)
    this.addSql(`create index "competitions_competition_organization_id_index" on "competitions_competition" ("organization_id");`)
    this.addSql(`alter table "competitions_competition" add constraint "competitions_competition_slug_tenant_id_unique" unique ("slug", "tenant_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "competitions_competition" cascade;`)
  }
}
