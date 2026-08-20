# record_locks — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| record_locks:record_lock | RecordLock | record_locks | yes | no |
| record_locks:record_lock_conflict | RecordLockConflict | record_lock_conflicts | yes | no |

## Events  (10)

| ID | Category | Entity |
|---|---|---|
| record_locks.lock.acquired | crud | lock |
| record_locks.participant.joined | lifecycle | lock |
| record_locks.participant.left | lifecycle | lock |
| record_locks.lock.contended | lifecycle | lock |
| record_locks.lock.released | crud | lock |
| record_locks.lock.force_released | crud | lock |
| record_locks.record.deleted | crud | record |
| record_locks.conflict.detected | crud | conflict |
| record_locks.conflict.resolved | crud | conflict |
| record_locks.incoming_changes.available | lifecycle | change |

## ACL features  (4)

record_locks.view · record_locks.manage · record_locks.force_release · record_locks.override_incoming

## API routes

_none_

## DI service tokens

recordLockService · crudMutationGuardService · commandOptimisticLockGuardService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

record_locks.participant.joined · record_locks.participant.left · record_locks.lock.contended · record_locks.lock.force_released · record_locks.record.deleted · record_locks.conflict.detected · record_locks.incoming_changes.available · record_locks.conflict.resolved

## CLI

_none_
