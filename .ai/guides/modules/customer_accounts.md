# customer_accounts — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| customer_accounts:customer_user | CustomerUser | customer_users | yes | yes |
| customer_accounts:customer_role | CustomerRole | customer_roles | yes | yes |
| customer_accounts:customer_role_acl | CustomerRoleAcl | customer_role_acls | yes | no |
| customer_accounts:customer_user_role | CustomerUserRole | customer_user_roles | no | no |
| customer_accounts:customer_user_acl | CustomerUserAcl | customer_user_acls | yes | no |
| customer_accounts:customer_user_session | CustomerUserSession | customer_user_sessions | no | no |
| customer_accounts:customer_user_email_verification | CustomerUserEmailVerification | customer_user_email_verifications | no | no |
| customer_accounts:customer_user_password_reset | CustomerUserPasswordReset | customer_user_password_resets | no | no |
| customer_accounts:customer_user_invitation | CustomerUserInvitation | customer_user_invitations | no | no |
| customer_accounts:domain_mapping | DomainMapping | domain_mappings | yes | no |

## Events  (25)

| ID | Category | Entity |
|---|---|---|
| customer_accounts.user.created | crud | user |
| customer_accounts.user.updated | crud | user |
| customer_accounts.user.deleted | crud | user |
| customer_accounts.user.locked | lifecycle | user |
| customer_accounts.user.unlocked | lifecycle | user |
| customer_accounts.login.success | lifecycle | — |
| customer_accounts.login.failed | lifecycle | — |
| customer_accounts.magic_link.requested | lifecycle | — |
| customer_accounts.email.verified | lifecycle | — |
| customer_accounts.password.reset_requested | lifecycle | — |
| customer_accounts.password.reset | lifecycle | — |
| customer_accounts.password.changed | lifecycle | — |
| customer_accounts.role.created | crud | role |
| customer_accounts.role.updated | crud | role |
| customer_accounts.role.deleted | crud | role |
| customer_accounts.user.invited | lifecycle | user |
| customer_accounts.invitation.accepted | lifecycle | — |
| customer_accounts.password_reset.requested | lifecycle | — |
| customer_accounts.domain_mapping.created | crud | domain_mapping |
| customer_accounts.domain_mapping.verified | lifecycle | domain_mapping |
| customer_accounts.domain_mapping.activated | lifecycle | domain_mapping |
| customer_accounts.domain_mapping.dns_failed | lifecycle | domain_mapping |
| customer_accounts.domain_mapping.tls_failed | lifecycle | domain_mapping |
| customer_accounts.domain_mapping.deleted | crud | domain_mapping |
| customer_accounts.domain_mapping.replaced | lifecycle | domain_mapping |

## ACL features  (5)

customer_accounts.view · customer_accounts.manage · customer_accounts.roles.manage · customer_accounts.invite · customer_accounts.domain.manage

## API routes

_none_

## DI service tokens

customerUserService · customerSessionService · customerTokenService · customerRbacService · customerInvitationService · domainMappingService

## Search entities

customer_accounts:customer_user · customer_accounts:customer_role

## Host extension points

- Entity IDs: _none_
- Table IDs: customer_accounts.admin.roles · customer_accounts.admin.users

## Notifications

customer_accounts.user.signup · customer_accounts.user.locked · customer_accounts.domain_mapping.verified · customer_accounts.domain_mapping.activated · customer_accounts.domain_mapping.dns_failed · customer_accounts.domain_mapping.tls_failed

## CLI

_none_
