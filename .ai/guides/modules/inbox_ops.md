# inbox_ops — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| inbox_ops:inbox_settings | InboxSettings | inbox_settings | yes | no |
| inbox_ops:inbox_email | InboxEmail | inbox_emails | yes | no |
| inbox_ops:inbox_proposal | InboxProposal | inbox_proposals | yes | yes |
| inbox_ops:inbox_proposal_action | InboxProposalAction | inbox_proposal_actions | yes | no |
| inbox_ops:inbox_discrepancy | InboxDiscrepancy | inbox_discrepancies | yes | no |

## Events  (13)

| ID | Category | Entity |
|---|---|---|
| inbox_ops.email.received | custom | email |
| inbox_ops.email.processed | lifecycle | email |
| inbox_ops.email.failed | lifecycle | email |
| inbox_ops.email.reprocessed | custom | email |
| inbox_ops.email.deduplicated | custom | email |
| inbox_ops.proposal.created | crud | proposal |
| inbox_ops.proposal.accepted | custom | proposal |
| inbox_ops.proposal.rejected | custom | proposal |
| inbox_ops.action.rejected | custom | action |
| inbox_ops.action.edited | custom | action |
| inbox_ops.action.executed | custom | action |
| inbox_ops.action.failed | custom | action |
| inbox_ops.reply.sent | custom | reply |

## ACL features  (5)

inbox_ops.proposals.view · inbox_ops.proposals.manage · inbox_ops.settings.manage · inbox_ops.log.view · inbox_ops.replies.send

## API routes

_none_

## DI service tokens

_none_

## Search entities

inbox_ops:inbox_proposal

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

inbox_ops.proposal.created

## CLI

_none_
