"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { MarkdownContent } from '@open-mercato/ui/backend/markdown/MarkdownContent'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { PortalCompetitionLayout } from '../../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../components/CompetitionContext'
import { PortalPageTitle, SectionLabel } from '@/components/portal'

type LegalDocumentKey = 'code_of_conduct' | 'rules' | 'privacy_policy'

type LegalDocumentResponse = {
  competition_name: string | null
  document: LegalDocumentKey
  content: string | null
  external_url: string | null
}

function resolveDocument(document: string): LegalDocumentKey {
  if (document === 'code-of-conduct') return 'code_of_conduct'
  if (document === 'privacy-policy') return 'privacy_policy'
  return 'rules'
}

function LegalDocumentContent({ document }: { document: string }) {
  const t = useT()
  const { orgSlug } = usePortalContext()
  const { selectedId } = useCompetitionContext()
  const documentKey = resolveDocument(document)

  const copy = React.useMemo(() => {
    if (documentKey === 'code_of_conduct') {
      return {
        title: t('competitions.portal.legal.codeOfConduct.title', 'Code of Conduct'),
        empty: t('competitions.portal.legal.codeOfConduct.empty', 'No Code of Conduct content has been published yet.'),
      }
    }
    if (documentKey === 'privacy_policy') {
      return {
        title: t('competitions.portal.legal.privacyPolicy.title', 'Privacy Policy'),
        empty: t('competitions.portal.legal.privacyPolicy.empty', 'No privacy policy content has been published yet.'),
      }
    }
    return {
      title: t('competitions.portal.legal.rules.title', 'Competition Rules'),
      empty: t('competitions.portal.legal.rules.empty', 'No competition rules have been published yet.'),
    }
  }, [documentKey, t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-legal-document', selectedId, documentKey],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<LegalDocumentResponse>(
        `/api/competitions/portal/legal-document?competition_id=${selectedId}&document=${documentKey}`,
      )
      if (!ok || !result) throw new Error(copy.empty)
      return result
    },
    enabled: !!selectedId,
  })

  if (!selectedId) {
    return (
      <PortalEmptyState
        title={t('competitions.portal.competition.empty.title', 'No competitions yet')}
        description={t('competitions.portal.competition.empty.description', "You haven't been registered in any competition. Contact the organizer to get started.")}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
        {t('common.loading', 'Loading...')}
      </div>
    )
  }

  if (error || !data) {
    return <PortalEmptyState title={copy.title} description={copy.empty} />
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageTitle
        label={t('competitions.portal.legal.eyebrow', 'Competition documents')}
        title={copy.title}
        rightElement={(
          <Link
            href={`/${orgSlug}/portal/competition`}
            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-portal-primary hover:text-portal-primary dark:border-white/10"
          >
            {t('competitions.portal.legal.backToCompetition', 'Back to Competition')}
          </Link>
        )}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-8">
        <SectionLabel className="mb-2">
          {data.competition_name ?? copy.title}
        </SectionLabel>

        {data.content ? (
          <MarkdownContent
            body={data.content}
            format="markdown"
            className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-a:text-portal-primary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
            {data.external_url && (
              <a
                href={data.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center rounded-lg bg-portal-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-portal-primary-light"
              >
                {t('competitions.portal.legal.openExternal', 'Open external document')}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LegalDocumentPage({ params }: { params: { orgSlug: string; document: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <LegalDocumentContent document={params.document} />
    </PortalCompetitionLayout>
  )
}
