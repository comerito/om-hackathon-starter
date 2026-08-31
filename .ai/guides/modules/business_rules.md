# business_rules — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| business_rules:business_rule | BusinessRule | business_rules | yes | no |
| business_rules:rule_execution_log | RuleExecutionLog | rule_execution_logs | no | no |
| business_rules:rule_set | RuleSet | rule_sets | yes | no |
| business_rules:rule_set_member | RuleSetMember | rule_set_members | no | no |

## Events  (0)

_none_

## ACL features  (5)

business_rules.view · business_rules.manage · business_rules.execute · business_rules.view_logs · business_rules.manage_sets

## API routes

_none_

## DI service tokens

ruleEvaluator · actionExecutor · ruleEngine

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: business-rules.rules.list

## Notifications

business_rules.rule.execution_failed

## CLI

seed-guard-rules
