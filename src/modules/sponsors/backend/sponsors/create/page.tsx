"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type SponsorRow = {
  id: string
  competition_id: string
  name: string
  tier: string
  logo_url: string
  website_url: string | null
  description: string | null
  challenge_title: string | null
  challenge_description: string | null
  challenge_resources_url: string | null
  contact_name: string | null
  contact_email: string | null
  order: number
  is_visible: boolean
  is_active: boolean
}

export default function SponsorCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const competitionId = searchParams.get('competitionId') ?? ''
  const editId = searchParams.get('id')

  const [name, setName] = React.useState('')
  const [tier, setTier] = React.useState('PARTNER')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [websiteUrl, setWebsiteUrl] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [challengeTitle, setChallengeTitle] = React.useState('')
  const [challengeDescription, setChallengeDescription] = React.useState('')
  const [challengeResourcesUrl, setChallengeResourcesUrl] = React.useState('')
  const [contactName, setContactName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [order, setOrder] = React.useState(0)
  const [isVisible, setIsVisible] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Load existing sponsor for edit
  const { isLoading } = useQuery({
    queryKey: ['sponsor-edit', editId],
    queryFn: async () => {
      const res = await fetchCrudList<SponsorRow>('sponsors/sponsors', { id: editId!, pageSize: '1' } as Record<string, string>)
      const sponsor = res?.items?.[0]
      if (sponsor) {
        setName(sponsor.name)
        setTier(sponsor.tier)
        setLogoUrl(sponsor.logo_url)
        setWebsiteUrl(sponsor.website_url ?? '')
        setDescription(sponsor.description ?? '')
        setChallengeTitle(sponsor.challenge_title ?? '')
        setChallengeDescription(sponsor.challenge_description ?? '')
        setChallengeResourcesUrl(sponsor.challenge_resources_url ?? '')
        setContactName(sponsor.contact_name ?? '')
        setContactEmail(sponsor.contact_email ?? '')
        setOrder(sponsor.order)
        setIsVisible(sponsor.is_visible)
      }
      return sponsor
    },
    enabled: !!editId,
  })

  const handleSave = async () => {
    if (!name.trim() || !logoUrl.trim()) {
      flash(t('sponsors.form.error.required', 'Name and Logo URL are required'), 'error')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        await apiCall('/api/sponsors/sponsors', {
          method: 'PUT',
          body: JSON.stringify({
            id: editId,
            name: name.trim(),
            tier,
            logoUrl: logoUrl.trim(),
            websiteUrl: websiteUrl.trim() || null,
            description: description.trim() || null,
            challengeTitle: challengeTitle.trim() || null,
            challengeDescription: challengeDescription.trim() || null,
            challengeResourcesUrl: challengeResourcesUrl.trim() || null,
            contactName: contactName.trim() || null,
            contactEmail: contactEmail.trim() || null,
            order,
            isVisible,
          }),
        })
        flash(t('sponsors.flash.updated', 'Sponsor updated'), 'success')
      } else {
        await apiCall('/api/sponsors/sponsors', {
          method: 'POST',
          body: JSON.stringify({
            competitionId,
            name: name.trim(),
            tier,
            logoUrl: logoUrl.trim(),
            websiteUrl: websiteUrl.trim() || null,
            description: description.trim() || null,
            challengeTitle: challengeTitle.trim() || null,
            challengeDescription: challengeDescription.trim() || null,
            challengeResourcesUrl: challengeResourcesUrl.trim() || null,
            contactName: contactName.trim() || null,
            contactEmail: contactEmail.trim() || null,
            order,
            isVisible,
          }),
        })
        flash(t('sponsors.flash.created', 'Sponsor created'), 'success')
      }
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
      router.push(`/backend/sponsors?competitionId=${competitionId}`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (editId && isLoading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <div className="mb-6">
          <Link
            href={`/backend/sponsors?competitionId=${competitionId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {t('sponsors.form.backToSponsors', 'Back to Sponsors')}
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {editId
              ? t('sponsors.form.editTitle', 'Edit Sponsor')
              : t('sponsors.form.createTitle', 'Add Sponsor')}
          </h1>
        </div>

        <div className="max-w-2xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">{t('sponsors.form.name', 'Name')} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                maxLength={255}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('sponsors.form.tier', 'Tier')} *</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="TITLE">Title</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="PARTNER">Partner</option>
                <option value="IN_KIND">In-Kind</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('sponsors.form.logoUrl', 'Logo URL')} *</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('sponsors.form.websiteUrl', 'Website URL')}</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('sponsors.form.description', 'Description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">{t('sponsors.form.challenge', 'Sponsor Challenge')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.challengeTitle', 'Challenge Title')}</label>
                <input
                  type="text"
                  value={challengeTitle}
                  onChange={(e) => setChallengeTitle(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.challengeDescription', 'Challenge Description')}</label>
                <textarea
                  value={challengeDescription}
                  onChange={(e) => setChallengeDescription(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  maxLength={10000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.challengeResources', 'Resources URL')}</label>
                <input
                  type="url"
                  value={challengeResourcesUrl}
                  onChange={(e) => setChallengeResourcesUrl(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">{t('sponsors.form.contact', 'Contact')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.contactName', 'Contact Name')}</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.contactEmail', 'Contact Email')}</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">{t('sponsors.form.order', 'Display Order')}</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  id="is-visible"
                />
                <label htmlFor="is-visible" className="text-sm">
                  {t('sponsors.form.isVisible', 'Visible on portal')}
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? t('sponsors.form.saving', 'Saving...')
                : editId
                  ? t('sponsors.form.update', 'Update Sponsor')
                  : t('sponsors.form.create', 'Create Sponsor')}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/backend/sponsors?competitionId=${competitionId}`)}
            >
              {t('sponsors.form.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
