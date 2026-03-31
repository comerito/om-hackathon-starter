import { Migration } from '@mikro-orm/migrations';

export class Migration20260330234720 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "competitions_competition_info_card" ("id" uuid not null default gen_random_uuid(), "competition_id" uuid not null, "key" varchar(100) not null, "icon" varchar(100) null, "label" varchar(255) not null, "value" text not null, "sort_order" int not null default 0, "tenant_id" uuid not null, "organization_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "competitions_competition_info_card_pkey" primary key ("id"));`);
    this.addSql(`create index "competitions_competition_info_card_competition_id_index" on "competitions_competition_info_card" ("competition_id");`);
    this.addSql(`create index "competitions_competition_info_card_tenant_id_index" on "competitions_competition_info_card" ("tenant_id");`);
    this.addSql(`create index "competitions_competition_info_card_organization_id_index" on "competitions_competition_info_card" ("organization_id");`);

    this.addSql(`
      insert into "competitions_competition_info_card" (
        "competition_id",
        "key",
        "icon",
        "label",
        "value",
        "sort_order",
        "tenant_id",
        "organization_id",
        "created_at",
        "updated_at"
      )
      select
        c."id",
        coalesce(card.value->>'key', 'card_' || row_number() over (partition by c."id" order by card.ordinality)),
        nullif(card.value->>'icon', ''),
        coalesce(card.value->>'label', card.value->>'key', 'Info'),
        coalesce(card.value->>'value', ''),
        card.ordinality - 1,
        c."tenant_id",
        c."organization_id",
        now(),
        now()
      from "competitions_competition" c
      cross join lateral jsonb_array_elements(c."info_cards") with ordinality as card(value, ordinality)
      where jsonb_typeof(c."info_cards") = 'array';
    `);

    this.addSql(`alter table "competitions_competition" drop column "info_cards";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "competitions_competition" add column "info_cards" jsonb not null default '[]';`);

    this.addSql(`
      update "competitions_competition" c
      set "info_cards" = coalesce(cards.info_cards, '[]'::jsonb)
      from (
        select
          "competition_id",
          jsonb_agg(
            jsonb_build_object(
              'key', "key",
              'label', "label",
              'value', "value",
              'icon', "icon"
            )
            order by "sort_order" asc, "created_at" asc
          ) as info_cards
        from "competitions_competition_info_card"
        where "deleted_at" is null
        group by "competition_id"
      ) cards
      where c."id" = cards."competition_id";
    `);

    this.addSql(`drop table if exists "competitions_competition_info_card";`);
  }

}
