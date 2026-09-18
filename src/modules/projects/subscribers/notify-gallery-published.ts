import { notifyTeamAboutGallery, type GalleryEventPayload } from '../lib/gallery/notifyTeam'

export const metadata = {
  event: 'projects.project.gallery_published',
  persistent: true,
  id: 'projects:notify-gallery-published',
}

export default async function handler(payload: GalleryEventPayload, ctx: { resolve: <T = unknown>(name: string) => T }) {
  try {
    await notifyTeamAboutGallery(payload, ctx, 'published')
  } catch (e) {
    console.error('[projects:notify-gallery-published] Notification error:', e)
  }
}
