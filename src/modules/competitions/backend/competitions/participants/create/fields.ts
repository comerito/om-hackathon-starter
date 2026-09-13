/**
 * Field definitions for the Add Participant form, kept separate from `page.tsx`.
 *
 * `page.tsx` pulls in `CrudForm`/`Page` (and, transitively, the rich-text sanitizer's ESM-only
 * `sanitize-html`/`htmlparser2` chain, which this app's Jest config does not transform). Importing
 * `page.tsx` from a plain Jest test to check a field's config would drag all of that in for no
 * reason. This module only pulls in the `CrudField`/`CrudFieldOption` *types* (erased at compile
 * time) plus the two lightweight option loaders, so a test can import it directly.
 */
import type { CrudField, CrudFieldOption } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { loadCustomerUserOptions } from '../../../../lib/customerUserOptions'

type CompetitionOption = { id: string; name: string }

export async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

/**
 * Both `competition_id` and `customer_user_id` are foreign keys resolved through a combobox —
 * `ComboboxInput` defaults `allowCustomValues` to `true` (it also backs free-text tag-style
 * inputs), which is wrong here: nothing downstream can turn typed text into a competition or
 * customer id. Without `allowCustomValues: false`, typing a name and pressing Enter/Tab/blurring
 * before the exact "Name (email)" label was clicked — never clicking a suggestion row — commits
 * the raw text as the field value. That passes the client's required-field check (it is
 * non-empty), reaches the server, fails `z.string().uuid()`, and the resulting field error
 * refocuses the same input — which reads as "I picked them, clicked Add, and nothing happened."
 * `allowCustomValues: false` makes an unmatched blur/Enter revert to the last known-good value
 * instead, forcing an actual selection.
 */
export function buildFields(
  t: (key: string, fallback: string) => string,
  competitionSeedOptions: CrudFieldOption[] | undefined,
): CrudField[] {
  return [
    {
      id: 'competition_id',
      label: t('competitions.participants.form.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      seedOptions: competitionSeedOptions,
      allowCustomValues: false,
    },
    {
      id: 'customer_user_id',
      label: t('competitions.participants.form.customerUser', 'Customer Account'),
      type: 'combobox',
      required: true,
      loadOptions: loadCustomerUserOptions,
      allowCustomValues: false,
    },
    {
      id: 'role',
      label: t('competitions.participants.form.role', 'Role'),
      type: 'select',
      required: true,
      options: [
        { value: 'participant', label: 'Participant' },
        { value: 'mentor', label: 'Mentor' },
        { value: 'judge', label: 'Judge' },
      ],
    },
  ]
}
