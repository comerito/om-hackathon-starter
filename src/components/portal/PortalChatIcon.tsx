"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { MessageCircle } from 'lucide-react'
import { usePortalSelection } from './usePortalSelection'

export function PortalChatIcon() {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()
  const queryClient = useQueryClient()
  // Was a 1s localStorage poll, because "the competition selector writes to it without
  // dispatching events". It does now — CompetitionProvider announces every write, so the poll
  // (and its permanent timer on every portal page) is gone.
  const { competitionId } = usePortalSelection()

  const { data } = useQuery({
    queryKey: ['chat-unread', competitionId],
    queryFn: async () => {
      if (!competitionId) return 0
      const { ok, result } = await apiCall<{ unreadCount: number }>(
        `/api/competitions/portal/chat/unread-count?competition_id=${competitionId}`,
      )
      return ok ? result?.unreadCount ?? 0 : 0
    },
    enabled: !!competitionId && !!auth.user,
    refetchInterval: 10000,
  })

  const unreadCount = data ?? 0

  usePortalAppEvent('competitions.chat.message_sent', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
  }, [])

  usePortalAppEvent('competitions.chat.message_read', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
  }, [])

  if (!auth.user) return null

  const orgSlug = typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/([^/]+)\/portal/)?.[1] ?? ''
    : ''

  return (
    <button
      type="button"
      onClick={() => router.push(`/${orgSlug}/portal/chat`)}
      className="relative flex items-center justify-center size-8 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground transition-colors"
      aria-label={t('competitions.portal.chat.headerIcon', 'Chat')}
    >
      <MessageCircle className="size-[18px]" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
