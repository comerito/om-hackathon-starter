# customers — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| customers:customer_entity | CustomerEntity | customer_entities | yes | no |
| customers:customer_person_profile | CustomerPersonProfile | customer_people | yes | yes |
| customers:customer_person_company_link | CustomerPersonCompanyLink | customer_person_company_links | yes | no |
| customers:customer_company_profile | CustomerCompanyProfile | customer_companies | yes | yes |
| customers:customer_deal | CustomerDeal | customer_deals | yes | yes |
| customers:customer_deal_stage_transition | CustomerDealStageTransition | customer_deal_stage_transitions | yes | no |
| customers:customer_deal_person_link | CustomerDealPersonLink | customer_deal_people | no | no |
| customers:customer_deal_company_link | CustomerDealCompanyLink | customer_deal_companies | no | no |
| customers:customer_activity | CustomerActivity | customer_activities | yes | yes |
| customers:customer_interaction | CustomerInteraction | customer_interactions | yes | yes |
| customers:customer_comment | CustomerComment | customer_comments | yes | no |
| customers:customer_address | CustomerAddress | customer_addresses | yes | no |
| customers:customer_settings | CustomerSettings | customer_settings | yes | no |
| customers:customer_tag | CustomerTag | customer_tags | yes | no |
| customers:customer_tag_assignment | CustomerTagAssignment | customer_tag_assignments | no | no |
| customers:customer_dictionary_entry | CustomerDictionaryEntry | customer_dictionary_entries | yes | no |
| customers:customer_pipeline | CustomerPipeline | customer_pipelines | yes | no |
| customers:customer_pipeline_stage | CustomerPipelineStage | customer_pipeline_stages | yes | no |
| customers:customer_todo_link | CustomerTodoLink | customer_todo_links | no | no |
| customers:customer_entity_role | CustomerEntityRole | customer_entity_roles | yes | no |
| customers:customer_dictionary_kind_setting | CustomerDictionaryKindSetting | customer_dictionary_kind_settings | yes | no |
| customers:customer_label | CustomerLabel | customer_labels | yes | no |
| customers:customer_label_assignment | CustomerLabelAssignment | customer_label_assignments | no | no |
| customers:customer_company_billing | CustomerCompanyBilling | customer_company_billing | yes | no |
| customers:customer_person_company_role | CustomerPersonCompanyRole | customer_person_company_roles | no | no |

## Events  (49)

| ID | Category | Entity |
|---|---|---|
| customers.person.created | crud | person |
| customers.person.updated | crud | person |
| customers.person.deleted | crud | person |
| customers.company.created | crud | company |
| customers.company.updated | crud | company |
| customers.company.deleted | crud | company |
| customers.deal.created | crud | deal |
| customers.deal.updated | crud | deal |
| customers.deal.deleted | crud | deal |
| customers.deal.won | lifecycle | deal |
| customers.deal.lost | lifecycle | deal |
| customers.comment.created | crud | comment |
| customers.comment.updated | crud | comment |
| customers.comment.deleted | crud | comment |
| customers.address.created | crud | address |
| customers.address.updated | crud | address |
| customers.address.deleted | crud | address |
| customers.activity.created | crud | activity |
| customers.activity.updated | crud | activity |
| customers.activity.deleted | crud | activity |
| customers.tag.created | crud | tag |
| customers.tag.updated | crud | tag |
| customers.tag.deleted | crud | tag |
| customers.tag.assigned | crud | tag |
| customers.tag.removed | crud | tag |
| customers.todo.created | crud | todo |
| customers.todo.updated | crud | todo |
| customers.todo.deleted | crud | todo |
| customers.interaction.created | crud | interaction |
| customers.interaction.updated | crud | interaction |
| customers.interaction.completed | lifecycle | interaction |
| customers.interaction.canceled | lifecycle | interaction |
| customers.interaction.reverted | lifecycle | interaction |
| customers.interaction.deleted | crud | interaction |
| customers.next_interaction.updated | lifecycle | interaction |
| customers.entity_role.created | crud | entity_role |
| customers.entity_role.updated | crud | entity_role |
| customers.entity_role.deleted | crud | entity_role |
| customers.label.created | crud | label |
| customers.label.updated | crud | label |
| customers.label.deleted | crud | label |
| customers.label_assignment.created | crud | label_assignment |
| customers.label_assignment.updated | crud | label_assignment |
| customers.label_assignment.deleted | crud | label_assignment |
| customers.person_company_link.created | crud | person_company_link |
| customers.person_company_link.updated | crud | person_company_link |
| customers.person_company_link.deleted | crud | person_company_link |
| customers.email.linked | lifecycle | email_link |
| customers.email.visibility_changed | lifecycle | email_link |

## ACL features  (21)

customers.people.view · customers.people.manage · customers.companies.view · customers.companies.manage · customers.deals.view · customers.deals.manage · customers.activities.view · customers.activities.manage · customers.settings.manage · customers.pipelines.view · customers.pipelines.manage · customers.widgets.todos · customers.widgets.next-interactions · customers.widgets.new-customers · customers.widgets.new-deals · customers.interactions.view · customers.interactions.manage · customers.roles.view · customers.roles.manage · customers.email.compose · customers.email.view_private

## API routes

_none_

## DI service tokens

_none_

## Search entities

customers:customer_person_profile · customers:customer_company_profile · customers:customer_comment · customers:customer_deal · customers:customer_activity · customers:customer_todo_link

## Host extension points

- Entity IDs: customers:customer_entity
- Table IDs: customers.companies.list · customers.deals.list · customers.people.list

## Notifications

customers.deal.won · customers.deal.lost

## CLI

seed-dictionaries · seed-examples · seed-stresstest · interactions:backfill
