'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Participation {
  id: string
  competitionId: string
  checkedIn: boolean
}

// ---------------------------------------------------------------------------
// Simple SVG QR code generator
//
// Encodes a short URL string as a minimal QR code using a basic approach.
// For production, swap with a real QR library (e.g., qrcode.react). This
// implementation creates a visual placeholder that displays the check-in
// code prominently.
// ---------------------------------------------------------------------------

function QrPlaceholder({ value, size = 320 }: { value: string; size?: number }) {
  // Generate a deterministic dot-matrix pattern from the value string
  const gridSize = 21
  const cellSize = size / gridSize

  // Simple hash-based pattern generation
  function hashChar(str: string, i: number): number {
    let h = 0
    for (let j = 0; j < str.length; j++) {
      h = ((h << 5) - h + str.charCodeAt(j) * (i + j + 1)) | 0
    }
    return Math.abs(h)
  }

  const cells: boolean[][] = []
  for (let r = 0; r < gridSize; r++) {
    cells[r] = []
    for (let c = 0; c < gridSize; c++) {
      // Finder patterns (top-left, top-right, bottom-left)
      const inFinderTL = r < 7 && c < 7
      const inFinderTR = r < 7 && c >= gridSize - 7
      const inFinderBL = r >= gridSize - 7 && c < 7

      if (inFinderTL || inFinderTR || inFinderBL) {
        const fr = inFinderTL ? r : inFinderTR ? r : r - (gridSize - 7)
        const fc = inFinderTL ? c : inFinderTR ? c - (gridSize - 7) : c
        // Standard finder pattern
        const onBorder = fr === 0 || fr === 6 || fc === 0 || fc === 6
        const inCenter = fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4
        cells[r][c] = onBorder || inCenter
      } else {
        cells[r][c] = hashChar(value, r * gridSize + c) % 3 !== 0
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto"
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect width={size} height={size} fill="white" />
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalQrPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [participation, setParticipation] = useState<Participation | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullScreen, setFullScreen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp = compRes?.data?.[0]
      if (comp) {
        const partRes = await apiCall(`/api/competitions/portal/data?type=participations&competitionId=${comp.id}`)
        setParticipation(partRes?.data?.[0] ?? null)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Escape exits full screen
  useEffect(() => {
    if (!fullScreen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFullScreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullScreen])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!participation) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.nav.qr_code')} />
        <PortalEmptyState
          title="No participation found"
          description="You need to be registered for an active competition to view your QR code."
        />
      </div>
    )
  }

  const checkinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/competitions/participations/${participation.id}/checkin`

  // Full-screen overlay
  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
        onClick={() => setFullScreen(false)}
      >
        <QrPlaceholder value={checkinUrl} size={Math.min(480, typeof window !== 'undefined' ? window.innerWidth * 0.8 : 480)} />
        <p className="mt-6 max-w-sm break-all text-center font-mono text-xs text-gray-500">
          {participation.id}
        </p>
        <p className="mt-4 text-sm text-gray-400">Tap anywhere to close</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        title={t('competitions.portal.nav.qr_code')}
        description="Show this code at the registration desk to check in."
      />

      <PortalCard>
        <PortalCardHeader label="Check-in" title="Your QR Code" />

        <div className="mt-4 flex justify-center">
          <div className="rounded-xl border bg-white p-4" style={{ width: '60%', maxWidth: 400 }}>
            <QrPlaceholder value={checkinUrl} size={320} />
          </div>
        </div>

        {/* Participation ID as fallback */}
        <p className="mt-4 text-center font-mono text-xs text-muted-foreground">
          ID: {participation.id}
        </p>

        {participation.checkedIn && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Already checked in
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button type="button" onClick={() => setFullScreen(true)}>
            Full Screen
          </Button>
        </div>
      </PortalCard>
    </div>
  )
}
