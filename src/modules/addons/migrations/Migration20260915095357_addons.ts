import { Migration } from '@mikro-orm/migrations';

export class Migration20260915095357_addons extends Migration {

  override name = 'Migration20260915095357';

  override up(): void | Promise<void> {
    this.addSql(`create table "addons_assignments" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "deleted_at" timestamptz null, "competition_id" uuid not null, "customer_user_id" uuid not null, "addon_key" varchar(64) not null default 'mercato_sandboxes', "assigned_at" timestamptz not null, "assigned_by" uuid not null, primary key ("id"));`);
    this.addSql(`create index "addons_assignments_tenant_id_index" on "addons_assignments" ("tenant_id");`);
    this.addSql(`create index "addons_assignments_organization_id_index" on "addons_assignments" ("organization_id");`);
    this.addSql(`create index "addons_assignments_competition_id_index" on "addons_assignments" ("competition_id");`);
    this.addSql(`create index "addons_assignments_customer_user_id_index" on "addons_assignments" ("customer_user_id");`);
    this.addSql(`create index "addons_assignments_assigned_by_index" on "addons_assignments" ("assigned_by");`);
    this.addSql(`alter table "addons_assignments" add constraint "addons_assignment_scoped_id" unique ("id", "tenant_id", "organization_id", "customer_user_id");`);
    this.addSql(`alter table "addons_assignments" add constraint "addons_assignment_identity" unique ("tenant_id", "organization_id", "competition_id", "customer_user_id", "addon_key");`);
    this.addSql(`alter table "addons_assignments" add constraint "addons_assignment_key" check (addon_key = 'mercato_sandboxes');`);

    this.addSql(`create table "addons_delivery_attempts" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "deleted_at" timestamptz null, "batch_id" uuid not null, "customer_user_id" uuid not null, "assignment_id" uuid null, "mode" varchar(64) not null default 'mock', "status" varchar(64) not null default 'selected', "reason_code" varchar(64) null, "started_at" timestamptz null, "finished_at" timestamptz null, "attempt_number" int null, primary key ("id"));`);
    this.addSql(`create index "addons_delivery_attempts_tenant_id_index" on "addons_delivery_attempts" ("tenant_id");`);
    this.addSql(`create index "addons_delivery_attempts_organization_id_index" on "addons_delivery_attempts" ("organization_id");`);
    this.addSql(`create index "addons_delivery_attempts_batch_id_index" on "addons_delivery_attempts" ("batch_id");`);
    this.addSql(`create index "addons_delivery_attempts_customer_user_id_index" on "addons_delivery_attempts" ("customer_user_id");`);
    this.addSql(`create index "addons_delivery_attempts_assignment_id_index" on "addons_delivery_attempts" ("assignment_id");`);
    this.addSql(`create index "addons_attempt_evidence" on "addons_delivery_attempts" ("tenant_id", "organization_id", "assignment_id", "mode", "status");`);
    this.addSql(`create unique index "addons_attempt_delivery_slot" on "addons_delivery_attempts" ("tenant_id", "organization_id", "assignment_id", "mode") where assignment_id is not null and status in ('pending', 'succeeded');`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_batch_customer" unique ("batch_id", "customer_user_id");`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_outcome" check ((status = 'selected' and assignment_id is null and reason_code is null and attempt_number is null and started_at is null and finished_at is null)
or (status = 'pending' and assignment_id is not null and reason_code is null and attempt_number is null and started_at is not null and finished_at is null)
or (status = 'succeeded' and assignment_id is not null and reason_code is null and attempt_number is not null and started_at is not null and finished_at is not null)
or (status = 'failed' and assignment_id is not null and reason_code is not null and reason_code = 'mock_failure' and mode = 'mock' and attempt_number is not null and started_at is not null and finished_at is not null)
or (status = 'skipped' and reason_code is not null and reason_code in ('already_succeeded', 'already_pending', 'no_longer_eligible', 'assignment_unavailable') and attempt_number is null and started_at is null and finished_at is not null and ((reason_code = 'no_longer_eligible' and assignment_id is null) or (reason_code <> 'no_longer_eligible' and assignment_id is not null)))
or (status in ('cancelled', 'expired') and assignment_id is null and reason_code is null and attempt_number is null and started_at is null and finished_at is not null));`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_number" check (attempt_number is null or attempt_number > 0);`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_status" check (status in ('selected', 'pending', 'succeeded', 'failed', 'skipped', 'cancelled', 'expired'));`);
    this.addSql(`alter table "addons_delivery_attempts" add constraint "addons_attempt_mode" check (mode in ('mock', 'real'));`);

    this.addSql(`create table "addons_delivery_batches" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "deleted_at" timestamptz null, "competition_id" uuid not null, "addon_key" varchar(64) not null default 'mercato_sandboxes', "mode" varchar(64) not null default 'mock', "created_by" uuid not null, "request_id" uuid not null, "selection_kind" varchar(64) not null, "roles" jsonb not null, "requested_customer_user_ids" jsonb null, "status" varchar(64) not null default 'draft', "expires_at" timestamptz not null, "confirmed_at" timestamptz null, "finished_at" timestamptz null, "recipient_count" int not null, "succeeded_count" int not null default 0, "failed_count" int not null default 0, "skipped_count" int not null default 0, primary key ("id"));`);
    this.addSql(`create index "addons_delivery_batches_tenant_id_index" on "addons_delivery_batches" ("tenant_id");`);
    this.addSql(`create index "addons_delivery_batches_organization_id_index" on "addons_delivery_batches" ("organization_id");`);
    this.addSql(`create index "addons_delivery_batches_competition_id_index" on "addons_delivery_batches" ("competition_id");`);
    this.addSql(`create index "addons_delivery_batches_created_by_index" on "addons_delivery_batches" ("created_by");`);
    this.addSql(`create index "addons_delivery_batches_request_id_index" on "addons_delivery_batches" ("request_id");`);
    this.addSql(`create index "addons_batch_history" on "addons_delivery_batches" ("tenant_id", "organization_id", "competition_id", "created_at", "id");`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_scoped_id" unique ("id", "tenant_id", "organization_id", "mode");`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_request" unique ("tenant_id", "organization_id", "request_id");`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_outcome" check ((status in ('completed', 'completed_with_errors') and succeeded_count + failed_count + skipped_count = recipient_count and confirmed_at is not null and finished_at is not null and ((status = 'completed' and failed_count = 0) or (status = 'completed_with_errors' and failed_count > 0))) or (status in ('draft', 'cancelled', 'expired') and succeeded_count = 0 and failed_count = 0 and skipped_count = 0 and confirmed_at is null and ((status = 'draft' and finished_at is null) or (status in ('cancelled', 'expired') and finished_at is not null))));`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_counts" check (recipient_count between 1 and 1000 and succeeded_count >= 0 and failed_count >= 0 and skipped_count >= 0 and succeeded_count + failed_count + skipped_count <= recipient_count);`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_selection" check ((selection_kind = 'explicit' and requested_customer_user_ids is not null and jsonb_typeof(requested_customer_user_ids) = 'array') or (selection_kind = 'all_filtered' and requested_customer_user_ids is null));`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_roles" check (jsonb_typeof(roles) = 'array' and roles <@ '["participant","mentor","judge"]'::jsonb);`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_status" check (status in ('draft', 'completed', 'completed_with_errors', 'cancelled', 'expired'));`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_mode" check (mode in ('mock', 'real'));`);
    this.addSql(`alter table "addons_delivery_batches" add constraint "addons_batch_key" check (addon_key = 'mercato_sandboxes');`);
  }

}
