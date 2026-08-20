# auth — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| auth:user | User | users | yes | no |
| auth:role | Role | roles | yes | no |
| auth:user_sidebar_preference | UserSidebarPreference | user_sidebar_preferences | yes | no |
| auth:role_sidebar_preference | RoleSidebarPreference | role_sidebar_preferences | yes | no |
| auth:sidebar_variant | SidebarVariant | sidebar_variants | yes | no |
| auth:user_role | UserRole | user_roles | no | no |
| auth:session | Session | sessions | no | no |
| auth:password_reset | PasswordReset | password_resets | no | no |
| auth:role_acl | RoleAcl | role_acls | yes | no |
| auth:user_acl | UserAcl | user_acls | yes | no |
| auth:user_consent | UserConsent | user_consents | yes | no |

## Events  (12)

| ID | Category | Entity |
|---|---|---|
| auth.user.created | crud | user |
| auth.user.updated | crud | user |
| auth.user.deleted | crud | user |
| auth.role.created | crud | role |
| auth.role.updated | crud | role |
| auth.role.deleted | crud | role |
| auth.login.success | lifecycle | — |
| auth.login.failed | lifecycle | — |
| auth.logout | lifecycle | — |
| auth.password.changed | lifecycle | — |
| auth.password.reset.requested | lifecycle | — |
| auth.password.reset.completed | lifecycle | — |

## ACL features  (8)

auth.users.list · auth.users.create · auth.users.edit · auth.users.delete · auth.roles.list · auth.roles.manage · auth.acl.manage · auth.sidebar.manage

## API routes

_none_

## DI service tokens

authService · rbacService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: auth.roles.list · auth.users.list

## Notifications

auth.password_reset.requested · auth.password_reset.completed · auth.account.locked · auth.login.new_device · auth.role.assigned · auth.role.revoked

## CLI

add-user · seed-roles · sync-role-acls · rotate-encryption-key · add-org · setup · list-orgs · list-tenants · list-users · set-password
