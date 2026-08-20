# integrations — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| integrations:sync_external_id_mapping | SyncExternalIdMapping | sync_external_id_mappings | yes | no |
| integrations:integration_credentials | IntegrationCredentials | integration_credentials | yes | no |
| integrations:integration_state | IntegrationState | integration_states | yes | no |
| integrations:integration_log | IntegrationLog | integration_logs | no | no |

## Events  (4)

| ID | Category | Entity |
|---|---|---|
| integrations.credentials.updated | custom | credentials |
| integrations.state.updated | custom | state |
| integrations.version.changed | custom | state |
| integrations.log.created | system | log |

## ACL features  (3)

integrations.view · integrations.manage · integrations.credentials.manage

## API routes

_none_

## DI service tokens

integrationCredentialsService · integrationStateService · integrationLogService · integrationHealthService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

_none_

## CLI

_none_
