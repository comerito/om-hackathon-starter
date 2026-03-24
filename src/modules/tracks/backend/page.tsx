import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import TracksTable from '../components/TracksTable'

export default function TracksListPage() {
  return (
    <Page>
      <PageBody>
        <TracksTable />
      </PageBody>
    </Page>
  )
}
