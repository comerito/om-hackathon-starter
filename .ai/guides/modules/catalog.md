# catalog — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| catalog:catalog_option_schema_template | CatalogOptionSchemaTemplate | catalog_product_option_schemas | yes | no |
| catalog:catalog_product | CatalogProduct | catalog_products | yes | no |
| catalog:catalog_product_unit_conversion | CatalogProductUnitConversion | catalog_product_unit_conversions | yes | no |
| catalog:catalog_product_category | CatalogProductCategory | catalog_product_categories | yes | no |
| catalog:catalog_product_category_assignment | CatalogProductCategoryAssignment | catalog_product_category_assignments | yes | no |
| catalog:catalog_product_tag | CatalogProductTag | catalog_product_tags | yes | no |
| catalog:catalog_product_tag_assignment | CatalogProductTagAssignment | catalog_product_tag_assignments | yes | no |
| catalog:catalog_offer | CatalogOffer | catalog_product_offers | yes | no |
| catalog:catalog_product_variant | CatalogProductVariant | catalog_product_variants | yes | no |
| catalog:catalog_product_variant_relation | CatalogProductVariantRelation | catalog_product_variant_relations | yes | no |
| catalog:catalog_price_kind | CatalogPriceKind | catalog_price_kinds | yes | no |
| catalog:catalog_product_price | CatalogProductPrice | catalog_product_variant_prices | yes | no |

## Events  (17)

| ID | Category | Entity |
|---|---|---|
| catalog.product.created | crud | product |
| catalog.product.updated | crud | product |
| catalog.product.deleted | crud | product |
| catalog.product_unit_conversion.created | crud | product_unit_conversion |
| catalog.product_unit_conversion.updated | crud | product_unit_conversion |
| catalog.product_unit_conversion.deleted | crud | product_unit_conversion |
| catalog.category.created | crud | category |
| catalog.category.updated | crud | category |
| catalog.category.deleted | crud | category |
| catalog.variant.created | crud | variant |
| catalog.variant.updated | crud | variant |
| catalog.variant.deleted | crud | variant |
| catalog.price.created | crud | price |
| catalog.price.updated | crud | price |
| catalog.price.deleted | crud | price |
| catalog.pricing.resolve.before | lifecycle | — |
| catalog.pricing.resolve.after | lifecycle | — |

## ACL features  (7)

catalog.products.view · catalog.products.manage · catalog.categories.view · catalog.categories.manage · catalog.variants.manage · catalog.pricing.manage · catalog.settings.manage

## API routes

_none_

## DI service tokens

catalogPricingService

## Search entities

catalog:catalog_product · catalog:catalog_product_variant · catalog:catalog_product_category · catalog:catalog_offer · catalog:catalog_product_tag · catalog:catalog_price_kind · catalog:catalog_product_unit_conversion · catalog:catalog_option_schema_template

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

catalog.product.low_stock

## CLI

seed-units · seed-price-kinds · seed-examples · seed-examples-bundle
