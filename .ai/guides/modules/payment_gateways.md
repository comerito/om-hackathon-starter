# payment_gateways — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| payment_gateways:gateway_transaction | GatewayTransaction | gateway_transactions | yes | no |
| payment_gateways:gateway_payment_operation | GatewayPaymentOperation | gateway_payment_operations | yes | no |
| payment_gateways:gateway_session_initialization | GatewaySessionInitialization | gateway_session_initializations | yes | no |
| payment_gateways:webhook_processed_event | WebhookProcessedEvent | gateway_webhook_events | no | no |

## Events  (9)

| ID | Category | Entity |
|---|---|---|
| payment_gateways.session.created | lifecycle | session |
| payment_gateways.session.expired | lifecycle | session |
| payment_gateways.payment.authorized | lifecycle | payment |
| payment_gateways.payment.captured | lifecycle | payment |
| payment_gateways.payment.failed | lifecycle | payment |
| payment_gateways.payment.refunded | lifecycle | payment |
| payment_gateways.payment.cancelled | lifecycle | payment |
| payment_gateways.webhook.received | system | webhook |
| payment_gateways.webhook.failed | system | webhook |

## ACL features  (4)

payment_gateways.view · payment_gateways.manage · payment_gateways.capture · payment_gateways.refund

## API routes

_none_

## DI service tokens

paymentGatewayService · paymentGatewayDescriptorService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: payment_gateways.transactions.list

## Notifications

_none_

## CLI

_none_
