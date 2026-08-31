# currencies — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| currencies:currency | Currency | currencies | yes | no |
| currencies:exchange_rate | ExchangeRate | exchange_rates | yes | no |
| currencies:currency_fetch_config | CurrencyFetchConfig | currency_fetch_configs | yes | no |

## Events  (6)

| ID | Category | Entity |
|---|---|---|
| currencies.currency.created | crud | currency |
| currencies.currency.updated | crud | currency |
| currencies.currency.deleted | crud | currency |
| currencies.exchange_rate.created | crud | exchange_rate |
| currencies.exchange_rate.updated | crud | exchange_rate |
| currencies.exchange_rate.deleted | crud | exchange_rate |

## ACL features  (6)

currencies.view · currencies.manage · currencies.rates.view · currencies.rates.manage · currencies.fetch.view · currencies.fetch.manage

## API routes

_none_

## DI service tokens

_none_

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: currencies.list · exchange-rates.list

## Notifications

_none_

## CLI

seed · fetch-rates · list-providers
