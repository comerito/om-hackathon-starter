import { Migration } from '@mikro-orm/migrations';

export class Migration20260917063343_judging extends Migration {

  override name = 'Migration20260917063343';

  override up(): void | Promise<void> {
    this.addSql(`alter table "judging_criterion_score" add "scale" int null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "judging_criterion_score" drop column "scale";`);
  }

}
