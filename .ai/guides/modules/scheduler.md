# scheduler — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| scheduler:scheduled_job | ScheduledJob | scheduled_jobs | yes | no |

## Events  (4)

| ID | Category | Entity |
|---|---|---|
| scheduler.job.started | lifecycle | scheduled_job |
| scheduler.job.completed | lifecycle | scheduled_job |
| scheduler.job.failed | lifecycle | scheduled_job |
| scheduler.job.skipped | lifecycle | scheduled_job |

## ACL features  (3)

scheduler.jobs.view · scheduler.jobs.manage · scheduler.jobs.trigger

## API routes

_none_

## DI service tokens

bullmqSchedulerService · localSchedulerService · schedulerService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

_none_

## CLI

list · status · run · start
