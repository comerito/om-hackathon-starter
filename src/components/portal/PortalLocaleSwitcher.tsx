"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Languages } from 'lucide-react'

type PortalLocaleResponse = {
  ok: boolean
  locale: string
  supported_locales: string[]
}

const FALLBACK_PORTAL_LOCALES = ['pl', 'en']

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

export function PortalLocaleSwitcher() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const currentLocale = useLocale()
  const [pendingLocale, setPendingLocale] = React.useState<string>(currentLocale)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setPendingLocale(currentLocale)
  }, [currentLocale])

  const { data } = useQuery({
    queryKey: ['portal-locale-preference'],
    queryFn: async () => {
      const { ok, result } = await apiCall<PortalLocaleResponse>('/api/competitions/portal/locale')
      if (!ok || !result) throw new Error(t('competitions.portal.locale.loadError', 'Failed to load language options'))
      return result
    },
    staleTime: 60_000,
  })

  const supportedLocales = data?.supported_locales?.length ? data.supported_locales : FALLBACK_PORTAL_LOCALES

  async function handleChange(nextLocale: string) {
    setPendingLocale(nextLocale)

    if (nextLocale === currentLocale) return

    setIsSaving(true)
    try {
      const { ok } = await apiCall('/api/competitions/portal/locale', {
        method: 'PUT',
        body: JSON.stringify({ locale: nextLocale }),
        headers: { 'content-type': 'application/json' },
      })
      if (!ok) {
        flash(t('competitions.portal.locale.saveError', 'Failed to update portal language'), 'error')
        setPendingLocale(currentLocale)
        return
      }

      await queryClient.invalidateQueries()
      router.refresh()
    } catch {
      flash(t('competitions.portal.locale.saveError', 'Failed to update portal language'), 'error')
      setPendingLocale(currentLocale)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
        <Languages className="size-3.5" />
        {t('competitions.portal.locale.label', 'Language')}
      </div>
      <div
        className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5"
        aria-label={t('competitions.portal.locale.label', 'Language')}
        role="group"
      >
        {supportedLocales.map((locale) => {
          const active = pendingLocale === locale
          return (
            <button
              key={locale}
              type="button"
              onClick={() => handleChange(locale)}
              disabled={isSaving}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-portal-primary text-white'
                  : 'text-portal-secondary hover:bg-gray-100 hover:text-foreground dark:hover:bg-white/10'
              }`}
              aria-pressed={active}
              title={getLocaleLabel(locale, t)}
            >
              {locale.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
