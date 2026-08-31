# sales — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| sales:sales_channel | SalesChannel | sales_channels | yes | no |
| sales:sales_shipping_method | SalesShippingMethod | sales_shipping_methods | yes | no |
| sales:sales_delivery_window | SalesDeliveryWindow | sales_delivery_windows | yes | no |
| sales:sales_payment_method | SalesPaymentMethod | sales_payment_methods | yes | no |
| sales:sales_tax_rate | SalesTaxRate | sales_tax_rates | yes | no |
| sales:sales_order | SalesOrder | sales_orders | yes | no |
| sales:sales_order_line | SalesOrderLine | sales_order_lines | yes | no |
| sales:sales_order_adjustment | SalesOrderAdjustment | sales_order_adjustments | yes | no |
| sales:sales_settings | SalesSettings | sales_settings | yes | no |
| sales:sales_document_sequence | SalesDocumentSequence | sales_document_sequences | yes | no |
| sales:sales_quote | SalesQuote | sales_quotes | yes | no |
| sales:sales_quote_line | SalesQuoteLine | sales_quote_lines | yes | no |
| sales:sales_quote_adjustment | SalesQuoteAdjustment | sales_quote_adjustments | yes | no |
| sales:sales_shipment | SalesShipment | sales_shipments | yes | no |
| sales:sales_shipment_item | SalesShipmentItem | sales_shipment_items | no | no |
| sales:sales_return | SalesReturn | sales_returns | yes | no |
| sales:sales_return_line | SalesReturnLine | sales_return_lines | yes | no |
| sales:sales_invoice | SalesInvoice | sales_invoices | yes | no |
| sales:sales_invoice_line | SalesInvoiceLine | sales_invoice_lines | no | no |
| sales:sales_credit_memo | SalesCreditMemo | sales_credit_memos | yes | no |
| sales:sales_credit_memo_line | SalesCreditMemoLine | sales_credit_memo_lines | no | no |
| sales:sales_payment | SalesPayment | sales_payments | yes | no |
| sales:sales_payment_allocation | SalesPaymentAllocation | sales_payment_allocations | no | no |
| sales:sales_note | SalesNote | sales_notes | yes | no |
| sales:sales_document_address | SalesDocumentAddress | sales_document_addresses | yes | no |
| sales:sales_document_tag | SalesDocumentTag | sales_document_tags | yes | no |
| sales:sales_document_tag_assignment | SalesDocumentTagAssignment | sales_document_tag_assignments | yes | no |

## Events  (43)

| ID | Category | Entity |
|---|---|---|
| sales.order.created | crud | order |
| sales.order.updated | crud | order |
| sales.order.deleted | crud | order |
| sales.order.confirmed | lifecycle | order |
| sales.order.cancelled | lifecycle | order |
| sales.quote.created | crud | quote |
| sales.quote.updated | crud | quote |
| sales.quote.deleted | crud | quote |
| sales.invoice.created | crud | invoice |
| sales.invoice.updated | crud | invoice |
| sales.invoice.deleted | crud | invoice |
| sales.credit_memo.created | crud | credit_memo |
| sales.credit_memo.updated | crud | credit_memo |
| sales.credit_memo.deleted | crud | credit_memo |
| sales.line.created | crud | line |
| sales.line.updated | crud | line |
| sales.line.deleted | crud | line |
| sales.payment.created | crud | payment |
| sales.payment.updated | crud | payment |
| sales.payment.deleted | crud | payment |
| sales.shipment.created | crud | shipment |
| sales.shipment.updated | crud | shipment |
| sales.shipment.deleted | crud | shipment |
| sales.return.created | crud | return |
| sales.return.updated | crud | return |
| sales.return.deleted | crud | return |
| sales.note.created | crud | note |
| sales.note.updated | crud | note |
| sales.note.deleted | crud | note |
| sales.channel.created | crud | channel |
| sales.channel.updated | crud | channel |
| sales.channel.deleted | crud | channel |
| sales.document.totals.calculated | lifecycle | — |
| sales.document.calculate.before | lifecycle | — |
| sales.document.calculate.after | lifecycle | — |
| sales.line.calculate.before | lifecycle | — |
| sales.line.calculate.after | lifecycle | — |
| sales.tax.calculate.before | lifecycle | — |
| sales.tax.calculate.after | lifecycle | — |
| sales.shipping.adjustments.apply.before | lifecycle | — |
| sales.shipping.adjustments.apply.after | lifecycle | — |
| sales.payment.adjustments.apply.before | lifecycle | — |
| sales.payment.adjustments.apply.after | lifecycle | — |

## ACL features  (19)

sales.orders.view · sales.orders.manage · sales.orders.approve · sales.widgets.new-orders · sales.widgets.new-quotes · sales.quotes.view · sales.quotes.manage · sales.documents.number.edit · sales.shipments.manage · sales.payments.manage · sales.returns.view · sales.returns.create · sales.returns.manage · sales.invoices.manage · sales.credit_memos.manage · sales.channels.view · sales.channels.manage · sales.settings.view · sales.settings.manage

## API routes

_none_

## DI service tokens

salesCalculationService · taxCalculationService · salesDocumentNumberGenerator · salesOrderService

## Search entities

sales:sales_channel · sales:sales_order · sales:sales_quote · sales:sales_order_line · sales:sales_quote_line · sales:sales_order_adjustment · sales:sales_quote_adjustment · sales:sales_shipment · sales:sales_shipment_item · sales:sales_invoice · sales:sales_invoice_line · sales:sales_credit_memo · sales:sales_credit_memo_line · sales:sales_payment · sales:sales_payment_allocation · sales:sales_note · sales:sales_document_address · sales:sales_shipping_method · sales:sales_delivery_window · sales:sales_payment_method · sales:sales_tax_rate · sales:sales_document_tag

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

sales.order.created · sales.quote.created · sales.payment.received · sales.quote.expiring

## CLI

seed-tax-rates · seed-statuses · seed-adjustment-kinds · backfill-deal-loss-reasons · seed-shipping-methods · seed-payment-methods · seed-examples
