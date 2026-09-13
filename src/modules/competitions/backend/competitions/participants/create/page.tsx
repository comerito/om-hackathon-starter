"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useCompetitionScope } from '@/lib/competition-scope'
import { useScopedCompetitionSeedOptions } from '@/lib/competition-label'
import { buildFields } from './fields'

export default function AddParticipantPage() {
  const t = useT()
  const { competitionId: scopedCompetitionId, ready: scopeReady } = useCompetitionScope()
  const competitionSeedOptions = useScopedCompetitionSeedOptions()

  const fields = React.useMemo<CrudField[]>(
    () => buildFields(t, competitionSeedOptions),
    [t, competitionSeedOptions],
  )

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'assignment',
      title: t('competitions.participants.form.group', 'Assign Participant'),
      column: 1,
      fields: ['competition_id', 'customer_user_id', 'role'],
    },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/competitions/participants?flash=${encodeURIComponent(t('competitions.participants.flash.added', 'Participant added'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          // The scope only resolves after hydration, and CrudForm will not push a
          // late `initialValues` into a combobox it considers user-touched — so remount
          // the form once the scope is known (and again if it changes).
          key={scopeReady ? scopedCompetitionId ?? 'home' : 'pending'}
          initialValues={scopedCompetitionId ? { competition_id: scopedCompetitionId } : undefined}
          // The competition combobox is the first field, so it would auto-focus — and a
          // focused combobox never renders the label for a value it did not receive from
          // the user, then clears that value on blur. Skip initial focus when prefilled.
          disableInitialFocus={Boolean(scopedCompetitionId)}
          title={t('competitions.participants.form.title', 'Add Participant')}
          backHref="/backend/competitions/participants"
          entityId="competitions:competition_participation"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.participants.form.submit', 'Add')}
          cancelHref="/backend/competitions/participants"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/participations', vals) }}
        />
      </PageBody>
    </Page>
  )
}
