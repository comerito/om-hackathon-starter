# planner — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| planner:planner_availability_rule_set | PlannerAvailabilityRuleSet | planner_availability_rule_sets | yes | no |
| planner:planner_availability_rule | PlannerAvailabilityRule | planner_availability_rules | yes | no |

## Events  (6)

| ID | Category | Entity |
|---|---|---|
| planner.availability_rule.created | crud | availability_rule |
| planner.availability_rule.updated | crud | availability_rule |
| planner.availability_rule.deleted | crud | availability_rule |
| planner.availability_rule_set.created | crud | availability_rule_set |
| planner.availability_rule_set.updated | crud | availability_rule_set |
| planner.availability_rule_set.deleted | crud | availability_rule_set |

## ACL features  (2)

planner.view · planner.manage_availability

## API routes

_none_

## DI service tokens

plannerAvailabilityService

## Search entities

planner:planner_availability_rule_set

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

_none_

## CLI

seed-availability-rulesets · seed-unavailability-reasons
