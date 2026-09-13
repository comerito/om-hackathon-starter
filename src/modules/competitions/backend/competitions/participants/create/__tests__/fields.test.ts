/**
 * Pins `allowCustomValues: false` on the Add Participant form's two foreign-key comboboxes.
 *
 * The bug this guards: `ComboboxInput` defaults `allowCustomValues` to `true` (it also backs
 * free-text tag-style inputs elsewhere). Left at the default here, typing a name and confirming
 * via Enter/Tab/blur *without* clicking a suggestion row commits the raw typed text as the field
 * value instead of the selected option's id. That is non-empty, so the client's required-field
 * check passes; the server then rejects it (`customer_user_id`/`competition_id` are
 * `z.string().uuid()`), and the resulting field error refocuses the same combobox — which reads
 * as "I picked them, clicked Add, and nothing happened." `allowCustomValues: false` makes an
 * unmatched blur/Enter revert to the last known-good value instead, forcing an actual selection.
 */
import { buildFields } from '../fields'

describe('AddParticipantPage buildFields', () => {
  const t = (_key: string, fallback: string) => fallback

  it('disallows custom values on the competition and customer-account comboboxes', () => {
    const fields = buildFields(t, undefined)
    const competition = fields.find((f) => f.id === 'competition_id')
    const customerUser = fields.find((f) => f.id === 'customer_user_id')

    expect(competition?.type).toBe('combobox')
    expect(customerUser?.type).toBe('combobox')
    // `allowCustomValues` only exists on the non-custom builtin field union member; the `type`
    // assertions above already prove that's what these are.
    expect(competition && competition.type !== 'custom' ? competition.allowCustomValues : undefined).toBe(false)
    expect(customerUser && customerUser.type !== 'custom' ? customerUser.allowCustomValues : undefined).toBe(false)
  })

  it('still requires all three fields', () => {
    const fields = buildFields(t, undefined)
    for (const id of ['competition_id', 'customer_user_id', 'role']) {
      expect(fields.find((f) => f.id === id)?.required).toBe(true)
    }
  })
})
