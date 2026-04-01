import { Migration } from '@mikro-orm/migrations';

export class Migration20260331210441 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "competitions_competition" add column "code_of_conduct_content" text null, add column "rules_content" text null, add column "privacy_policy_content" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "competitions_competition" drop column "code_of_conduct_content", drop column "rules_content", drop column "privacy_policy_content";`);
  }

}
