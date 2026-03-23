import { Migration } from '@mikro-orm/migrations';

export class Migration20260322215856 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "sponsors_peer_vote" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "voter_id" uuid not null, "project_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, constraint "sponsors_peer_vote_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_peer_vote_competition_id_index" on "sponsors_peer_vote" ("competition_id");`);
    this.addSql(`create index "sponsors_peer_vote_voter_id_index" on "sponsors_peer_vote" ("voter_id");`);
    this.addSql(`create index "sponsors_peer_vote_project_id_index" on "sponsors_peer_vote" ("project_id");`);
    this.addSql(`alter table "sponsors_peer_vote" add constraint "sponsors_peer_vote_competition_id_voter_id_project_id_unique" unique ("competition_id", "voter_id", "project_id");`);

    this.addSql(`create table "sponsors_prize" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "category" text not null default 'special_award', "track_id" uuid null, "sponsor_id" uuid null, "value" varchar(255) null, "rank" int null, "icon_url" varchar(500) null, "winning_project_id" uuid null, "winning_team_id" uuid null, "awarded_at" timestamptz null, "awarded_by" uuid null, "tenant_id" uuid not null, "organization_id" uuid not null, "order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "sponsors_prize_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_prize_competition_id_index" on "sponsors_prize" ("competition_id");`);
    this.addSql(`create index "sponsors_prize_tenant_id_index" on "sponsors_prize" ("tenant_id");`);
    this.addSql(`create index "sponsors_prize_organization_id_index" on "sponsors_prize" ("organization_id");`);

    this.addSql(`create table "sponsors_sponsor" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "tier" text not null default 'partner', "logo_url" varchar(1000) not null, "website_url" varchar(1000) null, "description" text null, "challenge_title" varchar(255) null, "challenge_description" text null, "challenge_resources_url" varchar(1000) null, "contact_name" varchar(255) null, "contact_email" varchar(255) null, "order" int not null default 0, "is_visible" boolean not null default true, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "sponsors_sponsor_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_sponsor_competition_id_index" on "sponsors_sponsor" ("competition_id");`);
    this.addSql(`create index "sponsors_sponsor_tenant_id_index" on "sponsors_sponsor" ("tenant_id");`);
    this.addSql(`create index "sponsors_sponsor_organization_id_index" on "sponsors_sponsor" ("organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sponsors_peer_vote" cascade;`);
    this.addSql(`drop table if exists "sponsors_prize" cascade;`);
    this.addSql(`drop table if exists "sponsors_sponsor" cascade;`);
  }
}
