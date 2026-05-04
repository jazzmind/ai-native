import { NextRequest } from 'next/server';
import { getRequiredUserAndOrg, handleAuthError, isAdmin } from '@/lib/auth';
import { resolveAnthropicKey } from '@/lib/api-key-resolver';
import { runSecurityScan } from '@/lib/security-scanner';
import type { ScanProgressEvent } from '@/lib/security-scanner';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let user: { id: string; email: string; name: string };
  let org: { id: string; plan: 'free' | 'pro' | 'team' };

  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  if (!isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(org.id, user.id, org.plan);
  } catch {
    return Response.json({ error: 'No Anthropic API key configured. Add your key in Settings.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const targetUrl = (body.targetUrl as string | undefined)?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  const sessionCookie = body.sessionCookie as string | undefined;
  const skipLlmAgent = body.skipLlmAgent === true;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller closed
        }
      };

      try {
        await runSecurityScan({ baseUrl: targetUrl, apiKey, sessionCookie, skipLlmAgent }, send);
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
