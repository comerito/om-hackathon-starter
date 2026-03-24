import { Migration } from '@mikro-orm/migrations';

export class Migration20260319130000_add_soft_delete extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "competitions_participation" add column "deleted_at" timestamptz null;`);
    this.addSql(`alter table "competitions_agenda_item" add column "deleted_at" timestamptz null;`);
    this.addSql(`alter table "competitions_announcement" add column "updated_at" timestamptz not null default now();`);
    this.addSql(`alter table "competitions_announcement" add column "deleted_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "competitions_announcement" drop column if exists "deleted_at";`);
    this.addSql(`alter table "competitions_announcement" drop column if exists "updated_at";`);
    this.addSql(`alter table "competitions_agenda_item" drop column if exists "deleted_at";`);
    this.addSql(`alter table "competitions_participation" drop column if exists "deleted_at";`);
  }
}
