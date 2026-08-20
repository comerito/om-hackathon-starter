# resources — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| resources:resources_resource_type | ResourcesResourceType | resources_resource_types | yes | no |
| resources:resources_resource | ResourcesResource | resources_resources | yes | no |
| resources:resources_resource_comment | ResourcesResourceComment | resources_resource_comments | yes | no |
| resources:resources_resource_activity | ResourcesResourceActivity | resources_resource_activities | yes | no |
| resources:resources_resource_tag | ResourcesResourceTag | resources_resource_tags | yes | no |
| resources:resources_resource_tag_assignment | ResourcesResourceTagAssignment | resources_resource_tag_assignments | yes | no |

## Events  (15)

| ID | Category | Entity |
|---|---|---|
| resources.resource.created | crud | resource |
| resources.resource.updated | crud | resource |
| resources.resource.deleted | crud | resource |
| resources.resource_type.created | crud | resource_type |
| resources.resource_type.updated | crud | resource_type |
| resources.resource_type.deleted | crud | resource_type |
| resources.comment.created | crud | comment |
| resources.comment.updated | crud | comment |
| resources.comment.deleted | crud | comment |
| resources.activity.created | crud | activity |
| resources.activity.updated | crud | activity |
| resources.activity.deleted | crud | activity |
| resources.resource_tag_assignment.created | crud | resource_tag_assignment |
| resources.resource_tag_assignment.updated | crud | resource_tag_assignment |
| resources.resource_tag_assignment.deleted | crud | resource_tag_assignment |

## ACL features  (2)

resources.view · resources.manage_resources

## API routes

_none_

## DI service tokens

_none_

## Search entities

resources:resources_resource · resources:resources_resource_type

## Host extension points

- Entity IDs: _none_
- Table IDs: resources.resource-types.list · resources.resources.list

## Notifications

_none_

## CLI

seed-capacity-units · seed-activity-types · seed-address-types · seed-examples
