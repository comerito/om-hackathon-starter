import { Migration } from '@mikro-orm/migrations';

export class Migration20260320100000_teams extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "teams_team" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "track_id" uuid null, "name" varchar(255) not null, "description" text null, "avatar_url" varchar(500) null, "status" text not null default 'active', "disqualification_reason" text null, "disqualified_at" timestamptz null, "disqualified_by" uuid null, "presentation_order" int null, "presentation_time_slot" timestamptz null, "is_finalist" boolean not null default false, "table_number" int null, "table_location" varchar(255) null, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "teams_team_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_team_competition_id_index" on "teams_team" ("competition_id");`);
    this.addSql(`create index "teams_team_track_id_index" on "teams_team" ("track_id");`);
    this.addSql(`create index "teams_team_tenant_id_index" on "teams_team" ("tenant_id");`);
    this.addSql(`create index "teams_team_organization_id_index" on "teams_team" ("organization_id");`);

    this.addSql(`create table "teams_team_member" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "customer_user_id" uuid not null, "competition_id" uuid not null, "role" text not null default 'member', "joined_at" timestamptz not null, "left_at" timestamptz null, "tenant_id" uuid not null, "organization_id" uuid not null, "deleted_at" timestamptz null, constraint "teams_team_member_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_team_member_team_id_index" on "teams_team_member" ("team_id");`);
    this.addSql(`create index "teams_team_member_customer_user_id_index" on "teams_team_member" ("customer_user_id");`);
    this.addSql(`create index "teams_team_member_competition_id_index" on "teams_team_member" ("competition_id");`);
    this.addSql(`create index "teams_team_member_tenant_id_index" on "teams_team_member" ("tenant_id");`);
    this.addSql(`create index "teams_team_member_organization_id_index" on "teams_team_member" ("organization_id");`);
    this.addSql(`alter table "teams_team_member" add constraint "teams_team_member_competition_id_customer_user_id_unique" unique ("competition_id", "customer_user_id");`);

    this.addSql(`create table "teams_invitation" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "inviter_id" uuid not null, "invitee_id" uuid not null, "type" text not null default 'invite', "status" text not null default 'pending', "message" text null, "created_at" timestamptz not null, "responded_at" timestamptz null, "expires_at" timestamptz not null, "tenant_id" uuid not null, "organization_id" uuid not null, "competition_id" uuid not null, constraint "teams_invitation_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_invitation_team_id_index" on "teams_invitation" ("team_id");`);
    this.addSql(`create index "teams_invitation_invitee_id_index" on "teams_invitation" ("invitee_id");`);
    this.addSql(`create index "teams_invitation_status_index" on "teams_invitation" ("status");`);
    this.addSql(`create index "teams_invitation_tenant_id_index" on "teams_invitation" ("tenant_id");`);
    this.addSql(`create index "teams_invitation_organization_id_index" on "teams_invitation" ("organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "teams_invitation" cascade;`);
    this.addSql(`drop table if exists "teams_team_member" cascade;`);
    this.addSql(`drop table if exists "teams_team" cascade;`);
  }
}
