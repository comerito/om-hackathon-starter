"use client"
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { cn } from '@open-mercato/shared/lib/utils'
import { ArrowLeft, Send, MessageCircle, Search } from 'lucide-react'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalPageTitle } from '@/components/portal'

type Conversation = {
  threadId: string
  lastMessage: { id: string; body: string; sentAt: string; isMine: boolean }
  otherUser: { id: string; displayName: string; avatarUrl: string | null }
  unreadCount: number
}

type ThreadMessage = {
  id: string
  body: string
  bodyFormat: string
  senderUserId: string
  isMine: boolean
  sentAt: string
}

type ThreadData = {
  messages: ThreadMessage[]
  thread: { id: string; otherUser: { id: string; displayName: string; avatarUrl: string | null } }
  total: number
  hasMore: boolean
}

type Participant = {
  customer_user_id: string
  display_name: string
  role: string
  avatar_url: string | null
}

/* ---------- helpers ---------- */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function Avatar({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'
  const initials = name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name} className={cn(sizeClass, 'rounded-full object-cover')} />
  return <div className={cn(sizeClass, 'rounded-full bg-portal-primary/10 text-portal-primary font-bold flex items-center justify-center')}>{initials}</div>
}

/* ---------- conversation list ---------- */

function ConversationList({
  conversations,
  selectedThreadId,
  onSelect,
  onNewChat,
  isLoading,
}: {
  conversations: Conversation[]
  selectedThreadId: string | null
  onSelect: (c: Conversation) => void
  onNewChat: () => void
  isLoading: boolean
}) {
  const t = useT()
  const [search, setSearch] = React.useState('')

  const filtered = search.length >= 2
    ? conversations.filter(c => c.otherUser.displayName.toLowerCase().includes(search.toLowerCase()))
    : conversations

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">{t('competitions.portal.chat.title', 'Chat')}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onNewChat}>
            {t('competitions.portal.chat.newChat', 'New Chat')}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={t('competitions.portal.chat.searchPlaceholder', 'Search conversations...')}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 text-center text-sm text-portal-secondary">{t('common.loading', 'Loading...')}</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-center">
            <MessageCircle className="size-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-portal-secondary">{t('competitions.portal.chat.noConversations', 'No conversations yet')}</p>
          </div>
        )}
        {filtered.map(c => (
          <button
            key={c.threadId}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
              selectedThreadId === c.threadId && 'bg-gray-50 dark:bg-white/5',
            )}
          >
            <Avatar name={c.otherUser.displayName} url={c.otherUser.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm truncate', c.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-foreground')}>
                  {c.otherUser.displayName}
                </span>
                <span className="text-[10px] text-portal-secondary shrink-0">{timeAgo(c.lastMessage.sentAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className={cn('text-xs truncate', c.unreadCount > 0 ? 'text-foreground font-medium' : 'text-portal-secondary')}>
                  {c.lastMessage.isMine && <span className="text-portal-secondary">You: </span>}
                  {c.lastMessage.body}
                </p>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 flex items-center justify-center size-4 rounded-full bg-portal-primary text-[9px] font-bold text-white">
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- message thread ---------- */

function MessageThread({
  threadId,
  competitionId,
  recipientId,
  onBack,
  onThreadCreated,
}: {
  threadId: string | null
  competitionId: string
  recipientId?: string | null
  onBack: () => void
  onThreadCreated?: (threadId: string) => void
}) {
  const t = useT()
  const { auth } = usePortalContext()
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [sending, setSending] = React.useState(false)

  // Load thread messages
  const { data, isLoading } = useQuery<ThreadData>({
    queryKey: ['chat-thread', threadId, competitionId],
    queryFn: async () => {
      if (!threadId) return { messages: [], thread: { id: '', otherUser: { id: recipientId ?? '', displayName: '', avatarUrl: null } }, total: 0, hasMore: false }
      const { ok, result } = await apiCall<ThreadData>(`/api/competitions/portal/chat/${threadId}?competition_id=${competitionId}`)
      return ok && result ? result : { messages: [], thread: { id: threadId, otherUser: { id: '', displayName: 'Unknown', avatarUrl: null } }, total: 0, hasMore: false }
    },
    enabled: !!threadId,
    refetchInterval: 5000,
  })

  // Resolve recipient name for new conversations
  const { data: recipientData } = useQuery({
    queryKey: ['chat-recipient', recipientId],
    queryFn: async () => {
      if (!recipientId) return null
      const { ok, result } = await apiCall<{ items: Participant[] }>(
        `/api/competitions/portal/participants?competition_id=${competitionId}&search=`,
      )
      if (ok && result) {
        return result.items.find(p => p.customer_user_id === recipientId) ?? null
      }
      return null
    },
    enabled: !!recipientId && !threadId,
  })

  const otherUser = data?.thread?.otherUser?.displayName
    ? data.thread.otherUser
    : recipientData
      ? { id: recipientData.customer_user_id, displayName: recipientData.display_name, avatarUrl: recipientData.avatar_url }
      : null

  // Mark as read when thread is viewed
  React.useEffect(() => {
    if (!threadId || !competitionId) return
    apiCall(`/api/competitions/portal/chat/${threadId}?competition_id=${competitionId}`, { method: 'PUT' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
    })
  }, [threadId, competitionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages?.length])

  // Real-time updates
  usePortalAppEvent('competitions.chat.message_sent', (event: any) => {
    const payload = event.payload ?? event
    if (payload.threadId === threadId || payload.senderUserId === recipientId) {
      queryClient.invalidateQueries({ queryKey: ['chat-thread', threadId] })
      // Auto-mark as read since we're viewing this thread
      if (threadId) {
        apiCall(`/api/competitions/portal/chat/${threadId}?competition_id=${competitionId}`, { method: 'PUT' })
      }
    }
  }, [threadId, recipientId, competitionId])

  async function handleSend() {
    const body = draft.trim()
    if (!body || !competitionId || (!recipientId && !otherUser?.id)) return
    setSending(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; message: { threadId: string } }>('/api/competitions/portal/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          recipient_id: otherUser?.id ?? recipientId,
          body,
          thread_id: threadId || undefined,
        }),
      })
      if (ok && result) {
        setDraft('')
        if (result.message.threadId && result.message.threadId !== threadId) {
          onThreadCreated?.(result.message.threadId)
        }
        queryClient.invalidateQueries({ queryKey: ['chat-thread'] })
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      }
    } finally {
      setSending(false)
    }
  }

  const messages = data?.messages ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-white/10">
        <button type="button" onClick={onBack} className="sm:hidden flex items-center justify-center size-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
          <ArrowLeft className="size-4" />
        </button>
        {otherUser && (
          <>
            <Avatar name={otherUser.displayName} url={otherUser.avatarUrl} size="sm" />
            <span className="font-semibold text-sm text-foreground">{otherUser.displayName}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && <div className="text-center text-sm text-portal-secondary py-8">{t('common.loading', 'Loading...')}</div>}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-sm text-portal-secondary py-12">
            {t('competitions.portal.chat.noMessages', 'No messages yet. Say hello!')}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={cn('flex', m.isMine ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
              m.isMine
                ? 'bg-portal-primary text-white rounded-br-md'
                : 'bg-gray-100 dark:bg-white/10 text-foreground rounded-bl-md',
            )}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn('text-[10px] mt-1', m.isMine ? 'text-white/60' : 'text-portal-secondary')}>
                {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 dark:border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={(el) => {
              if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px' }
            }}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              if (e.key === 'Escape') setDraft('')
            }}
            placeholder={t('competitions.portal.chat.messagePlaceholder', 'Type a message...')}
            className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary overflow-hidden"
            style={{ resize: 'none', minHeight: '40px' }}
            rows={1}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            size="sm"
            className="shrink-0 mb-0.5"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-portal-secondary mt-1">
          {t('competitions.portal.chat.sendShortcut', 'Enter to send, Shift+Enter for new line')}
        </p>
      </div>
    </div>
  )
}

