import React from 'react'
import { Resend } from 'resend'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import { InvitationEmail } from '../emails/InvitationEmail'

type SendInvitationEmailOptions = {
  to: string
  competitionName: string
  displayName: string
  role: string
  acceptUrl: string
}

const roleLabels: Record<string, string> = {
  participant: 'uczestnik',
  mentor: 'mentor',
  judge: 'juror',
}

function resolveFromAddress() {
  return process.env.NOTIFICATIONS_EMAIL_FROM || process.env.EMAIL_FROM || 'no-reply@localhost'
}

function resolveReplyToAddress() {
  return process.env.NOTIFICATIONS_EMAIL_REPLY_TO || process.env.ADMIN_EMAIL || resolveFromAddress()
}

function buildPlainTextInvitation({ competitionName, displayName, role, acceptUrl }: Omit<SendInvitationEmailOptions, 'to'>) {
  const roleLabel = roleLabels[role] ?? role

  return [
    `Czesc ${displayName},`,
    '',
    `Otrzymujesz to zaproszenie, poniewaz zostales/zostalas dodany/a do wydarzenia "${competitionName}" jako ${roleLabel}.`,
    'Aby dolaczyc do platformy i aktywowac dostep, otworz ponizszy link:',
    acceptUrl,
    '',
    'Po otwarciu linku ustawisz haslo i potwierdzisz swoj dostep do portalu wydarzenia.',
    'Zaproszenie jest wazne przez 72 godziny.',
    '',
    'Jesli nie oczekiwales tej wiadomosci, po prostu ja zignoruj.',
    `Jesli nie chcesz otrzymywac dalszych wiadomosci dotyczacych tego zaproszenia, napisz na: ${resolveReplyToAddress()}.`,
  ].join('\n')
}

export function getInvitationEmailSubject(competitionName: string) {
  return `Zaproszenie do wydarzenia ${competitionName}`
}

export async function sendInvitationEmail({ to, competitionName, displayName, role, acceptUrl }: SendInvitationEmailOptions) {
  const emailDisabled =
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  if (emailDisabled) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const resend = new Resend(apiKey)
  const from = resolveFromAddress()
  const replyTo = resolveReplyToAddress()
  const unsubscribeMailto = `mailto:${replyTo}?subject=${encodeURIComponent(`Rezygnacja z zaproszen do ${competitionName}`)}`

  const result = await resend.emails.send({
    to,
    from,
    replyTo,
    subject: getInvitationEmailSubject(competitionName),
    react: InvitationEmail({
      competitionName,
      displayName,
      role,
      acceptUrl,
      replyToEmail: replyTo,
    }) as React.ReactElement,
    text: buildPlainTextInvitation({ competitionName, displayName, role, acceptUrl }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeMailto}>`,
    },
  })

  const sendResult = result as { error?: string | { message?: string } | null }
  const errorMessage =
    typeof sendResult.error === 'string'
      ? sendResult.error
      : typeof sendResult.error?.message === 'string'
        ? sendResult.error.message
        : null

  if (errorMessage) {
    throw new Error(`RESEND_SEND_FAILED: ${errorMessage}`)
  }
}
