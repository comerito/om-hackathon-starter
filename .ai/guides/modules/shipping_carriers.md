# shipping_carriers — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| shipping_carriers:carrier_shipment | CarrierShipment | carrier_shipments | yes | no |
| shipping_carriers:carrier_webhook_processed_event | CarrierWebhookProcessedEvent | carrier_webhook_events | no | no |
| shipping_carriers:carrier_shipment_idempotency_key | CarrierShipmentIdempotencyKey | carrier_shipment_idempotency_keys | no | no |

## Events  (7)

| ID | Category | Entity |
|---|---|---|
| shipping_carriers.shipment.created | lifecycle | shipment |
| shipping_carriers.shipment.status_changed | lifecycle | shipment |
| shipping_carriers.shipment.delivered | lifecycle | shipment |
| shipping_carriers.shipment.returned | lifecycle | shipment |
| shipping_carriers.shipment.cancelled | lifecycle | shipment |
| shipping_carriers.webhook.received | system | — |
| shipping_carriers.webhook.failed | system | — |

## ACL features  (2)

shipping_carriers.view · shipping_carriers.manage

## API routes

_none_

## DI service tokens

shippingCarrierService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

_none_

## CLI

_none_
