import { Migration } from '@mikro-orm/migrations'

export class Migration20260317190000_participation extends Migration {
  override async up(): Promise<void> {
    // --- competitions_participation ---
    this.addSql(`
      create table "competitions_participation" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "customer_user_id" uuid not null,
        "role" text check ("role" in ('participant','mentor','judge')) not null default 'participant',
        "checked_in" boolean not null default false,
        "checked_in_at" timestamptz null,
        "badge_printed" boolean not null default false,
        "coc_accepted" boolean not null default false,
        "coc_accepted_at" timestamptz null,
        "privacy_policy_accepted" boolean not null default false,
        "privacy_policy_accepted_at" timestamptz null,
        "profile_complete" boolean not null default false,
        "looking_for_team" boolean not null default false,
        "looking_for_team_description" text null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "competitions_participation_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "competitions_participation_competition_id_index" on "competitions_participation" ("competition_id");`)
    this.addSql(`create index "competitions_participation_customer_user_id_index" on "competitions_participation" ("customer_user_id");`)
    this.addSql(`create index "competitions_participation_tenant_id_index" on "competitions_participation" ("tenant_id");`)
    this.addSql(`create index "competitions_participation_organization_id_index" on "competitions_participation" ("organization_id");`)
    this.addSql(`alter table "competitions_participation" add constraint "competitions_participation_competition_id_customer_user_id_unique" unique ("competition_id", "customer_user_id");`)

    // --- competitions_participant_profile ---
    this.addSql(`
      create table "competitions_participant_profile" (
        "id" uuid not null default gen_random_uuid(),
        "customer_user_id" uuid not null,
        "bio" text null,
        "organization" varchar(255) null,
        "skills" jsonb not null default '[]',
        "social_links" jsonb not null default '{}',
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "competitions_participant_profile_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "competitions_participant_profile_customer_user_id_index" on "competitions_participant_profile" ("customer_user_id");`)
    this.addSql(`create index "competitions_participant_profile_tenant_id_index" on "competitions_participant_profile" ("tenant_id");`)
    this.addSql(`create index "competitions_participant_profile_organization_id_index" on "competitions_participant_profile" ("organization_id");`)
    this.addSql(`alter table "competitions_participant_profile" add constraint "competitions_participant_profile_customer_user_id_tenant_id_unique" unique ("customer_user_id", "tenant_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "competitions_participant_profile" cascade;`)
    this.addSql(`drop table if exists "competitions_participation" cascade;`)
  }
}
