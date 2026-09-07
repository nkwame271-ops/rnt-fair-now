/**
 * Server-only email send helper for features whose HTML is composed at send
 * time (per-event notification bodies, admin-authored replies, payment
 * receipts). Sends synchronously through Lovable's managed email API —
 * delivery, retries, suppression, rate limits, and the unsubscribe footer are
 * enforced by Lovable.
 *
 * Templates whose content fits fixed props should use
 * ../_shared/transactional-email-templates/send-email.ts instead.
 *
 * Always call with a service-role client so the email_send_log writes pass RLS.
 */
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { FROM_ADDRESS, SENDER_DOMAIN } from './project-domain.ts'

export type ManagedEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: 'recipient_suppressed'; messageId: string }
  | { sent: false; reason: 'failed'; error: string; messageId: string }

async function logSend(
  admin: any,
  row: {
    message_id: string
    template_name: string
    recipient_email: string
    status: 'sent' | 'suppressed' | 'failed'
    error_message?: string
  },
): Promise<void> {
  const { error } = await admin.from('email_send_log').insert(row)
  if (error) {
    console.error('email_send_log insert failed', {
      code: error.code,
      message: error.message,
      status: row.status,
    })
  }
}

export async function sendManagedEmail(
  admin: any,
  params: {
    to: string
    subject: string
    html: string
    text?: string
    label: string
    idempotencyKey?: string
    replyTo?: string
  },
): Promise<ManagedEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const messageId = crypto.randomUUID()

  if (!apiKey) {
    const error = 'LOVABLE_API_KEY is not configured'
    console.error(error)
    await logSend(admin, {
      message_id: messageId,
      template_name: params.label,
      recipient_email: params.to,
      status: 'failed',
      error_message: error,
    })
    return { sent: false, reason: 'failed', error, messageId }
  }

  try {
    await sendLovableEmail(
      {
        to: params.to,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject: params.subject,
        html: params.html,
        text: params.text ?? params.subject,
        purpose: 'transactional',
        label: params.label,
        idempotency_key: params.idempotencyKey || messageId,
        reply_to: params.replyTo,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
    )
  } catch (e) {
    if (e instanceof EmailAPIError && e.code === 'recipient_suppressed') {
      await logSend(admin, {
        message_id: messageId,
        template_name: params.label,
        recipient_email: params.to,
        status: 'suppressed',
        error_message: 'Recipient is suppressed (bounced, complained, or unsubscribed)',
      })
      return { sent: false, reason: 'recipient_suppressed', messageId }
    }

    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('Email send failed', { label: params.label, error: errorMsg })
    await logSend(admin, {
      message_id: messageId,
      template_name: params.label,
      recipient_email: params.to,
      status: 'failed',
      error_message: errorMsg.slice(0, 1000),
    })
    return { sent: false, reason: 'failed', error: errorMsg, messageId }
  }

  await logSend(admin, {
    message_id: messageId,
    template_name: params.label,
    recipient_email: params.to,
    status: 'sent',
  })
  return { sent: true, messageId }
}
