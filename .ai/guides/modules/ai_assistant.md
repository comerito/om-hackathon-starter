# ai_assistant — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| ai_assistant:ai_agent_prompt_override | AiAgentPromptOverride | ai_agent_prompt_overrides | yes | no |
| ai_assistant:ai_pending_action | AiPendingAction | ai_pending_actions | no | no |
| ai_assistant:ai_agent_runtime_override | AiAgentRuntimeOverride | ai_agent_runtime_overrides | yes | no |
| ai_assistant:ai_token_usage_event | AiTokenUsageEvent | ai_token_usage_events | yes | no |
| ai_assistant:ai_token_usage_daily | AiTokenUsageDaily | ai_token_usage_daily | yes | no |
| ai_assistant:ai_tenant_model_allowlist | AiTenantModelAllowlist | ai_tenant_model_allowlists | yes | no |
| ai_assistant:ai_agent_mutation_policy_override | AiAgentMutationPolicyOverride | ai_agent_mutation_policy_overrides | yes | no |
| ai_assistant:ai_chat_conversation | AiChatConversation | ai_chat_conversations | yes | no |
| ai_assistant:ai_chat_conversation_participant | AiChatConversationParticipant | ai_chat_conversation_participants | yes | no |
| ai_assistant:ai_chat_message | AiChatMessage | ai_chat_messages | yes | no |

## Events  (6)

| ID | Category | Entity |
|---|---|---|
| ai.action.confirmed | — | ai_pending_action |
| ai.action.cancelled | — | ai_pending_action |
| ai.action.expired | — | ai_pending_action |
| ai.token_usage.recorded | — | token_usage |
| ai_assistant.conversation.shared | — | ai_chat_conversation |
| ai_assistant.conversation.unshared | — | ai_chat_conversation |

## ACL features  (8)

ai_assistant.view · ai_assistant.settings.manage · ai_assistant.conversations.manage · ai_assistant.conversations.share · ai_assistant.mcp.serve · ai_assistant.tools.list · ai_assistant.mcp_servers.view · ai_assistant.mcp_servers.manage

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

ai_assistant.conversation_shared

## CLI

mcp:serve · mcp:serve-http · mcp:dev · mcp:ensure-api-key · mcp:list-tools · entity-graph · run-pending-action-cleanup · run-token-usage-prune · test-tools
