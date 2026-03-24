import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import IncidentsTable from '../components/IncidentsTable'

export default function IncidentsListPage() {
  return (
    <Page>
      <PageBody>
        <IncidentsTable />
      </PageBody>
    </Page>
  )
}
