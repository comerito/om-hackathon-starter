import { Migration } from '@mikro-orm/migrations';

export class Migration20260405203015 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "bounties_pull_request" alter column "github_pr_id" type bigint using ("github_pr_id"::bigint);`);
  }

  override async down(): Promise<void> {
    this.addSql(`create table "access_logs" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid null, "organization_id" uuid null, "actor_user_id" uuid null, "resource_kind" text not null, "resource_id" text not null, "access_type" text not null, "fields_json" jsonb null, "context_json" jsonb null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "access_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "access_logs_actor_idx" on "access_logs" ("actor_user_id", "created_at");`);
    this.addSql(`create index "access_logs_tenant_idx" on "access_logs" ("tenant_id", "created_at");`);

    this.addSql(`create table "action_logs" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid null, "organization_id" uuid null, "actor_user_id" uuid null, "command_id" text not null, "action_label" text null, "resource_kind" text null, "resource_id" text null, "execution_state" text not null default 'done', "undo_token" text null, "command_payload" jsonb null, "snapshot_before" jsonb null, "snapshot_after" jsonb null, "changes_json" jsonb null, "context_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "parent_resource_kind" text null, "parent_resource_id" text null, constraint "action_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "action_logs_actor_idx" on "action_logs" ("actor_user_id", "created_at");`);
    this.addSql(`create index "action_logs_parent_resource_idx" on "action_logs" ("tenant_id", "parent_resource_kind", "parent_resource_id", "created_at");`);
    this.addSql(`create index "action_logs_resource_idx" on "action_logs" ("tenant_id", "resource_kind", "resource_id", "created_at");`);
    this.addSql(`create index "action_logs_tenant_idx" on "action_logs" ("tenant_id", "created_at");`);

    this.addSql(`create table "api_keys" ("id" uuid not null default gen_random_uuid(), "name" text not null, "description" text null, "tenant_id" uuid null, "organization_id" uuid null, "key_hash" text not null, "key_prefix" text not null, "roles_json" jsonb null, "created_by" uuid null, "last_used_at" timestamptz(6) null, "expires_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, "session_token" text null, "session_user_id" uuid null, "session_secret_encrypted" text null, constraint "api_keys_pkey" primary key ("id"));`);
    this.addSql(`alter table "api_keys" add constraint "api_keys_key_prefix_unique" unique ("key_prefix");`);

    this.addSql(`create table "attachment_partitions" ("id" uuid not null default gen_random_uuid(), "code" text not null, "title" text not null, "description" text null, "storage_driver" text not null default 'local', "config_json" jsonb null, "is_public" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "requires_ocr" bool not null default true, "ocr_model" text null, constraint "attachment_partitions_pkey" primary key ("id"));`);
    this.addSql(`alter table "attachment_partitions" add constraint "attachment_partitions_code_unique" unique ("code");`);

    this.addSql(`create table "attachments" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "record_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "file_name" text not null, "mime_type" text not null, "file_size" int4 not null, "url" text not null, "created_at" timestamptz(6) not null, "partition_code" text not null, "storage_driver" text not null default 'local', "storage_path" text not null, "storage_metadata" jsonb null, "content" text null, constraint "attachments_pkey" primary key ("id"));`);
    this.addSql(`create index "attachments_entity_record_idx" on "attachments" ("record_id");`);
    this.addSql(`create index "attachments_partition_code_idx" on "attachments" ("partition_code");`);

    this.addSql(`create table "business_rules" ("id" uuid not null default gen_random_uuid(), "rule_id" varchar(50) not null, "rule_name" varchar(200) not null, "description" text null, "rule_type" varchar(20) not null, "rule_category" varchar(50) null, "entity_type" varchar(50) not null, "event_type" varchar(50) null, "condition_expression" jsonb not null, "success_actions" jsonb null, "failure_actions" jsonb null, "enabled" bool not null default true, "priority" int4 not null default 100, "version" int4 not null default 1, "effective_from" timestamptz(6) null, "effective_to" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_by" varchar(50) null, "updated_by" varchar(50) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "business_rules_pkey" primary key ("id"));`);
    this.addSql(`create index "business_rules_entity_event_idx" on "business_rules" ("entity_type", "event_type", "enabled");`);
    this.addSql(`alter table "business_rules" add constraint "business_rules_rule_id_tenant_id_unique" unique ("rule_id", "tenant_id");`);
    this.addSql(`create index "business_rules_tenant_org_idx" on "business_rules" ("tenant_id", "organization_id");`);
    this.addSql(`create index "business_rules_type_enabled_idx" on "business_rules" ("rule_type", "enabled", "priority");`);

    this.addSql(`create table "carrier_shipments" ("id" uuid not null default gen_random_uuid(), "order_id" uuid not null, "provider_key" text not null, "carrier_shipment_id" text not null, "tracking_number" text not null, "unified_status" text not null default 'label_created', "carrier_status" text null, "label_url" text null, "label_data" text null, "tracking_events" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "last_webhook_at" timestamptz(6) null, "last_polled_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "carrier_shipments_pkey" primary key ("id"));`);
    this.addSql(`create index "carrier_shipments_order_id_organization_id_tenant_id_index" on "carrier_shipments" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "carrier_shipments_organization_id_tenant_id_unif_b5ab4_index" on "carrier_shipments" ("organization_id", "tenant_id", "unified_status");`);
    this.addSql(`create index "carrier_shipments_provider_key_carrier_shipment_i_f9f17_index" on "carrier_shipments" ("provider_key", "carrier_shipment_id", "organization_id");`);

    this.addSql(`create table "catalog_price_kinds" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid null, "tenant_id" uuid not null, "code" text not null, "title" text not null, "display_mode" text not null default 'excluding-tax', "currency_code" text null, "is_promotion" bool not null default false, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "catalog_price_kinds_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_price_kinds" add constraint "catalog_price_kinds_code_tenant_unique" unique ("tenant_id", "code");`);
    this.addSql(`create index "catalog_price_kinds_tenant_idx" on "catalog_price_kinds" ("tenant_id");`);

    this.addSql(`create table "catalog_product_categories" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "slug" text null, "description" text null, "parent_id" uuid null, "root_id" uuid null, "tree_path" text null, "depth" int4 not null default 0, "ancestor_ids" jsonb not null default '[]', "child_ids" jsonb not null default '[]', "descendant_ids" jsonb not null default '[]', "metadata" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "catalog_product_categories_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_categories_scope_idx" on "catalog_product_categories" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_categories" add constraint "catalog_product_categories_slug_unique" unique ("organization_id", "tenant_id", "slug");`);

    this.addSql(`create table "catalog_product_category_assignments" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "category_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "position" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_category_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_category_assignments_scope_idx" on "catalog_product_category_assignments" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_category_assignments" add constraint "catalog_product_category_assignments_unique" unique ("product_id", "category_id");`);

    this.addSql(`create table "catalog_product_offers" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "channel_id" uuid not null, "title" text not null, "description" text null, "metadata" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "default_media_id" uuid null, "default_media_url" text null, constraint "catalog_product_offers_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_product_offers" add constraint "catalog_product_offers_product_channel_unique" unique ("product_id", "organization_id", "tenant_id", "channel_id");`);
    this.addSql(`create index "catalog_product_offers_scope_idx" on "catalog_product_offers" ("organization_id", "tenant_id");`);

    this.addSql(`create table "catalog_product_option_schemas" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "description" text null, "schema" jsonb not null, "metadata" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "catalog_product_option_schemas_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_product_option_schemas" add constraint "catalog_product_option_schemas_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "catalog_product_option_schemas_scope_idx" on "catalog_product_option_schemas" ("organization_id", "tenant_id");`);

    this.addSql(`create table "catalog_product_option_values" ("id" uuid not null default gen_random_uuid(), "option_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "code" text not null, "label" text not null, "description" text null, "position" int4 not null default 0, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_option_values_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_product_option_values" add constraint "catalog_product_option_values_code_unique" unique ("organization_id", "tenant_id", "option_id", "code");`);
    this.addSql(`create index "catalog_product_option_values_scope_idx" on "catalog_product_option_values" ("option_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "catalog_product_options" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "code" text not null, "label" text not null, "description" text null, "position" int4 not null default 0, "is_required" bool not null default false, "is_multiple" bool not null default false, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "input_type" text not null default 'select', "input_config" jsonb null, constraint "catalog_product_options_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_options_scope_idx" on "catalog_product_options" ("product_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "catalog_product_relations" ("id" uuid not null default gen_random_uuid(), "parent_product_id" uuid not null, "child_product_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "relation_type" text not null default 'grouped', "is_required" bool not null default false, "min_quantity" int4 null, "max_quantity" int4 null, "position" int4 not null default 0, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_relations_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_relations_child_idx" on "catalog_product_relations" ("child_product_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "catalog_product_relations_parent_idx" on "catalog_product_relations" ("parent_product_id", "organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_relations" add constraint "catalog_product_relations_unique" unique ("parent_product_id", "child_product_id", "relation_type");`);

    this.addSql(`create table "catalog_product_tag_assignments" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "tag_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_tag_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_tag_assignments_scope_idx" on "catalog_product_tag_assignments" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_tag_assignments" add constraint "catalog_product_tag_assignments_unique" unique ("product_id", "tag_id");`);

    this.addSql(`create table "catalog_product_tags" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "label" text not null, "slug" text not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_tags_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_tags_scope_idx" on "catalog_product_tags" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_tags" add constraint "catalog_product_tags_slug_unique" unique ("organization_id", "tenant_id", "slug");`);

    this.addSql(`create table "catalog_product_unit_conversions" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "unit_code" text not null, "to_base_factor" numeric(24,12) not null, "sort_order" int4 not null default 0, "is_active" bool not null default true, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "catalog_product_unit_conversions_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_unit_conversions_scope_idx" on "catalog_product_unit_conversions" ("organization_id", "tenant_id", "product_id");`);
    this.addSql(`alter table "catalog_product_unit_conversions" add constraint "catalog_product_unit_conversions_unique" unique ("product_id", "unit_code");`);

    this.addSql(`create table "catalog_product_variant_option_values" ("id" uuid not null default gen_random_uuid(), "variant_id" uuid not null, "option_value_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_variant_option_values_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_product_variant_option_values" add constraint "catalog_product_variant_option_values_unique" unique ("variant_id", "option_value_id");`);

    this.addSql(`create table "catalog_product_variant_prices" ("id" uuid not null default gen_random_uuid(), "variant_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "currency_code" text not null, "kind" text not null default 'regular', "min_quantity" int4 not null default 1, "max_quantity" int4 null, "unit_price_net" numeric(16,4) null, "unit_price_gross" numeric(16,4) null, "tax_rate" numeric(7,4) null, "metadata" jsonb null, "starts_at" timestamptz(6) null, "ends_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "product_id" uuid null, "offer_id" uuid null, "channel_id" uuid null, "user_id" uuid null, "user_group_id" uuid null, "customer_id" uuid null, "customer_group_id" uuid null, "price_kind_id" uuid not null, "tax_amount" numeric(16,4) null, constraint "catalog_product_variant_prices_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_variant_prices_product_scope_idx" on "catalog_product_variant_prices" ("product_id", "organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_variant_prices" add constraint "catalog_product_variant_prices_unique" unique ("variant_id", "organization_id", "tenant_id", "currency_code", "price_kind_id", "min_quantity");`);
    this.addSql(`create index "catalog_product_variant_prices_variant_scope_idx" on "catalog_product_variant_prices" ("variant_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "catalog_product_variant_relations" ("id" uuid not null default gen_random_uuid(), "parent_variant_id" uuid not null, "child_variant_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "relation_type" text not null default 'grouped', "is_required" bool not null default false, "min_quantity" int4 null, "max_quantity" int4 null, "position" int4 not null default 0, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "catalog_product_variant_relations_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_variant_relations_child_idx" on "catalog_product_variant_relations" ("child_variant_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "catalog_product_variant_relations_parent_idx" on "catalog_product_variant_relations" ("parent_variant_id", "organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_variant_relations" add constraint "catalog_product_variant_relations_unique" unique ("parent_variant_id", "child_variant_id", "relation_type");`);

    this.addSql(`create table "catalog_product_variants" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "name" text null, "sku" text null, "barcode" text null, "status_entry_id" text null, "is_default" bool not null default false, "is_active" bool not null default true, "weight_value" numeric(16,4) null, "weight_unit" text null, "dimensions" jsonb null, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "custom_fieldset_code" text null, "default_media_id" uuid null, "default_media_url" text null, "tax_rate_id" uuid null, "tax_rate" numeric(7,4) null, "option_values" jsonb null, constraint "catalog_product_variants_pkey" primary key ("id"));`);
    this.addSql(`create index "catalog_product_variants_scope_idx" on "catalog_product_variants" ("product_id", "organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_product_variants" add constraint "catalog_product_variants_sku_unique" unique ("organization_id", "tenant_id", "sku");`);

    this.addSql(`create table "catalog_products" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "title" text not null, "description" text null, "subtitle" text null, "status_entry_id" uuid null, "primary_currency_code" text null, "default_unit" text null, "metadata" jsonb null, "is_configurable" bool not null default false, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "product_type" text not null default 'simple', "sku" text null, "handle" text null, "option_schema_id" uuid null, "custom_fieldset_code" text null, "default_media_id" uuid null, "default_media_url" text null, "weight_value" numeric(16,4) null, "weight_unit" text null, "dimensions" jsonb null, "tax_rate_id" uuid null, "tax_rate" numeric(7,4) null, "default_sales_unit" text null, "default_sales_unit_quantity" numeric(18,6) not null default '1', "uom_rounding_scale" int2 not null default 4, "uom_rounding_mode" text not null default 'half_up', "unit_price_enabled" bool not null default false, "unit_price_reference_unit" text null, "unit_price_base_quantity" numeric(18,6) null, constraint "catalog_products_pkey" primary key ("id"));`);
    this.addSql(`alter table "catalog_products" add constraint "catalog_products_handle_scope_unique" unique ("organization_id", "tenant_id", "handle");`);
    this.addSql(`create index "catalog_products_org_tenant_idx" on "catalog_products" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "catalog_products" add constraint "catalog_products_sku_scope_unique" unique ("organization_id", "tenant_id", "sku");`);

    this.addSql(`create table "competitions_agenda_item" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "title" varchar(255) not null, "description" text null, "type" text not null default 'custom', "starts_at" timestamptz(6) not null, "ends_at" timestamptz(6) not null, "location" varchar(255) null, "speaker_name" varchar(255) null, "speaker_bio" text null, "track_id" uuid null, "is_mandatory" bool not null default false, "sort_order" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "speaker_photo_url" varchar(1000) null, constraint "competitions_agenda_item_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_agenda_item_competition_id_index" on "competitions_agenda_item" ("competition_id");`);
    this.addSql(`create index "competitions_agenda_item_organization_id_index" on "competitions_agenda_item" ("organization_id");`);
    this.addSql(`create index "competitions_agenda_item_tenant_id_index" on "competitions_agenda_item" ("tenant_id");`);

    this.addSql(`create table "competitions_announcement" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "author_id" uuid not null, "title" varchar(255) not null, "content" text not null, "priority" text not null default 'info', "target_roles" jsonb not null default '[]', "target_track_ids" jsonb not null default '[]', "pinned" bool not null default false, "published_at" timestamptz(6) not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "category" text not null default 'general', "action_url" varchar(1000) null, "action_label" varchar(255) null, constraint "competitions_announcement_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_announcement_competition_id_index" on "competitions_announcement" ("competition_id");`);
    this.addSql(`create index "competitions_announcement_organization_id_index" on "competitions_announcement" ("organization_id");`);
    this.addSql(`create index "competitions_announcement_tenant_id_index" on "competitions_announcement" ("tenant_id");`);

    this.addSql(`create table "competitions_competition" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "slug" varchar(255) not null, "description" text null, "location" varchar(500) null, "starts_at" timestamptz(6) not null, "ends_at" timestamptz(6) not null, "timezone" varchar(50) not null default 'Europe/Warsaw', "stage" text not null default 'draft', "min_team_size" int4 not null default 2, "max_team_size" int4 not null default 5, "max_teams_per_track" int4 null, "allow_track_change" bool not null default false, "project_submission_deadline" timestamptz(6) null, "judging_deadline" timestamptz(6) null, "stage_config" jsonb not null default '{}', "demo_config" jsonb not null default '{}', "judging_config" jsonb not null default '{}', "peer_voting_config" jsonb not null default '{}', "code_of_conduct_url" varchar(1000) not null, "rules_url" varchar(1000) null, "privacy_policy_url" varchar(1000) null, "cover_image_url" varchar(1000) null, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "max_tracks_per_team" int4 not null default 1, "code_of_conduct_content" text null, "rules_content" text null, "privacy_policy_content" text null, constraint "competitions_competition_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_competition_organization_id_index" on "competitions_competition" ("organization_id");`);
    this.addSql(`alter table "competitions_competition" add constraint "competitions_competition_slug_tenant_id_unique" unique ("slug", "tenant_id");`);
    this.addSql(`create index "competitions_competition_tenant_id_index" on "competitions_competition" ("tenant_id");`);

    this.addSql(`create table "competitions_competition_info_card" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "key" varchar(100) not null, "icon" varchar(100) null, "label" varchar(255) not null, "value" text not null, "sort_order" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "competitions_competition_info_card_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_competition_info_card_competition_id_index" on "competitions_competition_info_card" ("competition_id");`);
    this.addSql(`create index "competitions_competition_info_card_organization_id_index" on "competitions_competition_info_card" ("organization_id");`);
    this.addSql(`create index "competitions_competition_info_card_tenant_id_index" on "competitions_competition_info_card" ("tenant_id");`);

    this.addSql(`create table "competitions_invitation" ("id" uuid not null default gen_random_uuid(), "customer_invitation_id" uuid not null, "competition_id" uuid not null, "participation_role" text not null default 'participant', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, constraint "competitions_invitation_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_invitation_competition_id_index" on "competitions_invitation" ("competition_id");`);
    this.addSql(`create index "competitions_invitation_customer_invitation_id_index" on "competitions_invitation" ("customer_invitation_id");`);
    this.addSql(`alter table "competitions_invitation" add constraint "competitions_invitation_customer_invitation_id_unique" unique ("customer_invitation_id");`);
    this.addSql(`create index "competitions_invitation_organization_id_index" on "competitions_invitation" ("organization_id");`);
    this.addSql(`create index "competitions_invitation_tenant_id_index" on "competitions_invitation" ("tenant_id");`);

    this.addSql(`create table "competitions_milestone" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "due_date" timestamptz(6) not null, "status" text not null default 'upcoming', "sort_order" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "competitions_milestone_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_milestone_competition_id_index" on "competitions_milestone" ("competition_id");`);
    this.addSql(`create index "competitions_milestone_organization_id_index" on "competitions_milestone" ("organization_id");`);
    this.addSql(`create index "competitions_milestone_tenant_id_index" on "competitions_milestone" ("tenant_id");`);

    this.addSql(`create table "competitions_participant_profile" ("id" uuid not null default gen_random_uuid(), "customer_user_id" uuid not null, "bio" text null, "organization" varchar(255) null, "skills" jsonb not null default '[]', "social_links" jsonb not null default '{}', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "avatar_url" varchar(1000) null, "portfolio_url" varchar(1000) null, "office_hours_url" varchar(1000) null, "specialty" varchar(100) null, "notification_preferences" jsonb not null default '{}', constraint "competitions_participant_profile_pkey" primary key ("id"));`);
    this.addSql(`alter table "competitions_participant_profile" add constraint "competitions_participant_profile_customer_user_id_2d5cb_unique" unique ("customer_user_id", "tenant_id");`);
    this.addSql(`create index "competitions_participant_profile_customer_user_id_index" on "competitions_participant_profile" ("customer_user_id");`);
    this.addSql(`create index "competitions_participant_profile_organization_id_index" on "competitions_participant_profile" ("organization_id");`);
    this.addSql(`create index "competitions_participant_profile_tenant_id_index" on "competitions_participant_profile" ("tenant_id");`);

    this.addSql(`create table "competitions_participation" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "customer_user_id" uuid not null, "role" text not null default 'participant', "checked_in" bool not null default false, "checked_in_at" timestamptz(6) null, "badge_printed" bool not null default false, "coc_accepted" bool not null default false, "coc_accepted_at" timestamptz(6) null, "privacy_policy_accepted" bool not null default false, "privacy_policy_accepted_at" timestamptz(6) null, "profile_complete" bool not null default false, "looking_for_team" bool not null default false, "looking_for_team_description" text null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "competitions_participation_pkey" primary key ("id"));`);
    this.addSql(`alter table "competitions_participation" add constraint "competitions_participation_competition_id_custome_2a558_unique" unique ("competition_id", "customer_user_id");`);
    this.addSql(`create index "competitions_participation_competition_id_index" on "competitions_participation" ("competition_id");`);
    this.addSql(`create index "competitions_participation_customer_user_id_index" on "competitions_participation" ("customer_user_id");`);
    this.addSql(`create index "competitions_participation_organization_id_index" on "competitions_participation" ("organization_id");`);
    this.addSql(`create index "competitions_participation_tenant_id_index" on "competitions_participation" ("tenant_id");`);

    this.addSql(`create table "competitions_portal_locale_preference" ("id" uuid not null default gen_random_uuid(), "customer_user_id" uuid not null, "locale" varchar(10) not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "competitions_portal_locale_preference_pkey" primary key ("id"));`);
    this.addSql(`alter table "competitions_portal_locale_preference" add constraint "competitions_portal_locale_preference_customer_us_df213_unique" unique ("customer_user_id", "tenant_id", "organization_id");`);
    this.addSql(`create index "competitions_portal_locale_preference_customer_user_id_index" on "competitions_portal_locale_preference" ("customer_user_id");`);
    this.addSql(`create index "competitions_portal_locale_preference_organization_id_index" on "competitions_portal_locale_preference" ("organization_id");`);
    this.addSql(`create index "competitions_portal_locale_preference_tenant_id_index" on "competitions_portal_locale_preference" ("tenant_id");`);

    this.addSql(`create table "currencies" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "code" text not null, "name" text not null, "symbol" text null, "decimal_places" int4 not null default 2, "thousands_separator" text null, "decimal_separator" text null, "is_base" bool not null default false, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "currencies_pkey" primary key ("id"));`);
    this.addSql(`alter table "currencies" add constraint "currencies_code_scope_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "currencies_scope_idx" on "currencies" ("organization_id", "tenant_id");`);

    this.addSql(`create table "currency_fetch_configs" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "provider" text not null, "is_enabled" bool not null default false, "sync_time" text null, "last_sync_at" timestamptz(6) null, "last_sync_status" text null, "last_sync_message" text null, "last_sync_count" int4 null, "config" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "currency_fetch_configs_pkey" primary key ("id"));`);
    this.addSql(`create index "currency_fetch_configs_enabled_idx" on "currency_fetch_configs" ("is_enabled", "sync_time");`);
    this.addSql(`alter table "currency_fetch_configs" add constraint "currency_fetch_configs_provider_scope_unique" unique ("organization_id", "tenant_id", "provider");`);
    this.addSql(`create index "currency_fetch_configs_scope_idx" on "currency_fetch_configs" ("organization_id", "tenant_id");`);

    this.addSql(`create table "custom_entities" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "label" text not null, "description" text null, "label_field" text null, "default_editor" text null, "show_in_sidebar" bool not null default false, "organization_id" uuid null, "tenant_id" uuid null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "custom_entities_pkey" primary key ("id"));`);
    this.addSql(`create index "custom_entities_unique_idx" on "custom_entities" ("entity_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "custom_entities_storage" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "doc" jsonb not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "custom_entities_storage_pkey" primary key ("id"));`);
    this.addSql(`create index "custom_entities_storage_unique_idx" on "custom_entities_storage" ("entity_type", "entity_id", "organization_id");`);

    this.addSql(`create table "custom_field_defs" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "key" text not null, "kind" text not null, "config_json" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "custom_field_defs_pkey" primary key ("id"));`);
    this.addSql(`create index "cf_defs_active_entity_global_idx" on "custom_field_defs" ("entity_id");`);
    this.addSql(`create index "cf_defs_active_entity_key_scope_idx" on "custom_field_defs" ("entity_id", "key", "tenant_id", "organization_id");`);
    this.addSql(`create index "cf_defs_active_entity_org_idx" on "custom_field_defs" ("entity_id", "organization_id");`);
    this.addSql(`create index "cf_defs_active_entity_tenant_idx" on "custom_field_defs" ("entity_id", "tenant_id");`);
    this.addSql(`create index "cf_defs_active_entity_tenant_org_idx" on "custom_field_defs" ("entity_id", "tenant_id", "organization_id");`);
    this.addSql(`create index "cf_defs_entity_key_idx" on "custom_field_defs" ("key");`);

    this.addSql(`create table "custom_field_entity_configs" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "config_json" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "custom_field_entity_configs_pkey" primary key ("id"));`);
    this.addSql(`create index "cf_entity_cfgs_entity_org_idx" on "custom_field_entity_configs" ("entity_id", "organization_id");`);
    this.addSql(`create index "cf_entity_cfgs_entity_scope_idx" on "custom_field_entity_configs" ("entity_id", "tenant_id", "organization_id");`);
    this.addSql(`create index "cf_entity_cfgs_entity_tenant_idx" on "custom_field_entity_configs" ("entity_id", "tenant_id");`);

    this.addSql(`create table "custom_field_values" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "record_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "field_key" text not null, "value_text" text null, "value_multiline" text null, "value_int" int4 null, "value_float" float4 null, "value_bool" bool null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "custom_field_values_pkey" primary key ("id"));`);
    this.addSql(`create index "cf_values_entity_record_field_idx" on "custom_field_values" ("field_key");`);
    this.addSql(`create index "cf_values_entity_record_tenant_idx" on "custom_field_values" ("entity_id", "record_id", "tenant_id");`);

    this.addSql(`create table "customer_activities" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "activity_type" text not null, "subject" text null, "body" text null, "occurred_at" timestamptz(6) null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "entity_id" uuid not null, "deal_id" uuid null, constraint "customer_activities_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_activities_entity_idx" on "customer_activities" ("entity_id");`);
    this.addSql(`create index "customer_activities_entity_occurred_created_idx" on "customer_activities" ("entity_id", "occurred_at", "created_at");`);
    this.addSql(`create index "customer_activities_org_tenant_idx" on "customer_activities" ("organization_id", "tenant_id");`);

    this.addSql(`create table "customer_addresses" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text null, "purpose" text null, "address_line1" text not null, "address_line2" text null, "city" text null, "region" text null, "postal_code" text null, "country" text null, "building_number" text null, "flat_number" text null, "latitude" float4 null, "longitude" float4 null, "is_primary" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "entity_id" uuid not null, "company_name" text null, constraint "customer_addresses_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_addresses_entity_idx" on "customer_addresses" ("entity_id");`);

    this.addSql(`create table "customer_comments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "body" text not null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "entity_id" uuid not null, "deal_id" uuid null, constraint "customer_comments_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_comments_entity_created_idx" on "customer_comments" ("entity_id", "created_at");`);
    this.addSql(`create index "customer_comments_entity_idx" on "customer_comments" ("entity_id");`);

    this.addSql(`create table "customer_companies" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "legal_name" text null, "brand_name" text null, "domain" text null, "website_url" text null, "industry" text null, "size_bucket" text null, "annual_revenue" numeric(16,2) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "entity_id" uuid not null, constraint "customer_companies_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_companies" add constraint "customer_companies_entity_id_unique" unique ("entity_id");`);
    this.addSql(`create index "customer_companies_org_tenant_idx" on "customer_companies" ("organization_id", "tenant_id");`);
    this.addSql(`create index "idx_customer_companies_entity_id" on "customer_companies" ("entity_id");`);

    this.addSql(`create table "customer_deal_companies" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz(6) not null, "deal_id" uuid not null, "company_entity_id" uuid not null, constraint "customer_deal_companies_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_deal_companies_company_idx" on "customer_deal_companies" ("company_entity_id");`);
    this.addSql(`create index "customer_deal_companies_deal_idx" on "customer_deal_companies" ("deal_id");`);
    this.addSql(`alter table "customer_deal_companies" add constraint "customer_deal_companies_unique" unique ("deal_id", "company_entity_id");`);

    this.addSql(`create table "customer_deal_people" ("id" uuid not null default gen_random_uuid(), "role" text null, "created_at" timestamptz(6) not null, "deal_id" uuid not null, "person_entity_id" uuid not null, constraint "customer_deal_people_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_deal_people_deal_idx" on "customer_deal_people" ("deal_id");`);
    this.addSql(`create index "customer_deal_people_person_idx" on "customer_deal_people" ("person_entity_id");`);
    this.addSql(`alter table "customer_deal_people" add constraint "customer_deal_people_unique" unique ("deal_id", "person_entity_id");`);

    this.addSql(`create table "customer_deals" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "title" text not null, "description" text null, "status" text not null default 'open', "pipeline_stage" text null, "value_amount" numeric(14,2) null, "value_currency" text null, "probability" int4 null, "expected_close_at" timestamptz(6) null, "owner_user_id" uuid null, "source" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "pipeline_id" uuid null, "pipeline_stage_id" uuid null, constraint "customer_deals_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_deals_org_tenant_idx" on "customer_deals" ("organization_id", "tenant_id");`);

    this.addSql(`create table "customer_dictionary_entries" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "kind" text not null, "value" text not null, "normalized_value" text not null, "label" text not null, "color" text null, "icon" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "customer_dictionary_entries_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_dictionary_entries_scope_idx" on "customer_dictionary_entries" ("organization_id", "tenant_id", "kind");`);
    this.addSql(`alter table "customer_dictionary_entries" add constraint "customer_dictionary_entries_unique" unique ("organization_id", "tenant_id", "kind", "normalized_value");`);

    this.addSql(`create table "customer_entities" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "kind" text not null, "display_name" text not null, "description" text null, "owner_user_id" uuid null, "primary_email" text null, "primary_phone" text null, "status" text null, "lifecycle_stage" text null, "source" text null, "next_interaction_at" timestamptz(6) null, "next_interaction_name" text null, "next_interaction_ref_id" text null, "next_interaction_icon" text null, "next_interaction_color" text null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "customer_entities_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_entities_org_tenant_kind_idx" on "customer_entities" ("organization_id", "tenant_id", "kind");`);
    this.addSql(`create index "idx_ce_tenant_company_id" on "customer_entities" ("tenant_id", "id");`);
    this.addSql(`create index "idx_ce_tenant_org_company_id" on "customer_entities" ("tenant_id", "organization_id", "id");`);
    this.addSql(`create index "idx_ce_tenant_org_person_id" on "customer_entities" ("tenant_id", "organization_id", "id");`);
    this.addSql(`create index "idx_ce_tenant_person_id" on "customer_entities" ("tenant_id", "id");`);

    this.addSql(`create table "customer_people" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "first_name" text null, "last_name" text null, "preferred_name" text null, "job_title" text null, "department" text null, "seniority" text null, "timezone" text null, "linked_in_url" text null, "twitter_url" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "entity_id" uuid not null, "company_entity_id" uuid null, constraint "customer_people_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_people" add constraint "customer_people_entity_id_unique" unique ("entity_id");`);
    this.addSql(`create index "customer_people_org_tenant_idx" on "customer_people" ("organization_id", "tenant_id");`);
    this.addSql(`create index "idx_customer_people_entity_id" on "customer_people" ("entity_id");`);

    this.addSql(`create table "customer_pipeline_stages" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "pipeline_id" uuid not null, "name" text not null, "position" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "customer_pipeline_stages_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_pipeline_stages_org_tenant_idx" on "customer_pipeline_stages" ("organization_id", "tenant_id");`);
    this.addSql(`CREATE INDEX customer_pipeline_stages_pipeline_position_idx ON public.customer_pipeline_stages USING btree (pipeline_id, "position");`);

    this.addSql(`create table "customer_pipelines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "is_default" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "customer_pipelines_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_pipelines_org_tenant_idx" on "customer_pipelines" ("organization_id", "tenant_id");`);

    this.addSql(`create table "customer_role_acls" ("id" uuid not null default gen_random_uuid(), "role_id" uuid not null, "tenant_id" uuid not null, "features_json" jsonb null, "is_portal_admin" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "customer_role_acls_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_role_acls" add constraint "customer_role_acls_role_tenant_uniq" unique ("role_id", "tenant_id");`);

    this.addSql(`create table "customer_roles" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "slug" text not null, "description" text null, "is_default" bool not null default false, "is_system" bool not null default false, "customer_assignable" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "customer_roles_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_roles" add constraint "customer_roles_tenant_slug_uniq" unique ("tenant_id", "slug");`);

    this.addSql(`create table "customer_settings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "address_format" text not null default 'line_first', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "customer_settings_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_settings" add constraint "customer_settings_scope_unique" unique ("organization_id", "tenant_id");`);

    this.addSql(`create table "customer_tag_assignments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "tag_id" uuid not null, "entity_id" uuid not null, constraint "customer_tag_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_tag_assignments_entity_idx" on "customer_tag_assignments" ("entity_id");`);
    this.addSql(`alter table "customer_tag_assignments" add constraint "customer_tag_assignments_unique" unique ("tag_id", "entity_id");`);

    this.addSql(`create table "customer_tags" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "slug" text not null, "label" text not null, "color" text null, "description" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "customer_tags_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_tags" add constraint "customer_tags_org_slug_unique" unique ("organization_id", "tenant_id", "slug");`);
    this.addSql(`create index "customer_tags_org_tenant_idx" on "customer_tags" ("organization_id", "tenant_id");`);

    this.addSql(`create table "customer_todo_links" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "todo_id" uuid not null, "todo_source" text not null default 'example:todo', "created_at" timestamptz(6) not null, "created_by_user_id" uuid null, "entity_id" uuid not null, constraint "customer_todo_links_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_todo_links_entity_created_idx" on "customer_todo_links" ("entity_id", "created_at");`);
    this.addSql(`create index "customer_todo_links_entity_idx" on "customer_todo_links" ("entity_id");`);
    this.addSql(`alter table "customer_todo_links" add constraint "customer_todo_links_unique" unique ("entity_id", "todo_id", "todo_source");`);

    this.addSql(`create table "customer_user_acls" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid not null, "features_json" jsonb null, "is_portal_admin" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "customer_user_acls_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_user_acls" add constraint "customer_user_acls_user_tenant_uniq" unique ("user_id", "tenant_id");`);

    this.addSql(`create table "customer_user_email_verifications" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token" text not null, "purpose" text not null default 'email_verification', "expires_at" timestamptz(6) not null, "used_at" timestamptz(6) null, "created_at" timestamptz(6) not null, constraint "customer_user_email_verifications_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_user_email_verifications_token_idx" on "customer_user_email_verifications" ("token");`);

    this.addSql(`create table "customer_user_invitations" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "email" text not null, "email_hash" text not null, "token" text not null, "customer_entity_id" uuid null, "role_ids_json" jsonb null, "invited_by_user_id" uuid null, "invited_by_customer_user_id" uuid null, "display_name" text null, "expires_at" timestamptz(6) not null, "accepted_at" timestamptz(6) null, "cancelled_at" timestamptz(6) null, "created_at" timestamptz(6) not null, constraint "customer_user_invitations_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_user_invitations_tenant_email_hash_idx" on "customer_user_invitations" ("tenant_id", "email_hash");`);
    this.addSql(`create index "customer_user_invitations_token_idx" on "customer_user_invitations" ("token");`);

    this.addSql(`create table "customer_user_password_resets" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token" text not null, "expires_at" timestamptz(6) not null, "used_at" timestamptz(6) null, "created_at" timestamptz(6) not null, constraint "customer_user_password_resets_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_user_password_resets_token_idx" on "customer_user_password_resets" ("token");`);

    this.addSql(`create table "customer_user_roles" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "role_id" uuid not null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "customer_user_roles_pkey" primary key ("id"));`);
    this.addSql(`alter table "customer_user_roles" add constraint "customer_user_roles_user_role_uniq" unique ("user_id", "role_id");`);

    this.addSql(`create table "customer_user_sessions" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token_hash" text not null, "ip_address" text null, "user_agent" text null, "expires_at" timestamptz(6) not null, "last_used_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "customer_user_sessions_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_user_sessions_token_hash_idx" on "customer_user_sessions" ("token_hash");`);

    this.addSql(`create table "customer_users" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "email" text not null, "email_hash" text not null, "password_hash" text null, "display_name" text not null, "email_verified_at" timestamptz(6) null, "failed_login_attempts" int4 not null default 0, "locked_until" timestamptz(6) null, "last_login_at" timestamptz(6) null, "person_entity_id" uuid null, "customer_entity_id" uuid null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "customer_users_pkey" primary key ("id"));`);
    this.addSql(`create index "customer_users_customer_entity_idx" on "customer_users" ("customer_entity_id");`);
    this.addSql(`create index "customer_users_email_hash_idx" on "customer_users" ("email_hash");`);
    this.addSql(`create index "customer_users_person_entity_idx" on "customer_users" ("person_entity_id");`);
    this.addSql(`alter table "customer_users" add constraint "customer_users_tenant_email_hash_uniq" unique ("tenant_id", "email_hash");`);

    this.addSql(`create table "dashboard_layouts" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "layout_json" jsonb not null default '[]', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "dashboard_layouts_pkey" primary key ("id"));`);
    this.addSql(`alter table "dashboard_layouts" add constraint "dashboard_layouts_user_id_tenant_id_organization_id_unique" unique ("user_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "dashboard_role_widgets" ("id" uuid not null default gen_random_uuid(), "role_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "widget_ids_json" jsonb not null default '[]', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "dashboard_role_widgets_pkey" primary key ("id"));`);
    this.addSql(`alter table "dashboard_role_widgets" add constraint "dashboard_role_widgets_role_id_tenant_id_organization_id_unique" unique ("role_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "dashboard_user_widgets" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "mode" text not null default 'inherit', "widget_ids_json" jsonb not null default '[]', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "dashboard_user_widgets_pkey" primary key ("id"));`);
    this.addSql(`alter table "dashboard_user_widgets" add constraint "dashboard_user_widgets_user_id_tenant_id_organization_id_unique" unique ("user_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "dictionaries" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "key" text not null, "name" text not null, "description" text null, "is_system" bool not null default false, "is_active" bool not null default true, "manager_visibility" text not null default 'default', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "dictionaries_pkey" primary key ("id"));`);
    this.addSql(`alter table "dictionaries" add constraint "dictionaries_scope_key_unique" unique ("organization_id", "tenant_id", "key");`);

    this.addSql(`create table "dictionary_entries" ("id" uuid not null default gen_random_uuid(), "dictionary_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "value" text not null, "normalized_value" text not null, "label" text not null, "color" text null, "icon" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "dictionary_entries_pkey" primary key ("id"));`);
    this.addSql(`create index "dictionary_entries_scope_idx" on "dictionary_entries" ("dictionary_id", "organization_id", "tenant_id");`);
    this.addSql(`alter table "dictionary_entries" add constraint "dictionary_entries_unique" unique ("dictionary_id", "organization_id", "tenant_id", "normalized_value");`);

    this.addSql(`create table "encryption_maps" ("id" uuid not null default gen_random_uuid(), "entity_id" text not null, "tenant_id" uuid null, "organization_id" uuid null, "fields_json" jsonb null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "encryption_maps_pkey" primary key ("id"));`);
    this.addSql(`create index "encryption_maps_entity_scope_idx" on "encryption_maps" ("entity_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "entity_index_coverage" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "tenant_id" uuid null, "organization_id" uuid null, "with_deleted" bool not null default false, "base_count" int4 not null default 0, "indexed_count" int4 not null default 0, "vector_indexed_count" int4 not null default 0, "refreshed_at" timestamptz(6) not null, constraint "entity_index_coverage_pkey" primary key ("id"));`);
    this.addSql(`alter table "entity_index_coverage" add constraint "entity_index_coverage_scope_idx" unique ("entity_type", "tenant_id", "organization_id", "with_deleted");`);

    this.addSql(`create table "entity_index_jobs" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "organization_id" uuid null, "tenant_id" uuid null, "partition_index" int4 null, "partition_count" int4 null, "processed_count" int4 null, "total_count" int4 null, "heartbeat_at" timestamptz(6) null, "status" text not null, "started_at" timestamptz(6) not null, "finished_at" timestamptz(6) null, constraint "entity_index_jobs_pkey" primary key ("id"));`);
    this.addSql(`create index "entity_index_jobs_org_idx" on "entity_index_jobs" ("organization_id");`);
    this.addSql(`create index "entity_index_jobs_type_idx" on "entity_index_jobs" ("entity_type");`);

    this.addSql(`create table "entity_indexes" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "doc" jsonb not null, "embedding" jsonb null, "index_version" int4 not null default 1, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "entity_indexes_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_company_profile_doc_idx ON public.entity_indexes USING btree (entity_id, organization_id, tenant_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_company_profile'::text) AND (organization_id IS NOT NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_company_profile_tenant_doc_idx ON public.entity_indexes USING btree (tenant_id, entity_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_company_profile'::text) AND (organization_id IS NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_entity_doc_idx ON public.entity_indexes USING btree (entity_id, organization_id, tenant_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_entity'::text) AND (organization_id IS NOT NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_entity_tenant_doc_idx ON public.entity_indexes USING btree (tenant_id, entity_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_entity'::text) AND (organization_id IS NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_person_profile_doc_idx ON public.entity_indexes USING btree (entity_id, organization_id, tenant_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_person_profile'::text) AND (organization_id IS NOT NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`CREATE INDEX entity_indexes_customer_person_profile_tenant_doc_idx ON public.entity_indexes USING btree (tenant_id, entity_id) INCLUDE (doc) WHERE ((deleted_at IS NULL) AND (entity_type = 'customers:customer_person_profile'::text) AND (organization_id IS NULL) AND (tenant_id IS NOT NULL));`);
    this.addSql(`create index "entity_indexes_entity_idx" on "entity_indexes" ("entity_id");`);
    this.addSql(`create index "entity_indexes_org_idx" on "entity_indexes" ("organization_id");`);
    this.addSql(`create index "entity_indexes_type_idx" on "entity_indexes" ("entity_type");`);
    this.addSql(`create index "entity_indexes_type_tenant_idx" on "entity_indexes" ("entity_type", "tenant_id");`);

    this.addSql(`create table "entity_translations" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "translations" jsonb not null default '{}', "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), constraint "entity_translations_pkey" primary key ("id"));`);
    this.addSql(`create index "entity_translations_entity_idx" on "entity_translations" ("entity_id");`);
    this.addSql(`CREATE UNIQUE INDEX entity_translations_scope_uq ON public.entity_translations USING btree (entity_type, entity_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));`);
    this.addSql(`create index "entity_translations_type_idx" on "entity_translations" ("entity_type");`);
    this.addSql(`create index "entity_translations_type_tenant_idx" on "entity_translations" ("entity_type", "tenant_id");`);

    this.addSql(`create table "example_customer_priorities" ("id" uuid not null default gen_random_uuid(), "customer_id" uuid not null, "priority" text not null default 'normal', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "example_customer_priorities_pkey" primary key ("id"));`);
    this.addSql(`create index "example_customer_priorities_customer_idx" on "example_customer_priorities" ("customer_id");`);
    this.addSql(`create index "example_customer_priorities_org_tenant_idx" on "example_customer_priorities" ("organization_id", "tenant_id");`);

    this.addSql(`create table "example_items" ("id" uuid not null default gen_random_uuid(), "title" text not null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "example_items_pkey" primary key ("id"));`);

    this.addSql(`create table "exchange_rates" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "from_currency_code" text not null, "to_currency_code" text not null, "rate" numeric(18,8) not null, "date" timestamptz(6) not null, "source" text not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "type" text null, constraint "exchange_rates_pkey" primary key ("id"));`);
    this.addSql(`alter table "exchange_rates" add constraint "exchange_rates_pair_datetime_source_unique" unique ("organization_id", "tenant_id", "from_currency_code", "to_currency_code", "date", "source");`);
    this.addSql(`create index "exchange_rates_pair_idx" on "exchange_rates" ("from_currency_code", "to_currency_code", "date");`);
    this.addSql(`create index "exchange_rates_scope_idx" on "exchange_rates" ("organization_id", "tenant_id");`);

    this.addSql(`create table "feature_toggle_audit_logs" ("id" uuid not null default gen_random_uuid(), "toggle_id" uuid not null, "organization_id" uuid null, "actor_user_id" uuid null, "action" text not null, "previous_value" jsonb null, "new_value" jsonb null, "changed_fields" jsonb null, "created_at" timestamptz(6) not null, constraint "feature_toggle_audit_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "feature_toggle_audit_action_idx" on "feature_toggle_audit_logs" ("action", "created_at");`);
    this.addSql(`create index "feature_toggle_audit_actor_idx" on "feature_toggle_audit_logs" ("actor_user_id", "created_at");`);
    this.addSql(`create index "feature_toggle_audit_org_idx" on "feature_toggle_audit_logs" ("organization_id", "created_at");`);
    this.addSql(`create index "feature_toggle_audit_toggle_idx" on "feature_toggle_audit_logs" ("toggle_id", "created_at");`);

    this.addSql(`create table "feature_toggle_overrides" ("id" uuid not null default gen_random_uuid(), "toggle_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "value" jsonb not null, constraint "feature_toggle_overrides_pkey" primary key ("id"));`);
    this.addSql(`create index "feature_toggle_overrides_tenant_idx" on "feature_toggle_overrides" ("tenant_id");`);
    this.addSql(`create index "feature_toggle_overrides_toggle_idx" on "feature_toggle_overrides" ("toggle_id");`);
    this.addSql(`alter table "feature_toggle_overrides" add constraint "feature_toggle_overrides_toggle_tenant_unique" unique ("toggle_id", "tenant_id");`);

    this.addSql(`create table "feature_toggles" ("id" uuid not null default gen_random_uuid(), "identifier" text not null, "name" text not null, "description" text null, "category" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "default_value" jsonb not null, "type" text not null, constraint "feature_toggles_pkey" primary key ("id"));`);
    this.addSql(`create index "feature_toggles_category_idx" on "feature_toggles" ("category");`);
    this.addSql(`alter table "feature_toggles" add constraint "feature_toggles_identifier_unique" unique ("identifier");`);
    this.addSql(`create index "feature_toggles_name_idx" on "feature_toggles" ("name");`);

    this.addSql(`create table "gateway_transactions" ("id" uuid not null default gen_random_uuid(), "payment_id" uuid not null, "provider_key" text not null, "provider_session_id" text null, "gateway_payment_id" text null, "gateway_refund_id" text null, "unified_status" text not null default 'pending', "gateway_status" text null, "redirect_url" text null, "client_secret" text null, "amount" numeric(18,4) not null, "currency_code" text not null, "gateway_metadata" jsonb null, "webhook_log" jsonb null, "last_webhook_at" timestamptz(6) null, "last_polled_at" timestamptz(6) null, "expires_at" timestamptz(6) null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "gateway_transactions_pkey" primary key ("id"));`);
    this.addSql(`create index "gateway_transactions_organization_id_tenant_id_uni_5a9b9_index" on "gateway_transactions" ("organization_id", "tenant_id", "unified_status");`);
    this.addSql(`create index "gateway_transactions_payment_id_organization_id_tenant_id_index" on "gateway_transactions" ("payment_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "gateway_transactions_provider_key_provider_session_d8577_index" on "gateway_transactions" ("provider_key", "provider_session_id", "organization_id");`);

    this.addSql(`create table "gateway_webhook_events" ("id" uuid not null default gen_random_uuid(), "provider_key" text not null, "idempotency_key" text not null, "event_type" text not null, "organization_id" uuid not null, "tenant_id" uuid not null, "processed_at" timestamptz(6) not null, constraint "gateway_webhook_events_pkey" primary key ("id"));`);
    this.addSql(`create index "gateway_webhook_events_idempotency_unique" on "gateway_webhook_events" ("idempotency_key", "provider_key", "organization_id", "tenant_id");`);

    this.addSql(`create table "inbox_discrepancies" ("id" uuid not null default gen_random_uuid(), "proposal_id" uuid not null, "action_id" uuid null, "type" text not null, "severity" text not null, "description" text not null, "expected_value" text null, "found_value" text null, "resolved" bool not null default false, "metadata" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "inbox_discrepancies_pkey" primary key ("id"));`);
    this.addSql(`create index "inbox_discrepancies_organization_id_tenant_id_index" on "inbox_discrepancies" ("organization_id", "tenant_id");`);
    this.addSql(`create index "inbox_discrepancies_proposal_id_index" on "inbox_discrepancies" ("proposal_id");`);

    this.addSql(`create table "inbox_emails" ("id" uuid not null default gen_random_uuid(), "message_id" text null, "content_hash" text null, "forwarded_by_address" text not null, "forwarded_by_name" text null, "to_address" text not null, "subject" text not null, "reply_to" text null, "in_reply_to" text null, "references" jsonb null, "raw_text" text null, "raw_html" text null, "cleaned_text" text null, "thread_messages" jsonb null, "detected_language" text null, "attachment_ids" jsonb null, "received_at" timestamptz(6) not null, "status" text not null default 'received', "processing_error" text null, "is_active" bool not null default true, "metadata" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "inbox_emails_pkey" primary key ("id"));`);
    this.addSql(`alter table "inbox_emails" add constraint "inbox_emails_organization_id_tenant_id_content_hash_unique" unique ("organization_id", "tenant_id", "content_hash");`);
    this.addSql(`create index "inbox_emails_organization_id_tenant_id_index" on "inbox_emails" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "inbox_emails" add constraint "inbox_emails_organization_id_tenant_id_message_id_unique" unique ("organization_id", "tenant_id", "message_id");`);
    this.addSql(`create index "inbox_emails_organization_id_tenant_id_received_at_index" on "inbox_emails" ("organization_id", "tenant_id", "received_at");`);
    this.addSql(`create index "inbox_emails_organization_id_tenant_id_status_index" on "inbox_emails" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "inbox_proposal_actions" ("id" uuid not null default gen_random_uuid(), "proposal_id" uuid not null, "sort_order" int4 not null, "action_type" text not null, "description" text not null, "payload" jsonb not null, "status" text not null default 'pending', "confidence" numeric(3,2) not null, "required_feature" text null, "matched_entity_id" uuid null, "matched_entity_type" text null, "created_entity_id" uuid null, "created_entity_type" text null, "execution_error" text null, "executed_at" timestamptz(6) null, "executed_by_user_id" uuid null, "is_active" bool not null default true, "metadata" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "inbox_proposal_actions_pkey" primary key ("id"));`);
    this.addSql(`create index "inbox_proposal_actions_organization_id_tenant_id_status_index" on "inbox_proposal_actions" ("organization_id", "tenant_id", "status");`);
    this.addSql(`create index "inbox_proposal_actions_proposal_id_index" on "inbox_proposal_actions" ("proposal_id");`);

    this.addSql(`create table "inbox_proposals" ("id" uuid not null default gen_random_uuid(), "inbox_email_id" uuid not null, "summary" text not null, "participants" jsonb not null, "confidence" numeric(3,2) not null, "detected_language" text null, "status" text not null default 'pending', "possibly_incomplete" bool not null default false, "reviewed_by_user_id" uuid null, "reviewed_at" timestamptz(6) null, "llm_model" text null, "llm_tokens_used" int4 null, "is_active" bool not null default true, "metadata" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "working_language" text null, "translations" jsonb null, "category" text null, constraint "inbox_proposals_pkey" primary key ("id"));`);
    this.addSql(`create index "inbox_proposals_inbox_email_id_index" on "inbox_proposals" ("inbox_email_id");`);
    this.addSql(`create index "inbox_proposals_organization_id_tenant_id_category_index" on "inbox_proposals" ("organization_id", "tenant_id", "category");`);
    this.addSql(`create index "inbox_proposals_organization_id_tenant_id_index" on "inbox_proposals" ("organization_id", "tenant_id");`);
    this.addSql(`create index "inbox_proposals_organization_id_tenant_id_status_index" on "inbox_proposals" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "inbox_settings" ("id" uuid not null default gen_random_uuid(), "inbox_address" text not null, "is_active" bool not null default true, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "working_language" text not null default 'en', constraint "inbox_settings_pkey" primary key ("id"));`);
    this.addSql(`alter table "inbox_settings" add constraint "inbox_settings_inbox_address_unique" unique ("inbox_address");`);
    this.addSql(`create index "inbox_settings_organization_id_tenant_id_index" on "inbox_settings" ("organization_id", "tenant_id");`);

    this.addSql(`create table "incidents_report" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "reporter_id" uuid null, "reported_user_id" uuid null, "description" text not null, "severity" text not null default 'low', "status" text not null default 'reported', "admin_notes" text null, "resolved_by" uuid null, "resolution_description" text null, "resolved_at" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "incidents_report_pkey" primary key ("id"));`);
    this.addSql(`create index "incidents_report_competition_id_index" on "incidents_report" ("competition_id");`);
    this.addSql(`create index "incidents_report_organization_id_index" on "incidents_report" ("organization_id");`);
    this.addSql(`create index "incidents_report_severity_index" on "incidents_report" ("severity");`);
    this.addSql(`create index "incidents_report_status_index" on "incidents_report" ("status");`);
    this.addSql(`create index "incidents_report_tenant_id_index" on "incidents_report" ("tenant_id");`);

    this.addSql(`create table "indexer_error_logs" ("id" uuid not null default gen_random_uuid(), "source" text not null, "handler" text not null, "entity_type" text null, "record_id" text null, "tenant_id" uuid null, "organization_id" uuid null, "payload" jsonb null, "message" text not null, "stack" text null, "occurred_at" timestamptz(6) not null, constraint "indexer_error_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "indexer_error_logs_occurred_idx" on "indexer_error_logs" ("occurred_at");`);
    this.addSql(`create index "indexer_error_logs_source_idx" on "indexer_error_logs" ("source");`);

    this.addSql(`create table "indexer_status_logs" ("id" uuid not null default gen_random_uuid(), "source" text not null, "handler" text not null, "level" text not null default 'info', "entity_type" text null, "record_id" text null, "tenant_id" uuid null, "organization_id" uuid null, "message" text not null, "details" jsonb null, "occurred_at" timestamptz(6) not null default now(), constraint "indexer_status_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "indexer_status_logs_occurred_idx" on "indexer_status_logs" ("occurred_at");`);
    this.addSql(`create index "indexer_status_logs_source_idx" on "indexer_status_logs" ("source");`);

    this.addSql(`create table "integration_credentials" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "credentials" jsonb not null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "integration_credentials_pkey" primary key ("id"));`);
    this.addSql(`create index "integration_credentials_integration_id_organizatio_291ea_index" on "integration_credentials" ("integration_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "integration_logs" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "run_id" uuid null, "scope_entity_type" text null, "scope_entity_id" uuid null, "level" text not null, "message" text not null, "code" text null, "payload" jsonb null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, constraint "integration_logs_pkey" primary key ("id"));`);
    this.addSql(`create index "integration_logs_integration_id_organization_id_te_38189_index" on "integration_logs" ("integration_id", "organization_id", "tenant_id", "created_at");`);
    this.addSql(`create index "integration_logs_level_organization_id_tenant_id_c_107e7_index" on "integration_logs" ("level", "organization_id", "tenant_id", "created_at");`);

    this.addSql(`create table "integration_states" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "is_enabled" bool not null default true, "api_version" text null, "reauth_required" bool not null default false, "last_health_status" text null, "last_health_checked_at" timestamptz(6) null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "integration_states_pkey" primary key ("id"));`);
    this.addSql(`create index "integration_states_integration_id_organization_id__32acc_index" on "integration_states" ("integration_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "judging_criterion" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "track_id" uuid null, "round" text not null default 'both', "name" varchar(255) not null, "description" text null, "max_score" int4 not null default 10, "weight" float4 not null, "order" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "judging_criterion_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_criterion_competition_id_index" on "judging_criterion" ("competition_id");`);
    this.addSql(`create index "judging_criterion_organization_id_index" on "judging_criterion" ("organization_id");`);
    this.addSql(`create index "judging_criterion_tenant_id_index" on "judging_criterion" ("tenant_id");`);

    this.addSql(`create table "judging_criterion_score" ("id" uuid not null default gen_random_uuid(), "project_score_id" uuid not null, "criterion_id" uuid not null, "score" int4 not null, "note" text null, "tenant_id" uuid not null, "organization_id" uuid not null, "updated_at" timestamptz(6) not null, constraint "judging_criterion_score_pkey" primary key ("id"));`);
    this.addSql(`alter table "judging_criterion_score" add constraint "judging_criterion_score_project_score_id_criterion_id_unique" unique ("project_score_id", "criterion_id");`);
    this.addSql(`create index "judging_criterion_score_project_score_id_index" on "judging_criterion_score" ("project_score_id");`);

    this.addSql(`create table "judging_demo_session" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "team_id" uuid not null, "project_id" uuid not null, "track_id" uuid not null, "presentation_order" int4 not null, "scheduled_start" timestamptz(6) null, "presentation_duration_minutes" int4 not null default 3, "qa_duration_minutes" int4 not null default 2, "status" text not null default 'queued', "actual_start" timestamptz(6) null, "actual_end" timestamptz(6) null, "round" text not null default 'preliminary', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "judging_demo_session_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_demo_session_competition_id_index" on "judging_demo_session" ("competition_id");`);
    this.addSql(`create index "judging_demo_session_organization_id_index" on "judging_demo_session" ("organization_id");`);
    this.addSql(`create index "judging_demo_session_project_id_index" on "judging_demo_session" ("project_id");`);
    this.addSql(`create index "judging_demo_session_round_index" on "judging_demo_session" ("round");`);
    this.addSql(`create index "judging_demo_session_status_index" on "judging_demo_session" ("status");`);
    this.addSql(`create index "judging_demo_session_tenant_id_index" on "judging_demo_session" ("tenant_id");`);

    this.addSql(`create table "judging_panel" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "round" text not null default 'preliminary', "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "judging_panel_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_panel_competition_id_index" on "judging_panel" ("competition_id");`);
    this.addSql(`create index "judging_panel_organization_id_index" on "judging_panel" ("organization_id");`);
    this.addSql(`create index "judging_panel_tenant_id_index" on "judging_panel" ("tenant_id");`);

    this.addSql(`create table "judging_panel_judge" ("id" uuid not null default gen_random_uuid(), "panel_id" uuid not null, "judge_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, constraint "judging_panel_judge_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_panel_judge_panel_id_index" on "judging_panel_judge" ("panel_id");`);
    this.addSql(`alter table "judging_panel_judge" add constraint "judging_panel_judge_panel_id_judge_id_unique" unique ("panel_id", "judge_id");`);

    this.addSql(`create table "judging_panel_track" ("id" uuid not null default gen_random_uuid(), "panel_id" uuid not null, "track_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, constraint "judging_panel_track_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_panel_track_panel_id_index" on "judging_panel_track" ("panel_id");`);
    this.addSql(`alter table "judging_panel_track" add constraint "judging_panel_track_panel_id_track_id_unique" unique ("panel_id", "track_id");`);

    this.addSql(`create table "judging_project_score" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "judge_id" uuid not null, "judge_panel_id" uuid not null, "round" text not null default 'preliminary', "total_score" float4 null, "comment" text null, "private_notes" text null, "conflict_of_interest" bool not null default false, "is_submitted" bool not null default false, "submitted_at" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid not null, "competition_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "judging_project_score_pkey" primary key ("id"));`);
    this.addSql(`create index "judging_project_score_judge_id_index" on "judging_project_score" ("judge_id");`);
    this.addSql(`create index "judging_project_score_organization_id_index" on "judging_project_score" ("organization_id");`);
    this.addSql(`create index "judging_project_score_project_id_index" on "judging_project_score" ("project_id");`);
    this.addSql(`alter table "judging_project_score" add constraint "judging_project_score_project_id_judge_id_round_unique" unique ("project_id", "judge_id", "round");`);
    this.addSql(`create index "judging_project_score_round_index" on "judging_project_score" ("round");`);
    this.addSql(`create index "judging_project_score_tenant_id_index" on "judging_project_score" ("tenant_id");`);

    this.addSql(`create table "message_access_tokens" ("id" uuid not null default gen_random_uuid(), "message_id" uuid not null, "recipient_user_id" uuid not null, "token" text not null, "expires_at" timestamptz(6) not null, "used_at" timestamptz(6) null, "use_count" int4 not null default 0, "created_at" timestamptz(6) not null, constraint "message_access_tokens_pkey" primary key ("id"));`);
    this.addSql(`create index "message_access_tokens_message_idx" on "message_access_tokens" ("message_id");`);
    this.addSql(`create index "message_access_tokens_token_idx" on "message_access_tokens" ("token");`);
    this.addSql(`alter table "message_access_tokens" add constraint "message_access_tokens_token_unique" unique ("token");`);

    this.addSql(`create table "message_confirmations" ("id" uuid not null default gen_random_uuid(), "message_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid null, "confirmed" bool not null default true, "confirmed_by_user_id" uuid null, "confirmed_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "message_confirmations_pkey" primary key ("id"));`);
    this.addSql(`create index "message_confirmations_message_idx" on "message_confirmations" ("message_id");`);
    this.addSql(`alter table "message_confirmations" add constraint "message_confirmations_message_unique" unique ("message_id");`);
    this.addSql(`create index "message_confirmations_scope_idx" on "message_confirmations" ("tenant_id", "organization_id");`);

    this.addSql(`create table "message_objects" ("id" uuid not null default gen_random_uuid(), "message_id" uuid not null, "entity_module" text not null, "entity_type" text not null, "entity_id" uuid not null, "action_required" bool not null default false, "action_type" text null, "action_label" text null, "entity_snapshot" jsonb null, "created_at" timestamptz(6) not null, constraint "message_objects_pkey" primary key ("id"));`);
    this.addSql(`create index "message_objects_entity_idx" on "message_objects" ("entity_type", "entity_id");`);
    this.addSql(`create index "message_objects_message_idx" on "message_objects" ("message_id");`);

    this.addSql(`create table "message_recipients" ("id" uuid not null default gen_random_uuid(), "message_id" uuid not null, "recipient_user_id" uuid not null, "recipient_type" text not null default 'to', "status" text not null default 'unread', "read_at" timestamptz(6) null, "archived_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, "email_sent_at" timestamptz(6) null, "email_delivered_at" timestamptz(6) null, "email_opened_at" timestamptz(6) null, "email_failed_at" timestamptz(6) null, "email_error" text null, "created_at" timestamptz(6) not null, constraint "message_recipients_pkey" primary key ("id"));`);
    this.addSql(`create index "message_recipients_message_idx" on "message_recipients" ("message_id");`);
    this.addSql(`alter table "message_recipients" add constraint "message_recipients_message_user_unique" unique ("message_id", "recipient_user_id");`);
    this.addSql(`create index "message_recipients_user_idx" on "message_recipients" ("recipient_user_id", "status");`);

    this.addSql(`create table "messages" ("id" uuid not null default gen_random_uuid(), "type" text not null default 'default', "thread_id" uuid null, "parent_message_id" uuid null, "sender_user_id" uuid not null, "subject" text not null, "body" text not null, "body_format" text not null default 'text', "priority" text not null default 'normal', "status" text not null default 'draft', "is_draft" bool not null default true, "sent_at" timestamptz(6) null, "action_data" jsonb null, "action_result" jsonb null, "action_taken" text null, "action_taken_by_user_id" uuid null, "action_taken_at" timestamptz(6) null, "send_via_email" bool not null default false, "tenant_id" uuid not null, "organization_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "visibility" text null, "source_entity_type" text null, "source_entity_id" uuid null, "external_email" text null, "external_name" text null, "external_email_sent_at" timestamptz(6) null, "external_email_failed_at" timestamptz(6) null, "external_email_error" text null, constraint "messages_pkey" primary key ("id"));`);
    this.addSql(`create index "messages_sender_idx" on "messages" ("sender_user_id", "sent_at");`);
    this.addSql(`create index "messages_tenant_idx" on "messages" ("tenant_id", "organization_id");`);
    this.addSql(`create index "messages_thread_idx" on "messages" ("thread_id");`);
    this.addSql(`create index "messages_type_idx" on "messages" ("type", "tenant_id");`);

    this.addSql(`create table "mikro_orm_migrations_api_keys" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_attachments" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_audit_logs" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_auth" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_business_rules" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_catalog" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_competitions" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_configs" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_currencies" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_customer_accounts" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_customers" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_dashboards" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_data_sync" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_dictionaries" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_directory" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_entities" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_example" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_feature_toggles" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_inbox_ops" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_incidents" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_integrations" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_judging" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_messages" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_notifications" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_onboarding" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_payment_gateways" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_perspectives" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_planner" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_progress" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_projects" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_query_index" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_resources" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_sales" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_scheduler" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_shipping_carriers" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_sponsors" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_staff" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_teams" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_tracks" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_translations" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "mikro_orm_migrations_workflows" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`);

    this.addSql(`create table "module_configs" ("id" uuid not null default gen_random_uuid(), "module_id" text not null, "name" text not null, "value_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "module_configs_pkey" primary key ("id"));`);
    this.addSql(`create index "module_configs_module_idx" on "module_configs" ("module_id");`);
    this.addSql(`alter table "module_configs" add constraint "module_configs_module_name_unique" unique ("module_id", "name");`);

    this.addSql(`create table "notifications" ("id" uuid not null default gen_random_uuid(), "recipient_user_id" uuid not null, "type" text not null, "title" text not null, "body" text null, "icon" text null, "severity" text not null default 'info', "status" text not null default 'unread', "action_data" jsonb null, "action_result" jsonb null, "action_taken" text null, "source_module" text null, "source_entity_type" text null, "source_entity_id" uuid null, "link_href" text null, "group_key" text null, "created_at" timestamptz(6) not null default now(), "read_at" timestamptz(6) null, "actioned_at" timestamptz(6) null, "dismissed_at" timestamptz(6) null, "expires_at" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid null, "title_key" text null, "body_key" text null, "title_variables" jsonb null, "body_variables" jsonb null, constraint "notifications_pkey" primary key ("id"));`);
    this.addSql(`comment on column "notifications"."title_key" is 'i18n key for notification title';`);
    this.addSql(`comment on column "notifications"."body_key" is 'i18n key for notification body';`);
    this.addSql(`comment on column "notifications"."title_variables" is 'Variables for i18n interpolation in title';`);
    this.addSql(`comment on column "notifications"."body_variables" is 'Variables for i18n interpolation in body';`);
    this.addSql(`CREATE INDEX notifications_expires_idx ON public.notifications USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status <> ALL (ARRAY['actioned'::text, 'dismissed'::text])));`);
    this.addSql(`CREATE INDEX notifications_group_idx ON public.notifications USING btree (group_key, recipient_user_id) WHERE (group_key IS NOT NULL);`);
    this.addSql(`create index "notifications_recipient_status_idx" on "notifications" ("recipient_user_id", "status", "created_at");`);
    this.addSql(`CREATE INDEX notifications_source_idx ON public.notifications USING btree (source_entity_type, source_entity_id) WHERE (source_entity_id IS NOT NULL);`);
    this.addSql(`create index "notifications_tenant_idx" on "notifications" ("tenant_id", "organization_id");`);

    this.addSql(`create table "onboarding_requests" ("id" uuid not null default gen_random_uuid(), "email" text not null, "token_hash" text not null, "status" text not null default 'pending', "first_name" text not null, "last_name" text not null, "organization_name" text not null, "locale" text null, "terms_accepted" bool not null default false, "password_hash" text null, "expires_at" timestamptz(6) not null, "completed_at" timestamptz(6) null, "tenant_id" uuid null, "organization_id" uuid null, "user_id" uuid null, "last_email_sent_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, "processing_started_at" timestamptz(6) null, constraint "onboarding_requests_pkey" primary key ("id"));`);
    this.addSql(`alter table "onboarding_requests" add constraint "onboarding_requests_email_unique" unique ("email");`);
    this.addSql(`alter table "onboarding_requests" add constraint "onboarding_requests_token_hash_unique" unique ("token_hash");`);

    this.addSql(`create table "organizations" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "name" text not null, "is_active" bool not null default true, "parent_id" uuid null, "root_id" uuid null, "tree_path" text null, "depth" int4 not null default 0, "ancestor_ids" jsonb not null default '[]', "child_ids" jsonb not null default '[]', "descendant_ids" jsonb not null default '[]', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "slug" text null, constraint "organizations_pkey" primary key ("id"));`);
    this.addSql(`alter table "organizations" add constraint "organizations_tenant_slug_uniq" unique ("tenant_id", "slug");`);

    this.addSql(`create table "password_resets" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token" text not null, "expires_at" timestamptz(6) not null, "used_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "password_resets_pkey" primary key ("id"));`);
    this.addSql(`alter table "password_resets" add constraint "password_resets_token_unique" unique ("token");`);

    this.addSql(`create table "perspectives" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "table_id" text not null, "name" text not null, "settings_json" jsonb not null, "is_default" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "perspectives_pkey" primary key ("id"));`);
    this.addSql(`alter table "perspectives" add constraint "perspectives_user_id_tenant_id_organization_id_ta_2d725_unique" unique ("user_id", "tenant_id", "organization_id", "table_id", "name");`);
    this.addSql(`create index "perspectives_user_scope_idx" on "perspectives" ("user_id", "tenant_id", "organization_id", "table_id");`);

    this.addSql(`create table "planner_availability_rule_sets" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "timezone" text not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "planner_availability_rule_sets_pkey" primary key ("id"));`);
    this.addSql(`create index "planner_availability_rule_sets_tenant_org_idx" on "planner_availability_rule_sets" ("tenant_id", "organization_id");`);

    this.addSql(`create table "planner_availability_rules" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "subject_type" text check ("subject_type" in ('member', 'resource', 'ruleset')) not null, "subject_id" uuid not null, "timezone" text not null, "rrule" text not null, "exdates" jsonb not null default '[]', "kind" text check ("kind" in ('availability', 'unavailability')) not null default 'availability', "note" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "unavailability_reason_entry_id" uuid null, "unavailability_reason_value" text null, constraint "planner_availability_rules_pkey" primary key ("id"));`);
    this.addSql(`create index "planner_availability_rules_subject_idx" on "planner_availability_rules" ("subject_type", "subject_id", "tenant_id", "organization_id");`);
    this.addSql(`create index "planner_availability_rules_tenant_org_idx" on "planner_availability_rules" ("tenant_id", "organization_id");`);

    this.addSql(`create table "progress_jobs" ("id" uuid not null default gen_random_uuid(), "job_type" text not null, "name" text not null, "description" text null, "status" text not null default 'pending', "progress_percent" int2 not null default 0, "processed_count" int4 not null default 0, "total_count" int4 null, "eta_seconds" int4 null, "started_by_user_id" uuid null, "started_at" timestamptz(6) null, "heartbeat_at" timestamptz(6) null, "finished_at" timestamptz(6) null, "result_summary" jsonb null, "error_message" text null, "error_stack" text null, "meta" jsonb null, "cancellable" bool not null default false, "cancelled_by_user_id" uuid null, "cancel_requested_at" timestamptz(6) null, "parent_job_id" uuid null, "partition_index" int4 null, "partition_count" int4 null, "tenant_id" uuid not null, "organization_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "progress_jobs_pkey" primary key ("id"));`);
    this.addSql(`create index "progress_jobs_parent_idx" on "progress_jobs" ("parent_job_id");`);
    this.addSql(`create index "progress_jobs_status_tenant_idx" on "progress_jobs" ("status", "tenant_id");`);
    this.addSql(`create index "progress_jobs_type_tenant_idx" on "progress_jobs" ("job_type", "tenant_id");`);

    this.addSql(`create table "projects_project" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "competition_id" uuid not null, "track_id" uuid not null, "title" varchar(255) not null, "tagline" varchar(140) null, "description" text null, "problem_statement" text null, "solution" text null, "tech_stack" jsonb not null default '[]', "demo_url" varchar(1000) null, "repo_url" varchar(1000) null, "video_url" varchar(1000) null, "presentation_url" varchar(1000) null, "screenshot_ids" jsonb not null default '[]', "attachment_ids" jsonb not null default '[]', "uses_preexisting_code" bool not null default false, "preexisting_code_description" text null, "built_during_hackathon_description" text null, "flagged_for_reuse" bool not null default false, "flagged_by" uuid null, "flagged_at" timestamptz(6) null, "flagged_reason" text null, "status" text not null default 'draft', "submitted_at" timestamptz(6) null, "final_score" float4 null, "peer_vote_count" int4 null, "rank" int4 null, "manual_rank_override" int4 null, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "projects_project_pkey" primary key ("id"));`);
    this.addSql(`create index "projects_project_competition_id_index" on "projects_project" ("competition_id");`);
    this.addSql(`create index "projects_project_organization_id_index" on "projects_project" ("organization_id");`);
    this.addSql(`create index "projects_project_status_index" on "projects_project" ("status");`);
    this.addSql(`create index "projects_project_team_id_index" on "projects_project" ("team_id");`);
    this.addSql(`alter table "projects_project" add constraint "projects_project_team_id_track_id_competition_id_unique" unique ("team_id", "track_id", "competition_id");`);
    this.addSql(`create index "projects_project_tenant_id_index" on "projects_project" ("tenant_id");`);
    this.addSql(`create index "projects_project_track_id_index" on "projects_project" ("track_id");`);

    this.addSql(`create table "resources_resource_activities" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "activity_type" text not null, "subject" text null, "body" text null, "occurred_at" timestamptz(6) null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "resource_id" uuid not null, constraint "resources_resource_activities_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resource_activities_resource_idx" on "resources_resource_activities" ("resource_id");`);
    this.addSql(`create index "resources_resource_activities_resource_occurred_created_idx" on "resources_resource_activities" ("resource_id", "occurred_at", "created_at");`);
    this.addSql(`create index "resources_resource_activities_tenant_org_idx" on "resources_resource_activities" ("tenant_id", "organization_id");`);

    this.addSql(`create table "resources_resource_comments" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "body" text not null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "resource_id" uuid not null, constraint "resources_resource_comments_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resource_comments_resource_idx" on "resources_resource_comments" ("resource_id");`);
    this.addSql(`create index "resources_resource_comments_tenant_org_idx" on "resources_resource_comments" ("tenant_id", "organization_id");`);

    this.addSql(`create table "resources_resource_tag_assignments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "tag_id" uuid not null, "resource_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "resources_resource_tag_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resource_tag_assignments_scope_idx" on "resources_resource_tag_assignments" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "resources_resource_tag_assignments" add constraint "resources_resource_tag_assignments_unique" unique ("tag_id", "resource_id");`);

    this.addSql(`create table "resources_resource_tags" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "slug" text not null, "label" text not null, "color" text null, "description" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "resources_resource_tags_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resource_tags_scope_idx" on "resources_resource_tags" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "resources_resource_tags" add constraint "resources_resource_tags_slug_unique" unique ("organization_id", "tenant_id", "slug");`);

    this.addSql(`create table "resources_resource_types" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "resources_resource_types_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resource_types_tenant_org_idx" on "resources_resource_types" ("tenant_id", "organization_id");`);

    this.addSql(`create table "resources_resources" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "resource_type_id" uuid null, "capacity" int4 null, "capacity_unit_value" text null, "capacity_unit_name" text null, "capacity_unit_color" text null, "capacity_unit_icon" text null, "appearance_icon" text null, "appearance_color" text null, "is_active" bool not null default true, "availability_rule_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "resources_resources_pkey" primary key ("id"));`);
    this.addSql(`create index "resources_resources_tenant_org_idx" on "resources_resources" ("tenant_id", "organization_id");`);

    this.addSql(`create table "role_acls" ("id" uuid not null default gen_random_uuid(), "role_id" uuid not null, "tenant_id" uuid not null, "features_json" jsonb null, "is_super_admin" bool not null default false, "organizations_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "role_acls_pkey" primary key ("id"));`);

    this.addSql(`create table "role_perspectives" ("id" uuid not null default gen_random_uuid(), "role_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "table_id" text not null, "name" text not null, "settings_json" jsonb not null, "is_default" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "role_perspectives_pkey" primary key ("id"));`);
    this.addSql(`alter table "role_perspectives" add constraint "role_perspectives_role_id_tenant_id_organization__c5467_unique" unique ("role_id", "tenant_id", "organization_id", "table_id", "name");`);
    this.addSql(`create index "role_perspectives_role_scope_idx" on "role_perspectives" ("role_id", "tenant_id", "organization_id", "table_id");`);

    this.addSql(`create table "role_sidebar_preferences" ("id" uuid not null default gen_random_uuid(), "role_id" uuid not null, "tenant_id" uuid null, "locale" text not null, "settings_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "role_sidebar_preferences_pkey" primary key ("id"));`);
    this.addSql(`alter table "role_sidebar_preferences" add constraint "role_sidebar_preferences_role_id_tenant_id_locale_unique" unique ("role_id", "tenant_id", "locale");`);

    this.addSql(`create table "roles" ("id" uuid not null default gen_random_uuid(), "name" text not null, "tenant_id" uuid null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "roles_pkey" primary key ("id"));`);
    this.addSql(`alter table "roles" add constraint "roles_tenant_id_name_unique" unique ("tenant_id", "name");`);

    this.addSql(`create table "rule_execution_logs" ("id" bigserial primary key, "rule_id" uuid not null, "entity_id" varchar(255) not null, "entity_type" varchar(50) not null, "execution_result" varchar(20) not null, "input_context" jsonb null, "output_context" jsonb null, "error_message" text null, "execution_time_ms" int4 not null, "executed_at" timestamptz(6) not null, "tenant_id" uuid not null, "organization_id" uuid null, "executed_by" varchar(50) null);`);
    this.addSql(`create index "rule_execution_logs_entity_idx" on "rule_execution_logs" ("entity_type", "entity_id");`);
    this.addSql(`create index "rule_execution_logs_result_idx" on "rule_execution_logs" ("execution_result", "executed_at");`);
    this.addSql(`create index "rule_execution_logs_rule_idx" on "rule_execution_logs" ("rule_id");`);
    this.addSql(`create index "rule_execution_logs_tenant_org_idx" on "rule_execution_logs" ("tenant_id", "organization_id");`);

    this.addSql(`create table "rule_set_members" ("id" uuid not null default gen_random_uuid(), "rule_set_id" uuid not null, "rule_id" uuid not null, "sequence" int4 not null default 0, "enabled" bool not null default true, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, constraint "rule_set_members_pkey" primary key ("id"));`);
    this.addSql(`create index "rule_set_members_rule_idx" on "rule_set_members" ("rule_id");`);
    this.addSql(`alter table "rule_set_members" add constraint "rule_set_members_rule_set_id_rule_id_unique" unique ("rule_set_id", "rule_id");`);
    this.addSql(`create index "rule_set_members_set_idx" on "rule_set_members" ("rule_set_id", "sequence");`);
    this.addSql(`create index "rule_set_members_tenant_org_idx" on "rule_set_members" ("tenant_id", "organization_id");`);

    this.addSql(`create table "rule_sets" ("id" uuid not null default gen_random_uuid(), "set_id" varchar(50) not null, "set_name" varchar(200) not null, "description" text null, "enabled" bool not null default true, "tenant_id" uuid not null, "organization_id" uuid not null, "created_by" varchar(50) null, "updated_by" varchar(50) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "rule_sets_pkey" primary key ("id"));`);
    this.addSql(`create index "rule_sets_enabled_idx" on "rule_sets" ("enabled");`);
    this.addSql(`alter table "rule_sets" add constraint "rule_sets_set_id_tenant_id_unique" unique ("set_id", "tenant_id");`);
    this.addSql(`create index "rule_sets_tenant_org_idx" on "rule_sets" ("tenant_id", "organization_id");`);

    this.addSql(`create table "sales_channels" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "description" text null, "status_entry_id" uuid null, "status" text null, "website_url" text null, "contact_email" text null, "contact_phone" text null, "address_line1" text null, "address_line2" text null, "city" text null, "region" text null, "postal_code" text null, "country" text null, "latitude" numeric(10,6) null, "longitude" numeric(10,6) null, "is_active" bool not null default true, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_channels_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_channels" add constraint "sales_channels_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "sales_channels_org_tenant_idx" on "sales_channels" ("organization_id", "tenant_id");`);
    this.addSql(`create index "sales_channels_status_idx" on "sales_channels" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_credit_memo_lines" ("id" uuid not null default gen_random_uuid(), "credit_memo_id" uuid not null, "order_line_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "line_number" int4 not null default 0, "description" text null, "quantity" numeric(18,4) not null default '0', "quantity_unit" text null, "currency_code" text not null, "unit_price_net" numeric(18,4) not null default '0', "unit_price_gross" numeric(18,4) not null default '0', "tax_rate" numeric(7,4) not null default '0', "tax_amount" numeric(18,4) not null default '0', "total_net_amount" numeric(18,4) not null default '0', "total_gross_amount" numeric(18,4) not null default '0', "metadata" jsonb null, "normalized_quantity" numeric(18,6) not null default '0', "normalized_unit" text null, "uom_snapshot" jsonb null, constraint "sales_credit_memo_lines_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_credit_memo_lines_normalized_idx" on "sales_credit_memo_lines" ("organization_id", "tenant_id", "normalized_unit", "normalized_quantity");`);
    this.addSql(`create index "sales_credit_memo_lines_scope_idx" on "sales_credit_memo_lines" ("credit_memo_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_credit_memos" ("id" uuid not null default gen_random_uuid(), "order_id" uuid null, "invoice_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "credit_memo_number" text not null, "status_entry_id" uuid null, "status" text null, "issue_date" timestamptz(6) null, "currency_code" text not null, "subtotal_net_amount" numeric(18,4) not null default '0', "subtotal_gross_amount" numeric(18,4) not null default '0', "tax_total_amount" numeric(18,4) not null default '0', "grand_total_net_amount" numeric(18,4) not null default '0', "grand_total_gross_amount" numeric(18,4) not null default '0', "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_credit_memos_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_credit_memos" add constraint "sales_credit_memos_number_unique" unique ("organization_id", "tenant_id", "credit_memo_number");`);
    this.addSql(`create index "sales_credit_memos_scope_idx" on "sales_credit_memos" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_credit_memos_status_idx" on "sales_credit_memos" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_delivery_windows" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "description" text null, "lead_time_days" int4 null, "cutoff_time" text null, "timezone" text null, "is_active" bool not null default true, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_delivery_windows_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_delivery_windows" add constraint "sales_delivery_windows_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "sales_delivery_windows_scope_idx" on "sales_delivery_windows" ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_document_addresses" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "document_id" uuid not null, "document_kind" text not null, "order_id" uuid null, "quote_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "customer_address_id" uuid null, "name" text null, "purpose" text null, "company_name" text null, "address_line1" text not null, "address_line2" text null, "city" text null, "region" text null, "postal_code" text null, "country" text null, "building_number" text null, "flat_number" text null, "latitude" float4 null, "longitude" float4 null, "deleted_at" timestamptz(6) null, constraint "sales_document_addresses_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_document_addresses_scope_idx" on "sales_document_addresses" ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_document_sequences" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "document_kind" text not null, "current_value" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_document_sequences_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_document_sequences" add constraint "sales_document_sequences_scope_unique" unique ("organization_id", "tenant_id", "document_kind");`);

    this.addSql(`create table "sales_document_tag_assignments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "tag_id" uuid not null, "document_id" uuid not null, "document_kind" text not null, "order_id" uuid null, "quote_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "sales_document_tag_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_document_tag_assignments_scope_idx" on "sales_document_tag_assignments" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "sales_document_tag_assignments" add constraint "sales_document_tag_assignments_unique" unique ("tag_id", "document_id", "document_kind");`);

    this.addSql(`create table "sales_document_tags" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "slug" text not null, "label" text not null, "color" text null, "description" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "sales_document_tags_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_document_tags_scope_idx" on "sales_document_tags" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "sales_document_tags" add constraint "sales_document_tags_slug_unique" unique ("organization_id", "tenant_id", "slug");`);

    this.addSql(`create table "sales_invoice_lines" ("id" uuid not null default gen_random_uuid(), "invoice_id" uuid not null, "order_line_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "line_number" int4 not null default 0, "kind" text not null default 'product', "description" text null, "quantity" numeric(18,4) not null default '0', "quantity_unit" text null, "currency_code" text not null, "unit_price_net" numeric(18,4) not null default '0', "unit_price_gross" numeric(18,4) not null default '0', "discount_amount" numeric(18,4) not null default '0', "discount_percent" numeric(7,4) not null default '0', "tax_rate" numeric(7,4) not null default '0', "tax_amount" numeric(18,4) not null default '0', "total_net_amount" numeric(18,4) not null default '0', "total_gross_amount" numeric(18,4) not null default '0', "metadata" jsonb null, "normalized_quantity" numeric(18,6) not null default '0', "normalized_unit" text null, "uom_snapshot" jsonb null, constraint "sales_invoice_lines_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_invoice_lines_normalized_idx" on "sales_invoice_lines" ("organization_id", "tenant_id", "normalized_unit", "normalized_quantity");`);
    this.addSql(`create index "sales_invoice_lines_scope_idx" on "sales_invoice_lines" ("invoice_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_invoices" ("id" uuid not null default gen_random_uuid(), "order_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "invoice_number" text not null, "status_entry_id" uuid null, "status" text null, "issue_date" timestamptz(6) null, "due_date" timestamptz(6) null, "currency_code" text not null, "subtotal_net_amount" numeric(18,4) not null default '0', "subtotal_gross_amount" numeric(18,4) not null default '0', "discount_total_amount" numeric(18,4) not null default '0', "tax_total_amount" numeric(18,4) not null default '0', "grand_total_net_amount" numeric(18,4) not null default '0', "grand_total_gross_amount" numeric(18,4) not null default '0', "paid_total_amount" numeric(18,4) not null default '0', "outstanding_amount" numeric(18,4) not null default '0', "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_invoices_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_invoices" add constraint "sales_invoices_number_unique" unique ("organization_id", "tenant_id", "invoice_number");`);
    this.addSql(`create index "sales_invoices_scope_idx" on "sales_invoices" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_invoices_status_idx" on "sales_invoices" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_notes" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "context_type" text not null, "context_id" uuid not null, "order_id" uuid null, "quote_id" uuid null, "author_user_id" uuid null, "body" text not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "appearance_icon" text null, "appearance_color" text null, "deleted_at" timestamptz(6) null, constraint "sales_notes_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_notes_scope_idx" on "sales_notes" ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_order_adjustments" ("id" uuid not null default gen_random_uuid(), "order_id" uuid not null, "order_line_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "scope" text not null default 'order', "kind" text not null default 'custom', "code" text null, "label" text null, "calculator_key" text null, "promotion_id" uuid null, "rate" numeric(7,4) not null default '0', "amount_net" numeric(18,4) not null default '0', "amount_gross" numeric(18,4) not null default '0', "currency_code" text null, "metadata" jsonb null, "position" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_order_adjustments_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_order_adjustments_scope_idx" on "sales_order_adjustments" ("order_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_order_lines" ("id" uuid not null default gen_random_uuid(), "order_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "line_number" int4 not null default 0, "kind" text not null default 'product', "status_entry_id" uuid null, "status" text null, "product_id" uuid null, "product_variant_id" uuid null, "catalog_snapshot" jsonb null, "name" text null, "description" text null, "comment" text null, "quantity" numeric(18,4) not null default '0', "quantity_unit" text null, "reserved_quantity" numeric(18,4) not null default '0', "fulfilled_quantity" numeric(18,4) not null default '0', "invoiced_quantity" numeric(18,4) not null default '0', "returned_quantity" numeric(18,4) not null default '0', "currency_code" text not null, "unit_price_net" numeric(18,4) not null default '0', "unit_price_gross" numeric(18,4) not null default '0', "discount_amount" numeric(18,4) not null default '0', "discount_percent" numeric(7,4) not null default '0', "tax_rate" numeric(7,4) not null default '0', "tax_amount" numeric(18,4) not null default '0', "total_net_amount" numeric(18,4) not null default '0', "total_gross_amount" numeric(18,4) not null default '0', "configuration" jsonb null, "promotion_code" text null, "promotion_snapshot" jsonb null, "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "normalized_quantity" numeric(18,6) not null default '0', "normalized_unit" text null, "uom_snapshot" jsonb null, constraint "sales_order_lines_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_order_lines_normalized_idx" on "sales_order_lines" ("organization_id", "tenant_id", "normalized_unit", "normalized_quantity");`);
    this.addSql(`create index "sales_order_lines_scope_idx" on "sales_order_lines" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_order_lines_status_idx" on "sales_order_lines" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_orders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_number" text not null, "external_reference" text null, "customer_reference" text null, "customer_entity_id" uuid null, "customer_contact_id" uuid null, "billing_address_id" uuid null, "shipping_address_id" uuid null, "currency_code" text not null, "exchange_rate" numeric(18,8) null, "status_entry_id" uuid null, "status" text null, "fulfillment_status_entry_id" uuid null, "fulfillment_status" text null, "payment_status_entry_id" uuid null, "payment_status" text null, "tax_strategy_key" text null, "discount_strategy_key" text null, "shipping_method_snapshot" jsonb null, "payment_method_snapshot" jsonb null, "placed_at" timestamptz(6) null, "expected_delivery_at" timestamptz(6) null, "due_at" timestamptz(6) null, "comments" text null, "internal_notes" text null, "subtotal_net_amount" numeric(18,4) not null default '0', "subtotal_gross_amount" numeric(18,4) not null default '0', "discount_total_amount" numeric(18,4) not null default '0', "tax_total_amount" numeric(18,4) not null default '0', "shipping_net_amount" numeric(18,4) not null default '0', "shipping_gross_amount" numeric(18,4) not null default '0', "surcharge_total_amount" numeric(18,4) not null default '0', "grand_total_net_amount" numeric(18,4) not null default '0', "grand_total_gross_amount" numeric(18,4) not null default '0', "paid_total_amount" numeric(18,4) not null default '0', "refunded_total_amount" numeric(18,4) not null default '0', "outstanding_amount" numeric(18,4) not null default '0', "line_item_count" int4 not null default 0, "metadata" jsonb null, "custom_field_set_id" uuid null, "channel_id" uuid null, "channel_ref_id" uuid null, "shipping_method_id" uuid null, "shipping_method_ref_id" uuid null, "delivery_window_id" uuid null, "delivery_window_ref_id" uuid null, "payment_method_id" uuid null, "payment_method_ref_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "customer_snapshot" jsonb null, "billing_address_snapshot" jsonb null, "shipping_address_snapshot" jsonb null, "tax_info" jsonb null, "delivery_window_snapshot" jsonb null, "shipping_method_code" text null, "delivery_window_code" text null, "payment_method_code" text null, "totals_snapshot" jsonb null, constraint "sales_orders_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_orders_customer_idx" on "sales_orders" ("customer_entity_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_orders_fulfillment_status_idx" on "sales_orders" ("organization_id", "tenant_id", "fulfillment_status");`);
    this.addSql(`alter table "sales_orders" add constraint "sales_orders_number_unique" unique ("organization_id", "tenant_id", "order_number");`);
    this.addSql(`create index "sales_orders_org_tenant_idx" on "sales_orders" ("organization_id", "tenant_id");`);
    this.addSql(`create index "sales_orders_payment_status_idx" on "sales_orders" ("organization_id", "tenant_id", "payment_status");`);
    this.addSql(`create index "sales_orders_status_idx" on "sales_orders" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_payment_allocations" ("id" uuid not null default gen_random_uuid(), "payment_id" uuid not null, "order_id" uuid null, "invoice_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "amount" numeric(18,4) not null default '0', "currency_code" text not null, "metadata" jsonb null, constraint "sales_payment_allocations_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_payment_allocations_scope_idx" on "sales_payment_allocations" ("payment_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_payment_methods" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "description" text null, "provider_key" text null, "terms" text null, "is_active" bool not null default true, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_payment_methods_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_payment_methods" add constraint "sales_payment_methods_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "sales_payment_methods_scope_idx" on "sales_payment_methods" ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_payments" ("id" uuid not null default gen_random_uuid(), "order_id" uuid null, "payment_method_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "payment_reference" text null, "status_entry_id" uuid null, "status" text null, "amount" numeric(18,4) not null default '0', "currency_code" text not null, "captured_amount" numeric(18,4) not null default '0', "refunded_amount" numeric(18,4) not null default '0', "received_at" timestamptz(6) null, "captured_at" timestamptz(6) null, "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_payments_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_payments_scope_idx" on "sales_payments" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_payments_status_idx" on "sales_payments" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_quote_adjustments" ("id" uuid not null default gen_random_uuid(), "quote_id" uuid not null, "quote_line_id" uuid null, "organization_id" uuid not null, "tenant_id" uuid not null, "scope" text not null default 'order', "kind" text not null default 'custom', "code" text null, "label" text null, "calculator_key" text null, "promotion_id" uuid null, "rate" numeric(7,4) not null default '0', "amount_net" numeric(18,4) not null default '0', "amount_gross" numeric(18,4) not null default '0', "currency_code" text null, "metadata" jsonb null, "position" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_quote_adjustments_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_quote_adjustments_scope_idx" on "sales_quote_adjustments" ("quote_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_quote_lines" ("id" uuid not null default gen_random_uuid(), "quote_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "line_number" int4 not null default 0, "kind" text not null default 'product', "status_entry_id" uuid null, "status" text null, "product_id" uuid null, "product_variant_id" uuid null, "catalog_snapshot" jsonb null, "name" text null, "description" text null, "comment" text null, "quantity" numeric(18,4) not null default '0', "quantity_unit" text null, "currency_code" text not null, "unit_price_net" numeric(18,4) not null default '0', "unit_price_gross" numeric(18,4) not null default '0', "discount_amount" numeric(18,4) not null default '0', "discount_percent" numeric(7,4) not null default '0', "tax_rate" numeric(7,4) not null default '0', "tax_amount" numeric(18,4) not null default '0', "total_net_amount" numeric(18,4) not null default '0', "total_gross_amount" numeric(18,4) not null default '0', "configuration" jsonb null, "promotion_code" text null, "promotion_snapshot" jsonb null, "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "normalized_quantity" numeric(18,6) not null default '0', "normalized_unit" text null, "uom_snapshot" jsonb null, constraint "sales_quote_lines_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_quote_lines_normalized_idx" on "sales_quote_lines" ("organization_id", "tenant_id", "normalized_unit", "normalized_quantity");`);
    this.addSql(`create index "sales_quote_lines_scope_idx" on "sales_quote_lines" ("quote_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_quote_lines_status_idx" on "sales_quote_lines" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_quotes" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "quote_number" text not null, "status_entry_id" uuid null, "status" text null, "customer_entity_id" uuid null, "customer_contact_id" uuid null, "currency_code" text not null, "valid_from" timestamptz(6) null, "valid_until" timestamptz(6) null, "comments" text null, "subtotal_net_amount" numeric(18,4) not null default '0', "subtotal_gross_amount" numeric(18,4) not null default '0', "discount_total_amount" numeric(18,4) not null default '0', "tax_total_amount" numeric(18,4) not null default '0', "grand_total_net_amount" numeric(18,4) not null default '0', "grand_total_gross_amount" numeric(18,4) not null default '0', "line_item_count" int4 not null default 0, "metadata" jsonb null, "custom_field_set_id" uuid null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "converted_order_id" uuid null, "customer_snapshot" jsonb null, "billing_address_id" uuid null, "shipping_address_id" uuid null, "billing_address_snapshot" jsonb null, "shipping_address_snapshot" jsonb null, "tax_info" jsonb null, "shipping_method_id" uuid null, "shipping_method_code" text null, "shipping_method_ref_id" uuid null, "delivery_window_id" uuid null, "delivery_window_code" text null, "delivery_window_ref_id" uuid null, "payment_method_id" uuid null, "payment_method_code" text null, "payment_method_ref_id" uuid null, "shipping_method_snapshot" jsonb null, "delivery_window_snapshot" jsonb null, "payment_method_snapshot" jsonb null, "channel_id" uuid null, "channel_ref_id" uuid null, "external_reference" text null, "customer_reference" text null, "placed_at" timestamptz(6) null, "totals_snapshot" jsonb null, "acceptance_token" text null, "sent_at" timestamptz(6) null, constraint "sales_quotes_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_acceptance_token_unique" unique ("acceptance_token");`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_number_unique" unique ("organization_id", "tenant_id", "quote_number");`);
    this.addSql(`create index "sales_quotes_scope_idx" on "sales_quotes" ("organization_id", "tenant_id");`);
    this.addSql(`create index "sales_quotes_status_idx" on "sales_quotes" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_return_lines" ("id" uuid not null default gen_random_uuid(), "return_id" uuid not null, "order_line_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "quantity_returned" numeric(18,4) not null default '0', "unit_price_net" numeric(18,4) not null default '0', "unit_price_gross" numeric(18,4) not null default '0', "total_net_amount" numeric(18,4) not null default '0', "total_gross_amount" numeric(18,4) not null default '0', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_return_lines_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_return_lines_order_line_idx" on "sales_return_lines" ("order_line_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_return_lines_return_idx" on "sales_return_lines" ("return_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_returns" ("id" uuid not null default gen_random_uuid(), "order_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "return_number" text not null, "status_entry_id" uuid null, "status" text null, "reason" text null, "notes" text null, "returned_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sales_returns_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_returns" add constraint "sales_returns_number_unique" unique ("organization_id", "tenant_id", "return_number");`);
    this.addSql(`create index "sales_returns_scope_idx" on "sales_returns" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_returns_status_idx" on "sales_returns" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_settings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_number_format" text not null default 'ORDER-{yyyy}{mm}{dd}-{seq:5}', "quote_number_format" text not null default 'QUOTE-{yyyy}{mm}{dd}-{seq:5}', "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "order_customer_editable_statuses" jsonb null, "order_address_editable_statuses" jsonb null, constraint "sales_settings_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_settings" add constraint "sales_settings_scope_unique" unique ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_shipment_items" ("id" uuid not null default gen_random_uuid(), "shipment_id" uuid not null, "order_line_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "quantity" numeric(18,4) not null default '0', "metadata" jsonb null, constraint "sales_shipment_items_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_shipment_items_scope_idx" on "sales_shipment_items" ("shipment_id", "organization_id", "tenant_id");`);

    this.addSql(`create table "sales_shipments" ("id" uuid not null default gen_random_uuid(), "order_id" uuid not null, "organization_id" uuid not null, "tenant_id" uuid not null, "shipment_number" text null, "shipping_method_id" uuid null, "status_entry_id" uuid null, "status" text null, "carrier_name" text null, "tracking_numbers" jsonb null, "shipped_at" timestamptz(6) null, "delivered_at" timestamptz(6) null, "weight_value" numeric(16,4) null, "weight_unit" text null, "declared_value_net" numeric(18,4) null, "declared_value_gross" numeric(18,4) null, "currency_code" text null, "notes" text null, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "items_snapshot" jsonb null, constraint "sales_shipments_pkey" primary key ("id"));`);
    this.addSql(`create index "sales_shipments_scope_idx" on "sales_shipments" ("order_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "sales_shipments_status_idx" on "sales_shipments" ("organization_id", "tenant_id", "status");`);

    this.addSql(`create table "sales_shipping_methods" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "description" text null, "carrier_code" text null, "service_level" text null, "estimated_transit_days" int4 null, "base_rate_net" numeric(16,4) not null default '0', "base_rate_gross" numeric(16,4) not null default '0', "currency_code" text null, "is_active" bool not null default true, "metadata" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "provider_key" text null, constraint "sales_shipping_methods_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_shipping_methods" add constraint "sales_shipping_methods_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "sales_shipping_methods_scope_idx" on "sales_shipping_methods" ("organization_id", "tenant_id");`);

    this.addSql(`create table "sales_tax_rates" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "rate" numeric(7,4) not null, "country_code" text null, "region_code" text null, "postal_code" text null, "city" text null, "customer_group_id" uuid null, "product_category_id" uuid null, "channel_id" uuid null, "priority" int4 not null default 0, "is_compound" bool not null default false, "metadata" jsonb null, "starts_at" timestamptz(6) null, "ends_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "is_default" bool not null default false, constraint "sales_tax_rates_pkey" primary key ("id"));`);
    this.addSql(`alter table "sales_tax_rates" add constraint "sales_tax_rates_code_unique" unique ("organization_id", "tenant_id", "code");`);
    this.addSql(`create index "sales_tax_rates_scope_idx" on "sales_tax_rates" ("organization_id", "tenant_id");`);

    this.addSql(`create table "scheduled_jobs" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid null, "tenant_id" uuid null, "scope_type" text not null default 'tenant', "name" text not null, "description" text null, "schedule_type" text not null, "schedule_value" text not null, "timezone" text not null default 'UTC', "target_type" text not null, "target_queue" text null, "target_command" text null, "target_payload" jsonb null, "require_feature" text null, "is_enabled" bool not null default true, "last_run_at" timestamptz(6) null, "next_run_at" timestamptz(6) null, "source_type" text not null default 'user', "source_module" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "created_by_user_id" uuid null, "updated_by_user_id" uuid null, constraint "scheduled_jobs_pkey" primary key ("id"));`);
    this.addSql(`create index "scheduled_jobs_next_run_idx" on "scheduled_jobs" ("next_run_at");`);
    this.addSql(`create index "scheduled_jobs_org_tenant_idx" on "scheduled_jobs" ("organization_id", "tenant_id");`);
    this.addSql(`create index "scheduled_jobs_scope_idx" on "scheduled_jobs" ("scope_type", "is_enabled");`);

    this.addSql(`create table "search_tokens" ("id" uuid not null default gen_random_uuid(), "entity_type" text not null, "entity_id" text not null, "organization_id" uuid null, "tenant_id" uuid null, "field" text not null, "token_hash" text not null, "token" text null, "created_at" timestamptz(6) not null, constraint "search_tokens_pkey" primary key ("id"));`);
    this.addSql(`create index "search_tokens_entity_idx" on "search_tokens" ("entity_type", "entity_id");`);
    this.addSql(`create index "search_tokens_lookup_idx" on "search_tokens" ("entity_type", "field", "token_hash", "tenant_id", "organization_id");`);

    this.addSql(`create table "sessions" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token" text not null, "expires_at" timestamptz(6) not null, "created_at" timestamptz(6) not null, "last_used_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "sessions_pkey" primary key ("id"));`);
    this.addSql(`alter table "sessions" add constraint "sessions_token_unique" unique ("token");`);

    this.addSql(`create table "sponsors_peer_vote" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "voter_id" uuid not null, "project_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, constraint "sponsors_peer_vote_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_peer_vote_competition_id_index" on "sponsors_peer_vote" ("competition_id");`);
    this.addSql(`alter table "sponsors_peer_vote" add constraint "sponsors_peer_vote_competition_id_voter_id_project_id_unique" unique ("competition_id", "voter_id", "project_id");`);
    this.addSql(`create index "sponsors_peer_vote_project_id_index" on "sponsors_peer_vote" ("project_id");`);
    this.addSql(`create index "sponsors_peer_vote_voter_id_index" on "sponsors_peer_vote" ("voter_id");`);

    this.addSql(`create table "sponsors_prize" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "category" text not null default 'special_award', "track_id" uuid null, "sponsor_id" uuid null, "value" varchar(255) null, "rank" int4 null, "icon_url" varchar(500) null, "winning_project_id" uuid null, "winning_team_id" uuid null, "awarded_at" timestamptz(6) null, "awarded_by" uuid null, "tenant_id" uuid not null, "organization_id" uuid not null, "order" int4 not null default 0, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sponsors_prize_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_prize_competition_id_index" on "sponsors_prize" ("competition_id");`);
    this.addSql(`create index "sponsors_prize_organization_id_index" on "sponsors_prize" ("organization_id");`);
    this.addSql(`create index "sponsors_prize_tenant_id_index" on "sponsors_prize" ("tenant_id");`);

    this.addSql(`create table "sponsors_sponsor" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "tier" text not null default 'partner', "logo_url" varchar(1000) not null, "website_url" varchar(1000) null, "description" text null, "challenge_title" varchar(255) null, "challenge_description" text null, "challenge_resources_url" varchar(1000) null, "contact_name" varchar(255) null, "contact_email" varchar(255) null, "order" int4 not null default 0, "is_visible" bool not null default true, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sponsors_sponsor_pkey" primary key ("id"));`);
    this.addSql(`create index "sponsors_sponsor_competition_id_index" on "sponsors_sponsor" ("competition_id");`);
    this.addSql(`create index "sponsors_sponsor_organization_id_index" on "sponsors_sponsor" ("organization_id");`);
    this.addSql(`create index "sponsors_sponsor_tenant_id_index" on "sponsors_sponsor" ("tenant_id");`);

    this.addSql(`create table "staff_leave_requests" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "member_id" uuid not null, "start_date" timestamptz(6) not null, "end_date" timestamptz(6) not null, "timezone" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "unavailability_reason_entry_id" uuid null, "unavailability_reason_value" text null, "note" text null, "decision_comment" text null, "submitted_by_user_id" uuid null, "decided_by_user_id" uuid null, "decided_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "staff_leave_requests_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_leave_requests_member_idx" on "staff_leave_requests" ("member_id");`);
    this.addSql(`create index "staff_leave_requests_status_idx" on "staff_leave_requests" ("status", "tenant_id", "organization_id");`);
    this.addSql(`create index "staff_leave_requests_tenant_org_idx" on "staff_leave_requests" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_member_activities" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "activity_type" text not null, "subject" text null, "body" text null, "occurred_at" timestamptz(6) null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "member_id" uuid not null, constraint "staff_team_member_activities_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_member_activities_member_idx" on "staff_team_member_activities" ("member_id");`);
    this.addSql(`create index "staff_team_member_activities_member_occurred_created_idx" on "staff_team_member_activities" ("member_id", "occurred_at", "created_at");`);
    this.addSql(`create index "staff_team_member_activities_tenant_org_idx" on "staff_team_member_activities" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_member_addresses" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text null, "purpose" text null, "company_name" text null, "address_line1" text not null, "address_line2" text null, "city" text null, "region" text null, "postal_code" text null, "country" text null, "building_number" text null, "flat_number" text null, "latitude" float4 null, "longitude" float4 null, "is_primary" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "member_id" uuid not null, constraint "staff_team_member_addresses_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_member_addresses_member_idx" on "staff_team_member_addresses" ("member_id");`);
    this.addSql(`create index "staff_team_member_addresses_tenant_org_idx" on "staff_team_member_addresses" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_member_comments" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "body" text not null, "author_user_id" uuid null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "member_id" uuid not null, constraint "staff_team_member_comments_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_member_comments_member_idx" on "staff_team_member_comments" ("member_id");`);
    this.addSql(`create index "staff_team_member_comments_tenant_org_idx" on "staff_team_member_comments" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_member_job_histories" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "company_name" text null, "description" text null, "start_date" timestamptz(6) not null, "end_date" timestamptz(6) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "member_id" uuid not null, constraint "staff_team_member_job_histories_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_member_job_histories_member_idx" on "staff_team_member_job_histories" ("member_id");`);
    this.addSql(`create index "staff_team_member_job_histories_member_start_idx" on "staff_team_member_job_histories" ("member_id", "start_date");`);
    this.addSql(`create index "staff_team_member_job_histories_tenant_org_idx" on "staff_team_member_job_histories" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_members" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_id" uuid null, "display_name" text not null, "description" text null, "user_id" uuid null, "role_ids" jsonb not null default '[]', "tags" jsonb not null default '[]', "availability_rule_set_id" uuid null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "staff_team_members_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_members_tenant_org_idx" on "staff_team_members" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_team_roles" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_id" uuid null, "name" text not null, "description" text null, "appearance_icon" text null, "appearance_color" text null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "staff_team_roles_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_team_roles_tenant_org_idx" on "staff_team_roles" ("tenant_id", "organization_id");`);

    this.addSql(`create table "staff_teams" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "staff_teams_pkey" primary key ("id"));`);
    this.addSql(`create index "staff_teams_tenant_org_idx" on "staff_teams" ("tenant_id", "organization_id");`);

    this.addSql(`create table "step_instances" ("id" uuid not null default gen_random_uuid(), "workflow_instance_id" uuid not null, "step_id" varchar(100) not null, "step_name" varchar(255) not null, "step_type" varchar(50) not null, "status" varchar(20) not null, "input_data" jsonb null, "output_data" jsonb null, "error_data" jsonb null, "entered_at" timestamptz(6) null, "exited_at" timestamptz(6) null, "execution_time_ms" int4 null, "retry_count" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "step_instances_pkey" primary key ("id"));`);
    this.addSql(`create index "step_instances_step_id_idx" on "step_instances" ("step_id", "status");`);
    this.addSql(`create index "step_instances_tenant_org_idx" on "step_instances" ("tenant_id", "organization_id");`);
    this.addSql(`create index "step_instances_workflow_instance_idx" on "step_instances" ("workflow_instance_id", "status");`);

    this.addSql(`create table "sync_cursors" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "entity_type" text not null, "direction" text not null, "cursor" text null, "organization_id" uuid not null, "tenant_id" uuid not null, "updated_at" timestamptz(6) not null, constraint "sync_cursors_pkey" primary key ("id"));`);
    this.addSql(`alter table "sync_cursors" add constraint "sync_cursors_integration_id_entity_type_direction__b4d87_index" unique ("integration_id", "entity_type", "direction", "organization_id", "tenant_id");`);

    this.addSql(`create table "sync_external_id_mappings" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "internal_entity_type" text not null, "internal_entity_id" uuid not null, "external_id" text not null, "sync_status" text not null default 'not_synced', "last_synced_at" timestamptz(6) null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sync_external_id_mappings_pkey" primary key ("id"));`);
    this.addSql(`create index "sync_external_id_mappings_integration_id_external__c088c_index" on "sync_external_id_mappings" ("integration_id", "external_id", "organization_id");`);
    this.addSql(`create index "sync_external_id_mappings_internal_entity_type_int_f9194_index" on "sync_external_id_mappings" ("internal_entity_type", "internal_entity_id", "organization_id");`);

    this.addSql(`create table "sync_mappings" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "entity_type" text not null, "mapping" jsonb not null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "sync_mappings_pkey" primary key ("id"));`);
    this.addSql(`alter table "sync_mappings" add constraint "sync_mappings_integration_id_entity_type_organizat_edee9_index" unique ("integration_id", "entity_type", "organization_id", "tenant_id");`);

    this.addSql(`create table "sync_runs" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "entity_type" text not null, "direction" text not null, "status" text not null, "cursor" text null, "initial_cursor" text null, "created_count" int4 not null default 0, "updated_count" int4 not null default 0, "skipped_count" int4 not null default 0, "failed_count" int4 not null default 0, "batches_completed" int4 not null default 0, "last_error" text null, "progress_job_id" uuid null, "job_id" text null, "triggered_by" text null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sync_runs_pkey" primary key ("id"));`);
    this.addSql(`create index "sync_runs_integration_id_entity_type_status_organi_8b13b_index" on "sync_runs" ("integration_id", "entity_type", "status", "organization_id", "tenant_id");`);

    this.addSql(`create table "sync_schedules" ("id" uuid not null default gen_random_uuid(), "integration_id" text not null, "entity_type" text not null, "direction" text not null, "schedule_type" text not null, "schedule_value" text not null, "timezone" text not null default 'UTC', "full_sync" bool not null default false, "is_enabled" bool not null default true, "scheduled_job_id" uuid null, "last_run_at" timestamptz(6) null, "organization_id" uuid not null, "tenant_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "sync_schedules_pkey" primary key ("id"));`);
    this.addSql(`create index "sync_schedules_integration_id_entity_type_directio_addb9_index" on "sync_schedules" ("integration_id", "entity_type", "direction", "organization_id", "tenant_id");`);

    this.addSql(`create table "teams_invitation" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "inviter_id" uuid not null, "invitee_id" uuid not null, "type" text not null default 'invite', "status" text not null default 'pending', "message" text null, "created_at" timestamptz(6) not null, "responded_at" timestamptz(6) null, "expires_at" timestamptz(6) not null, "tenant_id" uuid not null, "organization_id" uuid not null, "competition_id" uuid not null, constraint "teams_invitation_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_invitation_invitee_id_index" on "teams_invitation" ("invitee_id");`);
    this.addSql(`create index "teams_invitation_organization_id_index" on "teams_invitation" ("organization_id");`);
    this.addSql(`create index "teams_invitation_status_index" on "teams_invitation" ("status");`);
    this.addSql(`create index "teams_invitation_team_id_index" on "teams_invitation" ("team_id");`);
    this.addSql(`create index "teams_invitation_tenant_id_index" on "teams_invitation" ("tenant_id");`);

    this.addSql(`create table "teams_resource" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "name" varchar(255) not null, "type" text not null default 'link', "url" varchar(1000) null, "file_id" uuid null, "metadata" jsonb not null default '{}', "added_by" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "teams_resource_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_resource_organization_id_index" on "teams_resource" ("organization_id");`);
    this.addSql(`create index "teams_resource_team_id_index" on "teams_resource" ("team_id");`);
    this.addSql(`create index "teams_resource_tenant_id_index" on "teams_resource" ("tenant_id");`);

    this.addSql(`create table "teams_team" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "track_id" uuid null, "name" varchar(255) not null, "description" text null, "avatar_url" varchar(500) null, "status" text not null default 'active', "disqualification_reason" text null, "disqualified_at" timestamptz(6) null, "disqualified_by" uuid null, "presentation_order" int4 null, "presentation_time_slot" timestamptz(6) null, "is_finalist" bool not null default false, "table_number" int4 null, "table_location" varchar(255) null, "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "teams_team_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_team_competition_id_index" on "teams_team" ("competition_id");`);
    this.addSql(`create index "teams_team_organization_id_index" on "teams_team" ("organization_id");`);
    this.addSql(`create index "teams_team_tenant_id_index" on "teams_team" ("tenant_id");`);
    this.addSql(`create index "teams_team_track_id_index" on "teams_team" ("track_id");`);

    this.addSql(`create table "teams_team_member" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "customer_user_id" uuid not null, "competition_id" uuid not null, "role" text not null default 'member', "joined_at" timestamptz(6) not null, "left_at" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid not null, "deleted_at" timestamptz(6) null, "title" varchar(255) null, constraint "teams_team_member_pkey" primary key ("id"));`);
    this.addSql(`alter table "teams_team_member" add constraint "teams_team_member_competition_id_customer_user_id_unique" unique ("competition_id", "customer_user_id");`);
    this.addSql(`create index "teams_team_member_competition_id_index" on "teams_team_member" ("competition_id");`);
    this.addSql(`create index "teams_team_member_customer_user_id_index" on "teams_team_member" ("customer_user_id");`);
    this.addSql(`create index "teams_team_member_organization_id_index" on "teams_team_member" ("organization_id");`);
    this.addSql(`create index "teams_team_member_team_id_index" on "teams_team_member" ("team_id");`);
    this.addSql(`create index "teams_team_member_tenant_id_index" on "teams_team_member" ("tenant_id");`);

    this.addSql(`create table "teams_team_track" ("id" uuid not null default gen_random_uuid(), "team_id" uuid not null, "track_id" uuid not null, "competition_id" uuid not null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, constraint "teams_team_track_pkey" primary key ("id"));`);
    this.addSql(`create index "teams_team_track_competition_id_index" on "teams_team_track" ("competition_id");`);
    this.addSql(`create index "teams_team_track_organization_id_index" on "teams_team_track" ("organization_id");`);
    this.addSql(`create index "teams_team_track_team_id_index" on "teams_team_track" ("team_id");`);
    this.addSql(`alter table "teams_team_track" add constraint "teams_team_track_team_id_track_id_unique" unique ("team_id", "track_id");`);
    this.addSql(`create index "teams_team_track_tenant_id_index" on "teams_team_track" ("tenant_id");`);
    this.addSql(`create index "teams_team_track_track_id_index" on "teams_team_track" ("track_id");`);

    this.addSql(`create table "tenants" ("id" uuid not null default gen_random_uuid(), "name" text not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "tenants_pkey" primary key ("id"));`);

    this.addSql(`create table "todos" ("id" uuid not null default gen_random_uuid(), "title" text not null, "tenant_id" uuid null, "organization_id" uuid null, "is_done" bool not null default false, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "todos_pkey" primary key ("id"));`);

    this.addSql(`create table "tracks_track" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "name" varchar(255) not null, "description" text null, "color" varchar(7) not null default '#6366f1', "icon_url" varchar(500) null, "max_teams" int4 null, "sort_order" int4 not null default 0, "mentor_ids" jsonb not null default '[]', "tenant_id" uuid not null, "organization_id" uuid not null, "is_active" bool not null default true, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "category" varchar(100) null, "badge" varchar(50) null, "short_description" text null, "attachment_ids" jsonb not null default '[]', constraint "tracks_track_pkey" primary key ("id"));`);
    this.addSql(`create index "tracks_track_competition_id_index" on "tracks_track" ("competition_id");`);
    this.addSql(`create index "tracks_track_organization_id_index" on "tracks_track" ("organization_id");`);
    this.addSql(`create index "tracks_track_tenant_id_index" on "tracks_track" ("tenant_id");`);

    this.addSql(`create table "upgrade_action_runs" ("id" uuid not null default gen_random_uuid(), "version" text not null, "action_id" text not null, "organization_id" uuid not null, "tenant_id" uuid not null, "completed_at" timestamptz(6) not null, "created_at" timestamptz(6) not null, constraint "upgrade_action_runs_pkey" primary key ("id"));`);
    this.addSql(`alter table "upgrade_action_runs" add constraint "upgrade_action_runs_action_scope_unique" unique ("version", "action_id", "organization_id", "tenant_id");`);
    this.addSql(`create index "upgrade_action_runs_scope_idx" on "upgrade_action_runs" ("organization_id", "tenant_id");`);

    this.addSql(`create table "user_acls" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid not null, "features_json" jsonb null, "is_super_admin" bool not null default false, "organizations_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "user_acls_pkey" primary key ("id"));`);

    this.addSql(`create table "user_roles" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "role_id" uuid not null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "user_roles_pkey" primary key ("id"));`);

    this.addSql(`create table "user_sidebar_preferences" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid null, "organization_id" uuid null, "locale" text not null, "settings_json" jsonb null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) null, "deleted_at" timestamptz(6) null, constraint "user_sidebar_preferences_pkey" primary key ("id"));`);
    this.addSql(`alter table "user_sidebar_preferences" add constraint "user_sidebar_preferences_user_id_tenant_id_organi_f3f2f_unique" unique ("user_id", "tenant_id", "organization_id", "locale");`);

    this.addSql(`create table "user_tasks" ("id" uuid not null default gen_random_uuid(), "workflow_instance_id" uuid not null, "step_instance_id" uuid not null, "task_name" varchar(255) not null, "description" text null, "status" varchar(20) not null, "form_schema" jsonb null, "form_data" jsonb null, "assigned_to" varchar(255) null, "assigned_to_roles" text[] null, "claimed_by" varchar(255) null, "claimed_at" timestamptz(6) null, "due_date" timestamptz(6) null, "escalated_at" timestamptz(6) null, "escalated_to" varchar(255) null, "completed_by" varchar(255) null, "completed_at" timestamptz(6) null, "comments" text null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, constraint "user_tasks_pkey" primary key ("id"));`);
    this.addSql(`create index "user_tasks_status_assigned_idx" on "user_tasks" ("status", "assigned_to");`);
    this.addSql(`create index "user_tasks_status_due_date_idx" on "user_tasks" ("status", "due_date");`);
    this.addSql(`create index "user_tasks_tenant_org_idx" on "user_tasks" ("tenant_id", "organization_id");`);
    this.addSql(`create index "user_tasks_workflow_instance_idx" on "user_tasks" ("workflow_instance_id");`);

    this.addSql(`create table "users" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid null, "organization_id" uuid null, "email" text not null, "name" text null, "password_hash" text null, "is_confirmed" bool not null default true, "last_login_at" timestamptz(6) null, "created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "email_hash" text null, constraint "users_pkey" primary key ("id"));`);
    this.addSql(`create index "users_email_hash_idx" on "users" ("email_hash");`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`create table "vector_search" ("id" uuid not null default gen_random_uuid(), "driver_id" text not null, "entity_id" text not null, "record_id" text not null, "tenant_id" uuid not null, "organization_id" uuid null, "checksum" text not null, "embedding" vector(1536) not null, "url" text null, "presenter" jsonb null, "links" jsonb null, "payload" jsonb null, "result_title" text null, "result_subtitle" text null, "result_icon" text null, "result_badge" text null, "result_snapshot" text null, "primary_link_href" text null, "primary_link_label" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), constraint "vector_search_pkey" primary key ("id"));`);
    this.addSql(`create index "vector_search_embedding_idx" on "vector_search" ("embedding");`);
    this.addSql(`create index "vector_search_lookup" on "vector_search" ("tenant_id", "organization_id", "entity_id");`);
    this.addSql(`alter table "vector_search" add constraint "vector_search_uniq" unique ("driver_id", "entity_id", "record_id", "tenant_id");`);

    this.addSql(`create table "vector_search_migrations" ("id" text not null, "applied_at" timestamptz(6) not null default now(), constraint "vector_search_migrations_pkey" primary key ("id"));`);

    this.addSql(`create table "workflow_definitions" ("id" uuid not null default gen_random_uuid(), "workflow_id" varchar(100) not null, "workflow_name" varchar(255) not null, "description" text null, "version" int4 not null default 1, "definition" jsonb not null, "metadata" jsonb null, "enabled" bool not null default true, "effective_from" timestamptz(6) null, "effective_to" timestamptz(6) null, "tenant_id" uuid not null, "organization_id" uuid not null, "created_by" varchar(255) null, "updated_by" varchar(255) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "workflow_definitions_pkey" primary key ("id"));`);
    this.addSql(`create index "workflow_definitions_enabled_idx" on "workflow_definitions" ("enabled");`);
    this.addSql(`create index "workflow_definitions_tenant_org_idx" on "workflow_definitions" ("tenant_id", "organization_id");`);
    this.addSql(`create index "workflow_definitions_workflow_id_idx" on "workflow_definitions" ("workflow_id");`);
    this.addSql(`alter table "workflow_definitions" add constraint "workflow_definitions_workflow_id_tenant_id_unique" unique ("workflow_id", "tenant_id");`);

    this.addSql(`create table "workflow_event_triggers" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "description" text null, "workflow_definition_id" uuid not null, "event_pattern" varchar(255) not null, "config" jsonb null, "enabled" bool not null default true, "priority" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_by" varchar(255) null, "updated_by" varchar(255) null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, constraint "workflow_event_triggers_pkey" primary key ("id"));`);
    this.addSql(`create index "workflow_event_triggers_definition_idx" on "workflow_event_triggers" ("workflow_definition_id");`);
    this.addSql(`create index "workflow_event_triggers_enabled_priority_idx" on "workflow_event_triggers" ("enabled", "priority");`);
    this.addSql(`create index "workflow_event_triggers_event_pattern_idx" on "workflow_event_triggers" ("event_pattern", "enabled");`);
    this.addSql(`create index "workflow_event_triggers_tenant_org_idx" on "workflow_event_triggers" ("tenant_id", "organization_id");`);

    this.addSql(`create table "workflow_events" ("id" bigserial primary key, "workflow_instance_id" uuid not null, "step_instance_id" uuid null, "event_type" varchar(50) not null, "event_data" jsonb not null, "occurred_at" timestamptz(6) not null, "user_id" varchar(255) null, "tenant_id" uuid not null, "organization_id" uuid not null);`);
    this.addSql(`create index "workflow_events_event_type_idx" on "workflow_events" ("event_type", "occurred_at");`);
    this.addSql(`create index "workflow_events_instance_occurred_idx" on "workflow_events" ("workflow_instance_id", "occurred_at");`);
    this.addSql(`create index "workflow_events_tenant_org_idx" on "workflow_events" ("tenant_id", "organization_id");`);

    this.addSql(`create table "workflow_instances" ("id" uuid not null default gen_random_uuid(), "definition_id" uuid not null, "workflow_id" varchar(100) not null, "version" int4 not null, "status" varchar(30) not null, "current_step_id" varchar(100) not null, "context" jsonb not null, "correlation_key" varchar(255) null, "metadata" jsonb null, "started_at" timestamptz(6) not null, "completed_at" timestamptz(6) null, "paused_at" timestamptz(6) null, "cancelled_at" timestamptz(6) null, "error_message" text null, "error_details" jsonb null, "retry_count" int4 not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "pending_transition" jsonb null, constraint "workflow_instances_pkey" primary key ("id"));`);
    this.addSql(`create index "workflow_instances_correlation_key_idx" on "workflow_instances" ("correlation_key");`);
    this.addSql(`create index "workflow_instances_current_step_idx" on "workflow_instances" ("current_step_id", "status");`);
    this.addSql(`create index "workflow_instances_definition_status_idx" on "workflow_instances" ("definition_id", "status");`);
    this.addSql(`create index "workflow_instances_status_tenant_idx" on "workflow_instances" ("status", "tenant_id");`);
    this.addSql(`create index "workflow_instances_tenant_org_idx" on "workflow_instances" ("tenant_id", "organization_id");`);

    this.addSql(`alter table "bounties_pull_request" alter column "github_pr_id" type int4 using ("github_pr_id"::int4);`);
  }

}