/* ---------- new chat: participant picker ---------- */

function ParticipantPicker({
  competitionId,
  onSelect,
  onBack,
}: {
  competitionId: string
  onSelect: (userId: string) => void
  onBack: () => void
}) {
  const t = useT()
  const { auth } = usePortalContext()
  const [search, setSearch] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['chat-participants', competitionId, search],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Participant[] }>(
        `/api/competitions/portal/participants?competition_id=${competitionId}&search=${encodeURIComponent(search)}`,
      )
      return ok ? (result?.items ?? []).filter(p => p.customer_user_id !== auth.user?.id) : []
    },
    enabled: !!competitionId,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={onBack} className="flex items-center justify-center size-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
            <ArrowLeft className="size-4" />
          </button>
          <h2 className="font-semibold text-sm">{t('competitions.portal.chat.pickParticipant', 'Choose a participant')}</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={t('competitions.portal.chat.searchParticipants', 'Search participants...')}
            className="pl-8 h-8 text-xs"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-portal-secondary">{t('common.loading', 'Loading...')}</div>}
        {(data ?? []).map(p => (
          <button
            key={p.customer_user_id}
            type="button"
            onClick={() => onSelect(p.customer_user_id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Avatar name={p.display_name} url={p.avatar_url} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
              <p className="text-xs text-portal-secondary capitalize">{p.role}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- main page ---------- */

function ChatContent() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { auth } = usePortalContext()
  const { selectedId: competitionId } = useCompetitionContext()

  const [selectedThread, setSelectedThread] = React.useState<string | null>(searchParams.get('thread'))
  const [selectedRecipient, setSelectedRecipient] = React.useState<string | null>(searchParams.get('recipient'))
  const [showPicker, setShowPicker] = React.useState(false)
  const [mobileView, setMobileView] = React.useState<'list' | 'thread'>(
    searchParams.get('thread') || searchParams.get('recipient') ? 'thread' : 'list',
  )

  // Load conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['chat-conversations', competitionId],
    queryFn: async () => {
      if (!competitionId) return []
      const { ok, result } = await apiCall<{ items: Conversation[] }>(`/api/competitions/portal/chat?competition_id=${competitionId}`)
      return ok ? result?.items ?? [] : []
    },
    enabled: !!competitionId,
    refetchInterval: 10000,
  })

  // Real-time: refresh conversations on new messages
  usePortalAppEvent('competitions.chat.message_sent', (event: any) => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
  }, [])

  usePortalAppEvent('competitions.chat.message_read', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
  }, [])

  // Handle recipient param (from participant card)
  React.useEffect(() => {
    const recipientParam = searchParams.get('recipient')
    if (recipientParam && competitionId) {
      setSelectedRecipient(recipientParam)
      setMobileView('thread')
      // Find existing thread
      apiCall<{ threadId: string | null }>(
        `/api/competitions/portal/chat/find-thread?competition_id=${competitionId}&user_id=${recipientParam}`,
      ).then(({ ok, result }) => {
        if (ok && result?.threadId) {
          setSelectedThread(result.threadId)
        }
      })
    }
  }, [searchParams, competitionId])

  function handleSelectConversation(c: Conversation) {
    setSelectedThread(c.threadId)
    setSelectedRecipient(c.otherUser.id)
    setShowPicker(false)
    setMobileView('thread')
  }

  function handlePickParticipant(userId: string) {
    setSelectedRecipient(userId)
    setSelectedThread(null)
    setShowPicker(false)
    setMobileView('thread')
    // Check for existing thread
    if (competitionId) {
      apiCall<{ threadId: string | null }>(
        `/api/competitions/portal/chat/find-thread?competition_id=${competitionId}&user_id=${userId}`,
      ).then(({ ok, result }) => {
        if (ok && result?.threadId) setSelectedThread(result.threadId)
      })
    }
  }

  function handleBack() {
    setMobileView('list')
    setSelectedThread(null)
    setSelectedRecipient(null)
    // Clear URL params
    router.replace(window.location.pathname)
  }

  if (!competitionId) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center text-sm text-portal-secondary">
        {t('competitions.portal.chat.selectCompetition', 'Select a competition to start chatting.')}
      </div>
    )
  }

  const hasThread = selectedThread || selectedRecipient

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
      <div className="flex h-full">
        {/* Left: Conversations list (hidden on mobile when thread is open) */}
        <div className={cn(
          'w-full sm:w-80 sm:border-r border-gray-100 dark:border-white/10 shrink-0',
          mobileView === 'thread' && 'hidden sm:flex sm:flex-col',
          mobileView === 'list' && 'flex flex-col',
        )}>
          {showPicker ? (
            <ParticipantPicker
              competitionId={competitionId}
              onSelect={handlePickParticipant}
              onBack={() => setShowPicker(false)}
            />
          ) : (
            <ConversationList
              conversations={conversations ?? []}
              selectedThreadId={selectedThread}
              onSelect={handleSelectConversation}
              onNewChat={() => setShowPicker(true)}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Right: Thread view */}
        <div className={cn(
          'flex-1 min-w-0',
          mobileView === 'list' && 'hidden sm:flex sm:flex-col',
          mobileView === 'thread' && 'flex flex-col',
        )}>
          {hasThread ? (
            <MessageThread
              threadId={selectedThread}
              competitionId={competitionId}
              recipientId={selectedRecipient}
              onBack={handleBack}
              onThreadCreated={(newThreadId) => setSelectedThread(newThreadId)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageCircle className="size-12 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-portal-secondary">{t('competitions.portal.chat.selectConversation', 'Select a conversation or start a new one')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('competitions.portal.chat.label', 'Community')}
        title={t('competitions.portal.chat.title', 'Chat')}
      />
      <ChatContent />
    </PortalCompetitionLayout>
  )
}
