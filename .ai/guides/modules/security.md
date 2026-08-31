# security — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| security:user_mfa_method | UserMfaMethod | user_mfa_methods | yes | no |
| security:mfa_recovery_code | MfaRecoveryCode | mfa_recovery_codes | no | no |
| security:mfa_enforcement_policy | MfaEnforcementPolicy | mfa_enforcement_policies | yes | no |
| security:sudo_challenge_config | SudoChallengeConfig | sudo_challenge_configs | yes | no |
| security:sudo_session | SudoSession | sudo_sessions | no | no |
| security:mfa_challenge | MfaChallenge | mfa_challenges | no | no |

## Events  (20)

| ID | Category | Entity |
|---|---|---|
| security.password.changed | lifecycle | password |
| security.password.notification_requested | lifecycle | password |
| security.mfa.method.added | lifecycle | — |
| security.mfa.method.removed | lifecycle | — |
| security.mfa.enrolled | lifecycle | — |
| security.mfa.removed | lifecycle | — |
| security.mfa.verified | lifecycle | — |
| security.mfa.otp.sent | lifecycle | — |
| security.mfa.reset | lifecycle | — |
| security.recovery.regenerated | lifecycle | — |
| security.recovery.used | lifecycle | — |
| security.enforcement.created | lifecycle | — |
| security.enforcement.updated | lifecycle | — |
| security.enforcement.deadline_reminder_requested | lifecycle | — |
| security.sudo.challenged | lifecycle | — |
| security.sudo.verified | lifecycle | — |
| security.sudo.failed | lifecycle | — |
| security.sudo.config.created | lifecycle | — |
| security.sudo.config.updated | lifecycle | — |
| security.sudo.config.deleted | lifecycle | — |

## ACL features  (7)

security.profile.view · security.profile.password · security.profile.manage · security.mfa.manage · security.admin.manage · security.sudo.view · security.sudo.manage

## API routes

_none_

## DI service tokens

passwordService · mfaService · mfaVerificationService · mfaEnforcementService · mfaAdminService · sudoChallengeService

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: security.enforcement.list · security.sudo.list · security.users.list

## Notifications

security.password.changed · security.mfa.enrolled · security.mfa.reset · security.mfa.enforcement_deadline

## CLI

_none_
