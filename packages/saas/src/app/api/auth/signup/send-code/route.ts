import { NextRequest } from 'next/server';
import { generateVerificationCode } from '@/lib/verification-codes';
import { sendEmail } from '@/lib/email';
import { trackEvent, Events } from '@/lib/usage-tracking';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const code = generateVerificationCode(normalizedEmail);

    await sendEmail(
      normalizedEmail,
      `${code} is your AIdvisory verification code`,
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1f2937; background: #f9fafb;">
  <div style="text-align: center;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">AIdvisory</h1>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px;">Your AI Advisory Board</p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">Your verification code is:</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; background: #ffffff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 0 0 24px;">${code}</div>
    <p style="font-size: 13px; color: #9ca3af; margin: 0;">This code expires in 10 minutes.</p>
  </div>
</body>
</html>`,
    );

    trackEvent('pending', normalizedEmail, Events.SIGNUP_STARTED, { email: normalizedEmail });

    return Response.json({ sent: true });
  } catch (err) {
    console.error('send-code error:', err);
    return Response.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
