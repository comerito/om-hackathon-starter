"use client"

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'

type PortalLocaleSettings = {
  ok: boolean
  default_locale: string
  supported_locales: string[]
}

function getLocaleLabel(locale: string, t: ReturnType<typeof useT>) {
  const key = `competitions.portal.locale.option.${locale}`
  const fallbackMap: Record<string, string> = {
    pl: 'Polski',
    en: 'English',
    de: 'Deutsch',
    es: 'Espanol',
  }
  return t(key, fallbackMap[locale] ?? locale.toUpperCase())
}

export default function PortalLocalizationSettingsPage() {
  const t = useT()
  const [defaultLocale, setDefaultLocale] = React.useState('pl')
  const [isSaving, setIsSaving] = React.useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-portal-locale-settings'],
    queryFn: async () => {
      const { ok, result } = await apiCall<PortalLocaleSettings>('/api/competitions/admin/portal-locale-settings')
      if (!ok || !result) throw new Error(t('competitions.backend.portalLocale.loadError', 'Failed to load portal locale settings'))
      return result
    },
  })

  React.useEffect(() => {
    if (data?.default_locale) setDefaultLocale(data.default_locale)
  }, [data])

  async function handleSave() {
    setIsSaving(true)
    try {
      const { ok } = await apiCall('/api/competitions/admin/portal-locale-settings', {
        method: 'PUT',
        body: JSON.stringify({ default_locale: defaultLocale }),
        headers: { 'content-type': 'application/json' },
      })
      if (!ok) {
        flash(t('competitions.backend.portalLocale.saveError', 'Failed to save portal locale settings'), 'error')
        return
      }
      flash(t('competitions.backend.portalLocale.saved', 'Portal locale settings updated'))
      await refetch()
    } catch {
      flash(t('competitions.backend.portalLocale.saveError', 'Failed to save portal locale settings'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title={t('competitions.backend.portalLocale.title', 'Portal Localization')}
        description={t('competitions.backend.portalLocale.description', 'Set the default language used by the participant portal before an individual preference is saved.')}
        actions={(
          <Link href="/backend/competitions" className="text-sm font-medium text-primary hover:underline">
            {t('competitions.backend.portalLocale.back', 'Back to competitions')}
          </Link>
        )}
      />
      <PageBody>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t('competitions.backend.portalLocale.loading', 'Loading settings...')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="portal-default-locale" className="text-sm font-medium text-foreground">
                  {t('competitions.backend.portalLocale.defaultLabel', 'Portal default locale')}
                </label>
                <select
                  id="portal-default-locale"
                  value={defaultLocale}
                  onChange={(event) => setDefaultLocale(event.target.value)}
                  className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {(data?.supported_locales ?? ['pl', 'en']).map((locale) => (
                    <option key={locale} value={locale}>
                      {getLocaleLabel(locale, t)}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  {t('competitions.backend.portalLocale.help', 'Portal pages first use the participant preference, then this default locale, then the browser language.')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving
                    ? t('competitions.backend.portalLocale.saving', 'Saving...')
                    : t('competitions.backend.portalLocale.save', 'Save settings')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageBody>
    </Page>
  )
}
