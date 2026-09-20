import { Migration } from '@mikro-orm/migrations';

export class Migration20260920103942_judging extends Migration {

  override name = 'Migration20260920103942';

  override up(): void | Promise<void> {
    this.addSql(`alter table "judging_panel" add "presentation_duration_minutes" int null, add "qa_duration_minutes" int null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "judging_panel" drop column "presentation_duration_minutes", drop column "qa_duration_minutes";`);
  }

}
