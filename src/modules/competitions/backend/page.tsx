"use client"
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'

export default function CompetitionsModulePage() {
  const t = useT()
  return (
    <Page>
      <PageHeader
        title={t('competitions.module.title', 'HackOn Platform')}
        description={t('competitions.module.description', 'Manage hackathon competitions, participants, agenda, and announcements.')}
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/backend/competitions/competitions', label: 'Competitions', desc: 'Create and manage competitions' },
            { href: '/backend/competitions/participants', label: 'Participants', desc: 'Manage registrations and check-ins' },
            { href: '/backend/competitions/agenda', label: 'Agenda', desc: 'Schedule events and sessions' },
            { href: '/backend/competitions/announcements', label: 'Announcements', desc: 'Broadcast messages to participants' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg border p-4 hover:bg-accent transition-colors">
              <div className="font-medium">{item.label}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>
      </PageBody>
    </Page>
  )
}
