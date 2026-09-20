import React from 'react'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr, Link } from '@react-email/components'

type ThankYouEmailProps = {
  competitionName: string
  displayName: string
  photosUrl: string
  replyToEmail?: string
}

export function ThankYouEmail({ competitionName, displayName, photosUrl, replyToEmail }: ThankYouEmailProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>Dziękujemy za {competitionName} — zdjęcia i filmy z wydarzenia już czekają</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <Heading as="h1" style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Dziękujemy, że byliście z nami!
            </Heading>

            <Text style={{ margin: '0 0 20px', color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
              Cześć {displayName},
            </Text>

            <Text style={{ margin: '0 0 20px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              <strong style={{ color: '#0f172a' }}>{competitionName}</strong> za nami. Dziękujemy za Twoją obecność,
              energię i zaangażowanie — to dzięki ludziom, którzy się pojawili, całe wydarzenie przebiegło tak świetnie.
            </Text>

            <Text style={{ margin: '0 0 20px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              <strong style={{ color: '#4F46E5' }}>Gratulujemy zwycięzcom!</strong> Wielkie brawa należą się też
              wszystkim zespołom, które doprowadziły swoje projekty do prezentacji — poziom był naprawdę wysoki.
            </Text>

            <Text style={{ margin: '0 0 24px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              Zebraliśmy dla Was zdjęcia i filmy z wydarzenia, w tym z prezentacji projektów.
            </Text>

            <Section style={{ textAlign: 'center', marginBottom: 24 }}>
              <Button
                href={photosUrl}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#ffffff',
                  padding: '14px 28px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  display: 'inline-block',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Zobacz zdjęcia i filmy
              </Button>
            </Section>

            <Text style={{ margin: '0 0 16px', color: '#334155', fontSize: '14px', lineHeight: '1.7' }}>
              Poszukaj siebie i swojego zespołu, pobierz ulubione ujęcia i śmiało wykorzystaj je w mediach
              społecznościowych — pochwal się udziałem w {competitionName} na LinkedInie, Instagramie czy gdziekolwiek
              chcesz. Będzie nam bardzo miło, jeśli nas przy tym oznaczysz.
            </Text>

            <Text style={{ margin: '0 0 16px', color: '#334155', fontSize: '14px', lineHeight: '1.7' }}>
              Do zobaczenia na kolejnych wydarzeniach!
            </Text>

            <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0' }} />

            <Text style={{ margin: '0 0 8px', color: '#64748b', fontSize: '12px', lineHeight: '1.6' }}>
              Jeśli przycisk nie działa, skopiuj i wklej ten link w przeglądarce:
            </Text>

            <Text style={{ margin: '0 0 16px', color: '#475569', fontSize: '12px', lineHeight: '1.6', wordBreak: 'break-all' }}>
              {photosUrl}
            </Text>

            {replyToEmail && (
              <Text style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                Otrzymujesz tę wiadomość, ponieważ brałeś/aś udział w wydarzeniu {competitionName}. Jeśli nie chcesz
                otrzymywać dalszych wiadomości, napisz na{' '}
                <Link href={`mailto:${replyToEmail}`} style={{ color: '#64748b' }}>{replyToEmail}</Link>.
              </Text>
            )}
            {!replyToEmail && (
              <Text style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                Otrzymujesz tę wiadomość, ponieważ brałeś/aś udział w wydarzeniu {competitionName}.
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
