# workflows — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| workflows:workflow_definition | WorkflowDefinition | workflow_definitions | yes | no |
| workflows:workflow_instance | WorkflowInstance | workflow_instances | yes | no |
| workflows:workflow_branch_instance | WorkflowBranchInstance | workflow_branch_instances | yes | no |
| workflows:step_instance | StepInstance | step_instances | yes | no |
| workflows:user_task | UserTask | user_tasks | yes | no |
| workflows:workflow_event | WorkflowEvent | workflow_events | no | no |
| workflows:workflow_event_trigger | WorkflowEventTrigger | workflow_event_triggers | yes | no |

## Events  (25)

| ID | Category | Entity |
|---|---|---|
| workflows.definition.created | crud | definition |
| workflows.definition.updated | crud | definition |
| workflows.definition.deleted | crud | definition |
| workflows.definition.customized | lifecycle | definition |
| workflows.definition.reset_to_code | lifecycle | definition |
| workflows.instance.created | crud | instance |
| workflows.instance.updated | crud | instance |
| workflows.instance.deleted | crud | instance |
| workflows.instance.started | lifecycle | — |
| workflows.instance.completed | lifecycle | — |
| workflows.instance.failed | lifecycle | — |
| workflows.instance.cancelled | lifecycle | — |
| workflows.instance.paused | lifecycle | — |
| workflows.instance.resumed | lifecycle | — |
| workflows.activity.started | lifecycle | — |
| workflows.activity.completed | lifecycle | — |
| workflows.activity.failed | lifecycle | — |
| workflows.trigger.created | crud | trigger |
| workflows.trigger.updated | crud | trigger |
| workflows.trigger.deleted | crud | trigger |
| workflows.branch.opened | lifecycle | branch |
| workflows.branch.completed | lifecycle | branch |
| workflows.branch.cancelled | lifecycle | branch |
| workflows.branch.failed | lifecycle | branch |
| workflows.join.completed | lifecycle | branch |

## ACL features  (18)

workflows.view · workflows.manage · workflows.view_logs · workflows.view_tasks · workflows.definitions.view · workflows.definitions.create · workflows.definitions.edit · workflows.definitions.delete · workflows.instances.view · workflows.instances.create · workflows.instances.cancel · workflows.instances.retry · workflows.instances.signal · workflows.tasks.view · workflows.tasks.claim · workflows.tasks.complete · workflows.signals.send · workflows.events.view

## API routes

_none_

## DI service tokens

workflowExecutor · stepHandler · transitionHandler · activityExecutor · eventLogger · signalHandler · timerHandler

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: workflows.definitions.list · workflows.instances.list · workflows.tasks.list

## Notifications

workflows.task.assigned

## CLI

start-worker · process-activities · seed-demo · seed-demo-with-rules · seed-sales-pipeline · seed-simple-approval · seed-order-approval · seed-all
