import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import TeamsTable from '../components/TeamsTable'

export default function TeamsListPage() {
  return (
    <Page>
      <PageBody>
        <TeamsTable />
      </PageBody>
    </Page>
  )
}
