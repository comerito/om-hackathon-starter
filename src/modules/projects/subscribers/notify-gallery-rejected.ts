import { notifyTeamAboutGallery, type GalleryEventPayload } from '../lib/gallery/notifyTeam'

export const metadata = {
  event: 'projects.project.gallery_rejected',
  persistent: true,
  id: 'projects:notify-gallery-rejected',
}

export default async function handler(payload: GalleryEventPayload, ctx: { resolve: <T = unknown>(name: string) => T }) {
  try {
    await notifyTeamAboutGallery(payload, ctx, 'rejected')
  } catch (e) {
    console.error('[projects:notify-gallery-rejected] Notification error:', e)
  }
}
