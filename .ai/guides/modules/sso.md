# sso — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| sso:sso_config | SsoConfig | sso_configs | yes | no |
| sso:sso_identity | SsoIdentity | sso_identities | yes | no |
| sso:scim_token | ScimToken | scim_tokens | yes | no |
| sso:sso_user_deactivation | SsoUserDeactivation | sso_user_deactivations | no | no |
| sso:scim_provisioning_log | ScimProvisioningLog | scim_provisioning_log | no | no |
| sso:sso_role_grant | SsoRoleGrant | sso_role_grants | no | no |

## Events  (12)

| ID | Category | Entity |
|---|---|---|
| sso.login.initiated | lifecycle | — |
| sso.login.completed | lifecycle | — |
| sso.login.failed | lifecycle | — |
| sso.identity.linked | lifecycle | — |
| sso.identity.created | lifecycle | — |
| sso.config.created | crud | sso_config |
| sso.config.updated | crud | sso_config |
| sso.config.deleted | crud | sso_config |
| sso.config.activated | lifecycle | sso_config |
| sso.config.deactivated | lifecycle | sso_config |
| sso.domain.added | lifecycle | sso_config |
| sso.domain.removed | lifecycle | sso_config |

## ACL features  (3)

sso.config.view · sso.config.manage · sso.scim.manage

## API routes

_none_

## DI service tokens

ssoService · accountLinkingService · ssoConfigService · hrdService · scimTokenService · scimService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

_none_

## CLI

_none_
