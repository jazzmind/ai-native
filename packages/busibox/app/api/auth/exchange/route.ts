import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/exchange
 *
 * Exchange an SSO token from portal for a session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/';

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: basePath,
      maxAge: 60 * 60 * 6,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Token exchange error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
