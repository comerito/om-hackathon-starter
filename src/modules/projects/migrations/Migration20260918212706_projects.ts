import { Migration } from '@mikro-orm/migrations';

export class Migration20260918212706_projects extends Migration {

  override name = 'Migration20260918212706';

  override up(): void | Promise<void> {
    this.addSql(`create table "projects_gallery_submission" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "publish_to_gallery" boolean not null default false, "summary" varchar(280) null, "built_on_open_mercato" text null, "screenshots" jsonb not null default '[]', "poster_attachment_id" uuid null, "show_team_members" boolean not null default false, "consent_accepted_at" timestamptz null, "consent_accepted_by" uuid null, "status" text not null default 'not_requested', "slug" varchar(120) null, "pr_number" int null, "pr_url" varchar(500) null, "live_url" varchar(500) null, "rejected_reason" text null, "published_at" timestamptz null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "projects_gallery_submission_status_index" on "projects_gallery_submission" ("status");`);
    this.addSql(`create index "projects_gallery_submission_tenant_id_index" on "projects_gallery_submission" ("tenant_id");`);
    this.addSql(`create index "projects_gallery_submission_organization_id_index" on "projects_gallery_submission" ("organization_id");`);
    this.addSql(`alter table "projects_gallery_submission" add constraint "projects_gallery_submission_project_id_unique" unique ("project_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "projects_gallery_submission" cascade;`);
  }

}
