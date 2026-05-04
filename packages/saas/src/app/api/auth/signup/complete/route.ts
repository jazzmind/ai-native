import { NextRequest } from 'next/server';
import { validateVerificationToken, generateVerificationToken } from '@/lib/verification-codes';
import { trackEvent, Events } from '@/lib/usage-tracking';
import { storePendingProfile } from '@/lib/pending-profiles';

export async function POST(req: NextRequest) {
  try {
    const { token, firstName, companyName, website, businessDescription, businessStage, apiKey } = await req.json();

    if (!token) {
      return Response.json({ error: 'Verification token is required' }, { status: 400 });
    }

    const verified = validateVerificationToken(token);
    if (!verified) {
      return Response.json({ error: 'Invalid or expired verification. Please start over.' }, { status: 400 });
    }

    if (!firstName?.trim()) {
      return Response.json({ error: 'First name is required' }, { status: 400 });
    }

    storePendingProfile(verified.email, {
      companyName: companyName?.trim() || undefined,
      firstName: firstName.trim(),
    });

    const signInToken = generateVerificationToken(verified.email);

    trackEvent('pending', verified.email, Events.SIGNUP_COMPLETED, {
      hasWebsite: !!website?.trim(),
      hasDescription: !!businessDescription?.trim(),
      businessStage: businessStage || null,
      hasApiKey: !!apiKey?.trim(),
    });

    return Response.json({
      success: true,
      email: verified.email,
      verificationToken: signInToken,
      profile: {
        firstName: firstName.trim(),
        website: website?.trim() || null,
        businessDescription: businessDescription?.trim() || null,
        businessStage: businessStage || null,
        hasApiKey: !!(apiKey?.trim()),
      },
    });
  } catch (err) {
    console.error('signup complete error:', err);
    return Response.json({ error: 'Failed to complete signup' }, { status: 500 });
  }
}
