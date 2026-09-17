import { Migration } from '@mikro-orm/migrations';

/**
 * Team recruitment posting — the team-side mirror of a participant's `looking_for_team`.
 *
 * Every column is defaulted or nullable so the migration is safe on a populated `teams_team`:
 * existing teams come out "not recruiting", which is what they were before this shipped.
 */
export class Migration20260917120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "teams_team" add column "looking_for_members" boolean not null default false, add column "needed_skills" jsonb not null default '[]', add column "recruitment_note" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "teams_team" drop column "looking_for_members", drop column "needed_skills", drop column "recruitment_note";`);
  }

}
