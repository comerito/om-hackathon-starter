import { Migration } from '@mikro-orm/migrations';

export class Migration20260323212113 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "competitions_milestone" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "due_date" timestamptz not null, "status" text not null default 'upcoming', "sort_order" int not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "competitions_milestone_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_milestone_competition_id_index" on "competitions_milestone" ("competition_id");`);
    this.addSql(`create index "competitions_milestone_tenant_id_index" on "competitions_milestone" ("tenant_id");`);
    this.addSql(`create index "competitions_milestone_organization_id_index" on "competitions_milestone" ("organization_id");`);

    this.addSql(`alter table "competitions_announcement" add column "category" text not null default 'general', add column "action_url" varchar(1000) null, add column "action_label" varchar(255) null;`);

    this.addSql(`alter table "competitions_competition" add column "info_cards" jsonb not null default '[]';`);

    this.addSql(`alter table "competitions_participant_profile" add column "avatar_url" varchar(1000) null, add column "portfolio_url" varchar(1000) null, add column "office_hours_url" varchar(1000) null, add column "specialty" varchar(100) null, add column "notification_preferences" jsonb not null default '{}';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "competitions_announcement" drop column "category", drop column "action_url", drop column "action_label";`);

    this.addSql(`alter table "competitions_competition" drop column "info_cards";`);

    this.addSql(`alter table "competitions_participant_profile" drop column "avatar_url", drop column "portfolio_url", drop column "office_hours_url", drop column "specialty", drop column "notification_preferences";`);
  }

}
