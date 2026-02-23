import fetch from 'node-fetch';

interface ModerationAlertPayload {
  subject: string;
  lines: string[];
}

/**
 * Sends moderation alerts to a team inbox.
 * Primary path uses Resend API when configured; fallback is structured logs.
 */
export async function sendModerationAlert(payload: ModerationAlertPayload): Promise<void> {
  const to = process.env.MODERATION_ALERT_TO;
  const from = process.env.MODERATION_ALERT_FROM || 'moderation@usechomp.com';
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!to || !resendApiKey) {
    console.warn('[ModerationAlert] Missing MODERATION_ALERT_TO or RESEND_API_KEY; alert logged only.', payload);
    return;
  }

  const text = payload.lines.join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[ModerationAlert] Failed to send email:', response.status, body);
    }
  } catch (error) {
    console.error('[ModerationAlert] Unexpected email error:', error);
  }
}
