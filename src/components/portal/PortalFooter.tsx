"use client"

import { useT } from '@open-mercato/shared/lib/i18n/context'

export function PortalFooter() {
  const t = useT()
  return (
    <footer className="mt-auto border-t border-gray-100 dark:border-white/10 py-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="h-px w-8 bg-gray-200 dark:bg-white/10" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-portal-secondary">
          {t('portal.footer.system', 'Hackathon Support System')}
        </span>
        <div className="h-px w-8 bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="flex items-center justify-center gap-6 text-xs text-portal-secondary">
        <a href="#" className="hover:text-foreground transition-colors">{t('portal.footer.codeOfConduct', 'Code of Conduct')}</a>
        <a href="#" className="hover:text-foreground transition-colors">{t('portal.footer.privacyPolicy', 'Privacy Policy')}</a>
        <a href="#" className="hover:text-foreground transition-colors">{t('portal.footer.safetyHotline', 'Safety Hotline')}</a>
      </div>
    </footer>
  )
}
