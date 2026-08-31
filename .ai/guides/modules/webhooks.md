# webhooks — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| webhooks:webhook_entity | WebhookEntity | webhooks | yes | no |
| webhooks:webhook_delivery_entity | WebhookDeliveryEntity | webhook_deliveries | yes | no |
| webhooks:webhook_inbound_receipt_entity | WebhookInboundReceiptEntity | webhook_inbound_receipts | no | no |

## Events  (10)

| ID | Category | Entity |
|---|---|---|
| webhooks.webhook.created | — | webhook |
| webhooks.webhook.updated | — | webhook |
| webhooks.webhook.deleted | — | webhook |
| webhooks.delivery.enqueued | — | delivery |
| webhooks.delivery.succeeded | — | delivery |
| webhooks.delivery.failed | — | delivery |
| webhooks.delivery.exhausted | — | delivery |
| webhooks.webhook.disabled | — | webhook |
| webhooks.inbound.received | — | inbound |
| webhooks.secret.rotated | — | webhook |

## ACL features  (4)

webhooks.view · webhooks.manage · webhooks.secrets · webhooks.test

## API routes

_none_

## DI service tokens

_none_

## Search entities

_none_

## Host extension points

- Entity IDs: webhooks:webhook_entity · webhooks:webhook_delivery_entity · webhooks:webhook_inbound_receipt_entity
- Table IDs: webhooks.deliveries · webhooks.list

## Notifications

webhooks.delivery.failed

## CLI

_none_
