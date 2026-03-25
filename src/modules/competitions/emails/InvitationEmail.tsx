import React from 'react'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr } from '@react-email/components'

type InvitationEmailProps = {
  competitionName: string
  displayName: string
  role: string
  acceptUrl: string
}

const roleLabels: Record<string, string> = {
  participant: 'Participant',
  mentor: 'Mentor',
  judge: 'Judge',
}

export function InvitationEmail({ competitionName, displayName, role, acceptUrl }: InvitationEmailProps) {
  const roleLabel = roleLabels[role] ?? role

  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited to {competitionName} as a {roleLabel}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {/* Header accent */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #4F46E5, #6366F1)', borderRadius: 4, marginBottom: 24 }} />

            <Heading as="h1" style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              You&apos;re Invited!
            </Heading>

            <Text style={{ margin: '0 0 20px', color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
              Hi {displayName},
            </Text>

            <Text style={{ margin: '0 0 20px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              You&apos;ve been invited to join <strong style={{ color: '#0f172a' }}>{competitionName}</strong> as
              a <strong style={{ color: '#4F46E5' }}>{roleLabel}</strong>.
            </Text>

            <Text style={{ margin: '0 0 24px', color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
              Click the button below to set up your account and get started.
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
                Accept Invitation
              </Button>
            </Section>

            <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0' }} />

            <Text style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: '12px', lineHeight: '1.5' }}>
              This invitation expires in 72 hours. If you didn&apos;t expect this email, you can safely ignore it.
            </Text>

            <Text style={{ margin: 0, color: '#cbd5e1', fontSize: '11px' }}>
              If the button doesn&apos;t work, copy and paste this link into your browser:{' '}
              <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{acceptUrl}</span>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
