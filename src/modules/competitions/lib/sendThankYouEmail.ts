import React from 'react'
import { ThankYouEmail } from '../emails/ThankYouEmail'
import { deliverEmail, resolveReplyToAddress } from './emailDelivery'

type SendThankYouEmailOptions = {
  to: string
  competitionName: string
  displayName: string
  photosUrl: string
}

function buildPlainTextThankYou({ competitionName, displayName, photosUrl }: Omit<SendThankYouEmailOptions, 'to'>) {
  return [
    `Czesc ${displayName},`,
    '',
    `${competitionName} za nami. Dziekujemy za Twoja obecnosc, energie i zaangazowanie - to dzieki ludziom, ktorzy sie pojawili, cale wydarzenie przebieglo tak swietnie.`,
    '',
    'Gratulujemy zwyciezcom! Wielkie brawa naleza sie tez wszystkim zespolom, ktore doprowadzily swoje projekty do prezentacji.',
    '',
    'Zdjecia i filmy z wydarzenia, w tym z prezentacji projektow, znajdziesz tutaj:',
    photosUrl,
    '',
    `Poszukaj siebie i swojego zespolu, pobierz ulubione ujecia i smialo wykorzystaj je w mediach spolecznosciowych - pochwal sie udzialem w ${competitionName}. Bedzie nam bardzo milo, jesli nas przy tym oznaczysz.`,
    '',
    'Do zobaczenia na kolejnych wydarzeniach!',
    '',
    `Jesli nie chcesz otrzymywac dalszych wiadomosci, napisz na: ${resolveReplyToAddress()}.`,
  ].join('\n')
}

export function getThankYouEmailSubject(competitionName: string) {
  return `Dziękujemy za udział w ${competitionName}!`
}

export async function sendThankYouEmail({ to, competitionName, displayName, photosUrl }: SendThankYouEmailOptions) {
  await deliverEmail({
    to,
    subject: getThankYouEmailSubject(competitionName),
    react: ThankYouEmail({
      competitionName,
      displayName,
      photosUrl,
      replyToEmail: resolveReplyToAddress(),
    }) as React.ReactElement,
    text: buildPlainTextThankYou({ competitionName, displayName, photosUrl }),
    unsubscribeSubject: `Rezygnacja z wiadomosci od ${competitionName}`,
  })
}
