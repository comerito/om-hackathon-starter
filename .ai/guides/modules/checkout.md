# checkout — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| checkout:checkout_link_template | CheckoutLinkTemplate | checkout_link_templates | yes | no |
| checkout:checkout_link | CheckoutLink | checkout_links | no | no |
| checkout:checkout_transaction | CheckoutTransaction | checkout_transactions | yes | no |

## Events  (16)

| ID | Category | Entity |
|---|---|---|
| checkout.template.created | crud | template |
| checkout.template.updated | crud | template |
| checkout.template.deleted | crud | template |
| checkout.link.created | crud | link |
| checkout.link.updated | crud | link |
| checkout.link.deleted | crud | link |
| checkout.link.published | lifecycle | link |
| checkout.link.locked | lifecycle | link |
| checkout.transaction.created | crud | transaction |
| checkout.transaction.customerDataCaptured | lifecycle | transaction |
| checkout.transaction.sessionStarted | lifecycle | transaction |
| checkout.transaction.completed | lifecycle | transaction |
| checkout.transaction.failed | lifecycle | transaction |
| checkout.transaction.cancelled | lifecycle | transaction |
| checkout.transaction.expired | lifecycle | transaction |
| checkout.link.usageLimitReached | lifecycle | link |

## ACL features  (6)

checkout.view · checkout.create · checkout.edit · checkout.delete · checkout.viewPii · checkout.export

## API routes

_none_

## DI service tokens

_none_

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: checkout-links · checkout-templates · checkout-transactions

## Notifications

checkout.transaction.completed · checkout.transaction.failed · checkout.link.usageLimitReached

## CLI

_none_
