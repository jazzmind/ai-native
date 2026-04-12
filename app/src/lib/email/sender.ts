import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL || 'advisors@aidvisory.ai';

  try {
    const resend = getResend();
    await resend.emails.send({
      from: `AIdvisory <${from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    console.error('Failed to send email:', err);
    // Non-critical: don't throw, just log
  }
}
