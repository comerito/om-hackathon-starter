import { Migration } from '@mikro-orm/migrations'

export class Migration20260317240000_judging extends Migration {
  override async up(): Promise<void> {
    // -----------------------------------------------------------------------
    // judging_panel
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_panel" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "name" text not null,
        "round" text check ("round" in ('PRELIMINARY','FINAL')) not null default 'PRELIMINARY',
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "judging_panel_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_panel_competition_id_index" on "judging_panel" ("competition_id");`)
    this.addSql(`create index "judging_panel_tenant_id_index" on "judging_panel" ("tenant_id");`)
    this.addSql(`create index "judging_panel_organization_id_index" on "judging_panel" ("organization_id");`)

    // -----------------------------------------------------------------------
    // judging_panel_judge
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_panel_judge" (
        "id" uuid not null default gen_random_uuid(),
        "panel_id" uuid not null,
        "judge_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        constraint "judging_panel_judge_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_panel_judge_panel_id_index" on "judging_panel_judge" ("panel_id");`)
    this.addSql(`create index "judging_panel_judge_tenant_id_index" on "judging_panel_judge" ("tenant_id");`)
    this.addSql(`create index "judging_panel_judge_organization_id_index" on "judging_panel_judge" ("organization_id");`)
    this.addSql(`alter table "judging_panel_judge" add constraint "judging_panel_judge_panel_id_judge_id_unique" unique ("panel_id", "judge_id");`)

    // -----------------------------------------------------------------------
    // judging_panel_track
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_panel_track" (
        "id" uuid not null default gen_random_uuid(),
        "panel_id" uuid not null,
        "track_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        constraint "judging_panel_track_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_panel_track_panel_id_index" on "judging_panel_track" ("panel_id");`)
    this.addSql(`create index "judging_panel_track_tenant_id_index" on "judging_panel_track" ("tenant_id");`)
    this.addSql(`create index "judging_panel_track_organization_id_index" on "judging_panel_track" ("organization_id");`)
    this.addSql(`alter table "judging_panel_track" add constraint "judging_panel_track_panel_id_track_id_unique" unique ("panel_id", "track_id");`)

    // -----------------------------------------------------------------------
    // judging_criterion
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_criterion" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "track_id" uuid null,
        "round" text check ("round" in ('PRELIMINARY','FINAL','BOTH')) not null default 'BOTH',
        "name" text not null,
        "description" text null,
        "max_score" int not null default 10,
        "weight" float not null,
        "order" int not null default 0,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "judging_criterion_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_criterion_competition_id_index" on "judging_criterion" ("competition_id");`)
    this.addSql(`create index "judging_criterion_tenant_id_index" on "judging_criterion" ("tenant_id");`)
    this.addSql(`create index "judging_criterion_organization_id_index" on "judging_criterion" ("organization_id");`)

    // -----------------------------------------------------------------------
    // judging_project_score
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_project_score" (
        "id" uuid not null default gen_random_uuid(),
        "project_id" uuid not null,
        "judge_id" uuid not null,
        "judge_panel_id" uuid not null,
        "round" text check ("round" in ('PRELIMINARY','FINAL')) not null,
        "total_score" float null,
        "comment" text null,
        "private_notes" text null,
        "conflict_of_interest" boolean not null default false,
        "is_submitted" boolean not null default false,
        "submitted_at" timestamptz null,
        "competition_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "judging_project_score_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_project_score_project_id_index" on "judging_project_score" ("project_id");`)
    this.addSql(`create index "judging_project_score_judge_id_index" on "judging_project_score" ("judge_id");`)
    this.addSql(`create index "judging_project_score_round_index" on "judging_project_score" ("round");`)
    this.addSql(`create index "judging_project_score_tenant_id_index" on "judging_project_score" ("tenant_id");`)
    this.addSql(`create index "judging_project_score_organization_id_index" on "judging_project_score" ("organization_id");`)
    this.addSql(`alter table "judging_project_score" add constraint "judging_project_score_project_id_judge_id_round_unique" unique ("project_id", "judge_id", "round");`)

    // -----------------------------------------------------------------------
    // judging_criterion_score
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_criterion_score" (
        "id" uuid not null default gen_random_uuid(),
        "project_score_id" uuid not null,
        "criterion_id" uuid not null,
        "score" int not null,
        "note" text null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "updated_at" timestamptz not null default now(),
        constraint "judging_criterion_score_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_criterion_score_project_score_id_index" on "judging_criterion_score" ("project_score_id");`)
    this.addSql(`create index "judging_criterion_score_tenant_id_index" on "judging_criterion_score" ("tenant_id");`)
    this.addSql(`create index "judging_criterion_score_organization_id_index" on "judging_criterion_score" ("organization_id");`)
    this.addSql(`alter table "judging_criterion_score" add constraint "judging_criterion_score_project_score_id_criterion_id_unique" unique ("project_score_id", "criterion_id");`)

    // -----------------------------------------------------------------------
    // judging_demo_session
    // -----------------------------------------------------------------------
    this.addSql(`
      create table "judging_demo_session" (
        "id" uuid not null default gen_random_uuid(),
        "competition_id" uuid not null,
        "team_id" uuid not null,
        "project_id" uuid not null,
        "track_id" uuid not null,
        "presentation_order" int not null,
        "scheduled_start" timestamptz null,
        "presentation_duration_minutes" int not null default 3,
        "qa_duration_minutes" int not null default 2,
        "status" text check ("status" in ('QUEUED','ON_DECK','PRESENTING','QA','COMPLETED','SKIPPED')) not null default 'QUEUED',
        "actual_start" timestamptz null,
        "actual_end" timestamptz null,
        "round" text check ("round" in ('PRELIMINARY','FINAL')) not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "judging_demo_session_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index "judging_demo_session_competition_id_index" on "judging_demo_session" ("competition_id");`)
    this.addSql(`create index "judging_demo_session_project_id_index" on "judging_demo_session" ("project_id");`)
    this.addSql(`create index "judging_demo_session_status_index" on "judging_demo_session" ("status");`)
    this.addSql(`create index "judging_demo_session_round_index" on "judging_demo_session" ("round");`)
    this.addSql(`create index "judging_demo_session_tenant_id_index" on "judging_demo_session" ("tenant_id");`)
    this.addSql(`create index "judging_demo_session_organization_id_index" on "judging_demo_session" ("organization_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "judging_demo_session" cascade;`)
    this.addSql(`drop table if exists "judging_criterion_score" cascade;`)
    this.addSql(`drop table if exists "judging_project_score" cascade;`)
    this.addSql(`drop table if exists "judging_criterion" cascade;`)
    this.addSql(`drop table if exists "judging_panel_track" cascade;`)
    this.addSql(`drop table if exists "judging_panel_judge" cascade;`)
    this.addSql(`drop table if exists "judging_panel" cascade;`)
  }
}
