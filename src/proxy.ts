import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Note: Do NOT import bootstrap here - middleware runs in Edge runtime
// which cannot use Node.js modules like MikroORM. Bootstrap is called
// in layout.tsx which runs in Node.js runtime.

export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers)
  // Expose the current URL — path AND query — to server components via request headers.
  // A Next.js layout only receives `params`, never `searchParams`, so this header is the only
  // way a layout can see a query parameter. The portal layout needs `?locale=` (#101); the
  // backend layout wants the path alone and already strips anything from '?' onwards.
  requestHeaders.set('x-next-url', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  // The portal is server-rendered behind the (frontend) catch-all at /<orgSlug>/portal/**, and
  // its layout resolves the locale — so it needs the header too, not just /backend.
  // `:path*` is zero-or-more but does not reliably match the bare parent, so the portal root is
  // listed explicitly — it is a real page (`/<orgSlug>/portal`) and needs the header too.
  matcher: ['/backend/:path*', '/:orgSlug/portal', '/:orgSlug/portal/:path*'],
}
