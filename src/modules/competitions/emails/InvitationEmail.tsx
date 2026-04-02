import React from 'react'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr, Link } from '@react-email/components'

type InvitationEmailProps = {
  competitionName: string
  displayName: string
  role: string
  acceptUrl: string
  replyToEmail?: string
}

const roleLabels: Record<string, string> = {
  participant: 'Uczestnik',
  mentor: 'Mentor',
  judge: 'Juror',
}

export function InvitationEmail({ competitionName, displayName, role, acceptUrl, replyToEmail }: InvitationEmailProps) {
  const roleLabel = roleLabels[role] ?? role

  return (
    <Html lang="pl">
      <Head />
      <Preview>Zaproszenie do wydarzenia {competitionName} w roli: {roleLabel}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <Heading as="h1" style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Zaproszenie do wydarzenia
            </Heading>

            <Text style={{ margin: '0 0 20px', color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
              Cześć {displayName},
            </Text>

            <Text style={{ margin: '0 0 20px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              Otrzymujesz tę wiadomość, ponieważ zostałeś/aś zaproszony/a do udziału w wydarzeniu{' '}
              <strong style={{ color: '#0f172a' }}>{competitionName}</strong> w roli{' '}
              <strong style={{ color: '#4F46E5' }}>{roleLabel}</strong>.
            </Text>

            <Text style={{ margin: '0 0 24px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              Aby dołączyć, kliknij przycisk poniżej. Link przeniesie Cię do strony, na której ustawisz hasło
              i aktywujesz dostęp do portalu uczestnika.
            </Text>

            <Section style={{ textAlign: 'center', marginBottom: 24 }}>
              <Button
                href={acceptUrl}
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
                Przyjmij zaproszenie
              </Button>
            </Section>

            <Text style={{ margin: '0 0 16px', color: '#334155', fontSize: '14px', lineHeight: '1.7' }}>
              Po aktywacji konta uzyskasz dostęp do ogłoszeń, harmonogramu, materiałów organizacyjnych i dalszych
              informacji związanych z wydarzeniem.
            </Text>

            <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0' }} />

            <Text style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: '12px', lineHeight: '1.5' }}>
              Zaproszenie wygasa za 72 godziny. Jeśli nie spodziewałeś/aś się tej wiadomości, możesz ją bezpiecznie zignorować.
            </Text>

            <Text style={{ margin: '0 0 8px', color: '#64748b', fontSize: '12px', lineHeight: '1.6' }}>
              Jeśli przycisk nie działa, skopiuj i wklej ten link w przeglądarce:
            </Text>

            <Text style={{ margin: '0 0 16px', color: '#475569', fontSize: '12px', lineHeight: '1.6', wordBreak: 'break-all' }}>
              {acceptUrl}
            </Text>

            {replyToEmail && (
              <Text style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                Jeśli chcesz zrezygnować z dalszych wiadomości dotyczących tego zaproszenia, napisz na{' '}
                <Link href={`mailto:${replyToEmail}`} style={{ color: '#64748b' }}>{replyToEmail}</Link>.
              </Text>
            )}
            {!replyToEmail && (
              <Text style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                Ta wiadomość ma charakter organizacyjny i dotyczy wyłącznie aktywacji Twojego zaproszenia.
              </Text>
            )}
            <Text style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
              Tytuł wiadomości: Zaproszenie do wydarzenia {competitionName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
