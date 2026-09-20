import type React from 'react'
import { Resend } from 'resend'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'

export type DeliverEmailOptions = {
  to: string
  subject: string
  react: React.ReactElement
  text: string
  /** Subject line of the List-Unsubscribe mailto. */
  unsubscribeSubject: string
}

export function resolveFromAddress() {
  return process.env.NOTIFICATIONS_EMAIL_FROM || process.env.EMAIL_FROM || 'no-reply@localhost'
}

export function resolveReplyToAddress() {
  return process.env.NOTIFICATIONS_EMAIL_REPLY_TO || process.env.ADMIN_EMAIL || resolveFromAddress()
}

export function isEmailDeliveryDisabled() {
  return (
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  )
}

export async function deliverEmail({ to, subject, react, text, unsubscribeSubject }: DeliverEmailOptions) {
  if (isEmailDeliveryDisabled()) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const resend = new Resend(apiKey)
  const replyTo = resolveReplyToAddress()
  const unsubscribeMailto = `mailto:${replyTo}?subject=${encodeURIComponent(unsubscribeSubject)}`

  const result = await resend.emails.send({
    to,
    from: resolveFromAddress(),
    replyTo,
    subject,
    react,
    text,
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
