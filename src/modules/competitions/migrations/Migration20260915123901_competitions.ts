import { Migration } from '@mikro-orm/migrations';

export class Migration20260915123901_competitions extends Migration {

  override name = 'Migration20260915123901';

  override async up(): Promise<void> {
    this.addSql(`alter table "competitions_participation" add column "mercato_sandboxes_invited_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "competitions_participation" drop column "mercato_sandboxes_invited_at";`);
  }

}
