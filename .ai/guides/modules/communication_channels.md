# communication_channels — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| communication_channels:communication_channel | CommunicationChannel | communication_channels | yes | no |
| communication_channels:external_conversation | ExternalConversation | external_conversations | yes | no |
| communication_channels:external_message | ExternalMessage | external_messages | no | no |
| communication_channels:message_channel_link | MessageChannelLink | message_channel_links | no | no |
| communication_channels:channel_thread_mapping | ChannelThreadMapping | channel_thread_mappings | yes | no |
| communication_channels:message_reaction | MessageReaction | message_reactions | no | no |
| communication_channels:channel_thread_token | ChannelThreadToken | channel_thread_tokens | no | no |
| communication_channels:channel_ingest_dead_letter | ChannelIngestDeadLetter | channel_ingest_dead_letters | no | no |

## Events  (16)

| ID | Category | Entity |
|---|---|---|
| communication_channels.message.received | custom | external_message |
| communication_channels.message.sent | custom | external_message |
| communication_channels.message.delivery_failed | custom | external_message |
| communication_channels.conversation.created | custom | external_conversation |
| communication_channels.conversation.reassigned | custom | external_conversation |
| communication_channels.contact.resolved | custom | external_conversation |
| communication_channels.channel.requires_reauth | lifecycle | communication_channel |
| communication_channels.channel.disconnected | lifecycle | communication_channel |
| communication_channels.channel.deleted | lifecycle | communication_channel |
| communication_channels.channel.primary_changed | lifecycle | communication_channel |
| communication_channels.reaction.added | custom | message_reaction |
| communication_channels.reaction.removed | custom | message_reaction |
| communication_channels.push.registered | lifecycle | communication_channel |
| communication_channels.push.failed | lifecycle | communication_channel |
| communication_channels.push.renewed | lifecycle | communication_channel |
| communication_channels.push.deactivated | lifecycle | communication_channel |

## ACL features  (8)

communication_channels.view · communication_channels.manage · communication_channels.react · communication_channels.assign · communication_channels.connect_user_channel · communication_channels.admin · communication_channels.channel.import_history · communication_channels.channel.push.manage

## API routes

_none_

## DI service tokens

_none_

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

communication_channels.message.received · communication_channels.channel.requires_reauth

## CLI

_none_
