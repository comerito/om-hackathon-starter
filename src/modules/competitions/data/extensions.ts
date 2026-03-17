// Cross-module entity links (ParticipantProfile → CustomerUser)
import { defineLink, entityId, linkable } from '@open-mercato/shared/modules/dsl'

export const extensions = [
  defineLink({
    source: entityId('competitions:participant_profile'),
    target: linkable('customer_accounts:user'),
  }),
]
