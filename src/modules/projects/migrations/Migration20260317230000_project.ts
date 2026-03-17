import { Migration } from '@mikro-orm/migrations'

export class Migration20260317230000_project extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "projects_project" (
        "id" uuid not null default gen_random_uuid(),
        "team_id" uuid not null,
        "competition_id" uuid not null,
        "track_id" uuid not null,
        "title" text not null,
        "tagline" varchar(140) null,
        "description" text null,
        "problem_statement" text null,
        "solution" text null,
        "tech_stack" jsonb not null default '[]',
        "demo_url" text null,
        "repo_url" text null,
        "video_url" text null,
        "presentation_url" text null,
        "screenshot_ids" jsonb not null default '[]',
        "attachment_ids" jsonb not null default '[]',
        "uses_preexisting_code" boolean not null default false,
        "preexisting_code_description" text null,
        "built_during_hackathon_description" text null,
        "flagged_for_reuse" boolean not null default false,
        "flagged_by" uuid null,
        "flagged_at" timestamptz null,
        "flagged_reason" text null,
        "status" text check ("status" in ('DRAFT','PUBLISHED','UNDER_REVIEW','SCORED')) not null default 'DRAFT',
        "submitted_at" timestamptz null,
        "final_score" float null,
        "peer_vote_count" int null,
        "rank" int null,
        "manual_rank_override" int null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "projects_project_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "projects_project_team_id_index" on "projects_project" ("team_id");`)
    this.addSql(`create index "projects_project_competition_id_index" on "projects_project" ("competition_id");`)
    this.addSql(`create index "projects_project_track_id_index" on "projects_project" ("track_id");`)
    this.addSql(`create index "projects_project_status_index" on "projects_project" ("status");`)
    this.addSql(`create index "projects_project_tenant_id_index" on "projects_project" ("tenant_id");`)
    this.addSql(`create index "projects_project_organization_id_index" on "projects_project" ("organization_id");`)
    this.addSql(`alter table "projects_project" add constraint "projects_project_team_id_competition_id_unique" unique ("team_id", "competition_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "projects_project" cascade;`)
  }
}
