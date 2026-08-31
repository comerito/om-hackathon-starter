# data_sync — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| data_sync:sync_run | SyncRun | sync_runs | yes | no |
| data_sync:sync_cursor | SyncCursor | sync_cursors | yes | no |
| data_sync:sync_mapping | SyncMapping | sync_mappings | yes | no |
| data_sync:sync_schedule | SyncSchedule | sync_schedules | yes | no |

## Events  (4)

| ID | Category | Entity |
|---|---|---|
| data_sync.run.started | lifecycle | run |
| data_sync.run.completed | lifecycle | run |
| data_sync.run.failed | lifecycle | run |
| data_sync.run.cancelled | lifecycle | run |

## ACL features  (3)

data_sync.view · data_sync.run · data_sync.configure

## API routes

_none_

## DI service tokens

externalIdMappingService · dataSyncRunService · dataSyncScheduleService · dataSyncEngine

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: data_sync.runs

## Notifications

_none_

## CLI

_none_
