import { Migration } from '@mikro-orm/migrations';

export class Migration20260323212115 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "teams_resource" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "name" varchar(255) not null, "type" text not null default 'link', "url" varchar(1000) null, "file_id" uuid null, "metadata" jsonb not null default '{}', "added_by" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "teams_resource_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_resource_team_id_index" on "teams_resource" ("team_id");`);
    this.addSql(`create index "teams_resource_tenant_id_index" on "teams_resource" ("tenant_id");`);
    this.addSql(`create index "teams_resource_organization_id_index" on "teams_resource" ("organization_id");`);

    this.addSql(`alter table "teams_team_member" add column "title" varchar(255) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "teams_team_member" drop column "title";`);
  }

}
