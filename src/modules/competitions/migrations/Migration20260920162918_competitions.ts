import { Migration } from '@mikro-orm/migrations';

export class Migration20260920162918_competitions extends Migration {

  override name = 'Migration20260920162918';

  override up(): void | Promise<void> {
    this.addSql(`alter table "competitions_participation" add "thank_you_email_sent_at" timestamptz null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "competitions_participation" drop column "thank_you_email_sent_at";`);
  }

}
