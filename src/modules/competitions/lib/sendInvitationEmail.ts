import React from 'react'
import { InvitationEmail } from '../emails/InvitationEmail'
import { deliverEmail, resolveReplyToAddress } from './emailDelivery'

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
  await deliverEmail({
    to,
    subject: getInvitationEmailSubject(competitionName),
    react: InvitationEmail({
      competitionName,
      displayName,
      role,
      acceptUrl,
      replyToEmail: resolveReplyToAddress(),
    }) as React.ReactElement,
    text: buildPlainTextInvitation({ competitionName, displayName, role, acceptUrl }),
    unsubscribeSubject: `Rezygnacja z zaproszen do ${competitionName}`,
  })
}
