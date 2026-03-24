import { Migration } from '@mikro-orm/migrations';

export class Migration20260319120000_competitions extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "competitions_competition" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "slug" varchar(255) not null, "description" text null, "location" varchar(500) null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "timezone" varchar(50) not null default 'Europe/Warsaw', "stage" text not null default 'draft', "min_team_size" int not null default 2, "max_team_size" int not null default 5, "max_teams_per_track" int null, "allow_track_change" boolean not null default false, "project_submission_deadline" timestamptz null, "judging_deadline" timestamptz null, "stage_config" jsonb not null default '{}', "demo_config" jsonb not null default '{}', "judging_config" jsonb not null default '{}', "peer_voting_config" jsonb not null default '{}', "code_of_conduct_url" varchar(1000) not null, "rules_url" varchar(1000) null, "privacy_policy_url" varchar(1000) null, "cover_image_url" varchar(1000) null, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "competitions_competition_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_competition_tenant_id_index" on "competitions_competition" ("tenant_id");`);
    this.addSql(`create index "competitions_competition_organization_id_index" on "competitions_competition" ("organization_id");`);
    this.addSql(`alter table "competitions_competition" add constraint "competitions_competition_slug_tenant_id_unique" unique ("slug", "tenant_id");`);

    this.addSql(`create table "competitions_participation" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "customer_user_id" uuid not null, "role" text not null default 'participant', "checked_in" boolean not null default false, "checked_in_at" timestamptz null, "badge_printed" boolean not null default false, "coc_accepted" boolean not null default false, "coc_accepted_at" timestamptz null, "privacy_policy_accepted" boolean not null default false, "privacy_policy_accepted_at" timestamptz null, "profile_complete" boolean not null default false, "looking_for_team" boolean not null default false, "looking_for_team_description" text null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "competitions_participation_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_participation_competition_id_index" on "competitions_participation" ("competition_id");`);
    this.addSql(`create index "competitions_participation_customer_user_id_index" on "competitions_participation" ("customer_user_id");`);
    this.addSql(`create index "competitions_participation_tenant_id_index" on "competitions_participation" ("tenant_id");`);
    this.addSql(`create index "competitions_participation_organization_id_index" on "competitions_participation" ("organization_id");`);
    this.addSql(`alter table "competitions_participation" add constraint "competitions_participation_competition_id_customer_user_id_unique" unique ("competition_id", "customer_user_id");`);

    this.addSql(`create table "competitions_participant_profile" ("id" uuid not null default gen_random_uuid(), "customer_user_id" uuid not null, "bio" text null, "organization" varchar(255) null, "skills" jsonb not null default '[]', "social_links" jsonb not null default '{}', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "competitions_participant_profile_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_participant_profile_customer_user_id_index" on "competitions_participant_profile" ("customer_user_id");`);
    this.addSql(`create index "competitions_participant_profile_tenant_id_index" on "competitions_participant_profile" ("tenant_id");`);
    this.addSql(`create index "competitions_participant_profile_organization_id_index" on "competitions_participant_profile" ("organization_id");`);
    this.addSql(`alter table "competitions_participant_profile" add constraint "competitions_participant_profile_customer_user_id_tenant_id_unique" unique ("customer_user_id", "tenant_id");`);

    this.addSql(`create table "competitions_agenda_item" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "title" varchar(255) not null, "description" text null, "type" text not null default 'custom', "starts_at" timestamptz not null, "ends_at" timestamptz not null, "location" varchar(255) null, "speaker_name" varchar(255) null, "speaker_bio" text null, "track_id" uuid null, "is_mandatory" boolean not null default false, "sort_order" int not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "competitions_agenda_item_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_agenda_item_competition_id_index" on "competitions_agenda_item" ("competition_id");`);
    this.addSql(`create index "competitions_agenda_item_tenant_id_index" on "competitions_agenda_item" ("tenant_id");`);
    this.addSql(`create index "competitions_agenda_item_organization_id_index" on "competitions_agenda_item" ("organization_id");`);

    this.addSql(`create table "competitions_announcement" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "author_id" uuid not null, "title" varchar(255) not null, "content" text not null, "priority" text not null default 'info', "target_roles" jsonb not null default '[]', "target_track_ids" jsonb not null default '[]', "pinned" boolean not null default false, "published_at" timestamptz not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, constraint "competitions_announcement_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_announcement_competition_id_index" on "competitions_announcement" ("competition_id");`);
    this.addSql(`create index "competitions_announcement_tenant_id_index" on "competitions_announcement" ("tenant_id");`);
    this.addSql(`create index "competitions_announcement_organization_id_index" on "competitions_announcement" ("organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "competitions_announcement" cascade;`);
    this.addSql(`drop table if exists "competitions_agenda_item" cascade;`);
    this.addSql(`drop table if exists "competitions_participant_profile" cascade;`);
    this.addSql(`drop table if exists "competitions_participation" cascade;`);
    this.addSql(`drop table if exists "competitions_competition" cascade;`);
  }
}
