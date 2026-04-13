import { NextRequest } from 'next/server';
import { verifyCode, generateVerificationToken } from '@/lib/verification-codes';
import { trackEvent, Events } from '@/lib/usage-tracking';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return Response.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const result = verifyCode(email, code);

    if (!result.valid) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const token = generateVerificationToken(email);
    trackEvent('pending', email.toLowerCase().trim(), Events.SIGNUP_EMAIL_VERIFIED, {});

    return Response.json({ verified: true, token });
  } catch (err) {
    console.error('verify-code error:', err);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
