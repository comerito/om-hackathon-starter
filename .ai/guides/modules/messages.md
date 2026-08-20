# messages — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| messages:message | Message | messages | yes | no |
| messages:message_recipient | MessageRecipient | message_recipients | no | no |
| messages:message_object | MessageObject | message_objects | no | no |
| messages:message_access_token | MessageAccessToken | message_access_tokens | no | no |
| messages:message_confirmation | MessageConfirmation | message_confirmations | yes | no |

## Events  (9)

| ID | Category | Entity |
|---|---|---|
| messages.message.sent | custom | message |
| messages.message.read | custom | message |
| messages.message.marked_unread | custom | message |
| messages.message.archived | custom | message |
| messages.message.unarchived | custom | message |
| messages.message.deleted | custom | message |
| messages.message.action_taken | custom | message |
| messages.message.email_sent | custom | message |
| messages.message.email_failed | custom | message |

## ACL features  (7)

messages.view · messages.compose · messages.attach · messages.attach_files · messages.email · messages.actions · messages.manage

## API routes

_none_

## DI service tokens

_none_

## Search entities

messages:message

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

messages.new

## CLI

_none_
