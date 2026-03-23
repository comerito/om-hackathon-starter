import { Migration } from '@mikro-orm/migrations';

export class Migration20260322233032 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "incidents_report" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "reporter_id" uuid null, "reported_user_id" uuid null, "description" text not null, "severity" text not null default 'low', "status" text not null default 'reported', "admin_notes" text null, "resolved_by" uuid null, "resolution_description" text null, "resolved_at" timestamptz null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "incidents_report_pkey" primary key ("id"));`);
    this.addSql(`create index "incidents_report_competition_id_index" on "incidents_report" ("competition_id");`);
    this.addSql(`create index "incidents_report_severity_index" on "incidents_report" ("severity");`);
    this.addSql(`create index "incidents_report_status_index" on "incidents_report" ("status");`);
    this.addSql(`create index "incidents_report_tenant_id_index" on "incidents_report" ("tenant_id");`);
    this.addSql(`create index "incidents_report_organization_id_index" on "incidents_report" ("organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "incidents_report" cascade;`);
  }
}
