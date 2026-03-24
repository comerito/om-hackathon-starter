import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import ProjectsTable from '../components/ProjectsTable'

export default function ProjectsListPage() {
  return (
    <Page>
      <PageBody>
        <ProjectsTable />
      </PageBody>
    </Page>
  )
}
