import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import CompetitionsTable from '../components/CompetitionsTable'

export default function CompetitionsListPage() {
  return (
    <Page>
      <PageBody>
        <CompetitionsTable />
      </PageBody>
    </Page>
  )
}
