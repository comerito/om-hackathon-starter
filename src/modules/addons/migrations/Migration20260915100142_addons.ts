import { Migration } from '@mikro-orm/migrations';

export class Migration20260915100142_addons extends Migration {

  override name = 'Migration20260915100142';

  override up(): void | Promise<void> {
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_batch_scope_fk" foreign key ("batch_id", "tenant_id", "organization_id", "mode") references "addons_delivery_batches" ("id", "tenant_id", "organization_id", "mode") on update restrict on delete restrict;`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_assignment_scope_fk" foreign key ("assignment_id", "tenant_id", "organization_id", "customer_user_id") references "addons_assignments" ("id", "tenant_id", "organization_id", "customer_user_id") on update restrict on delete restrict;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "addons_delivery_attempts" drop constraint if exists "addons_attempt_batch_scope_fk";`);
    this.addSql(`alter table "addons_delivery_attempts" drop constraint if exists "addons_attempt_assignment_scope_fk";`);
  }

}
