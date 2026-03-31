import { Migration } from '@mikro-orm/migrations';

export class Migration20260330234721 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "tracks_track" alter column "color" type varchar(7) using ("color"::varchar(7));`);
    this.addSql(`alter table "tracks_track" alter column "color" set default '#6366f1';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "tracks_track" alter column "color" set default '''#6366f1''';`);
  }

}
