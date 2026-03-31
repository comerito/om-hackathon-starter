import Link from 'next/link'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import CompetitionsTable from '../components/CompetitionsTable'

export default function CompetitionsListPage() {
  return (
    <Page>
      <PageHeader
        title="Competitions"
        description="Manage hackathons, participants, and portal defaults."
        actions={(
          <Link
            href="/backend/competitions/settings/portal-localization"
            className="text-sm font-medium text-primary hover:underline"
          >
            Portal Localization
          </Link>
        )}
      />
      <PageBody>
        <CompetitionsTable />
      </PageBody>
    </Page>
  )
}
