import { Migration } from '@mikro-orm/migrations';

export class Migration20260323212115 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "tracks_track" add column "category" varchar(100) null, add column "badge" varchar(50) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "tracks_track" drop column "category", drop column "badge";`);
  }

}
