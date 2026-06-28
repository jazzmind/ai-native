/**
 * Unified Chat API Route
 *
 * Works on both Vercel (Anthropic direct) and Busibox (agent-api) via
 * the platform abstraction layer. The streaming SSE output format is
 * identical on both platforms so the frontend Chat UI works unchanged.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initPlatform, getPlatformInstance } from '@/lib/platform';
import type { StreamEvent } from '@jazzmind/busibox-app/platform/interfaces';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  conversationId?: string | null;
  advisorKey?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  await initPlatform();
  const platform = getPlatformInstance();

  // Authenticate
  const user = await platform.auth.getCurrentUser(request as unknown as Request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = await request.json() as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages, advisorKey, model } = body;

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  // Get system prompt for the advisor
  const systemPrompt = advisorKey ? await getAdvisorSystemPrompt(advisorKey) : undefined;

  // Stream the chat response
  let stream: ReadableStream<StreamEvent>;
  try {
    stream = await platform.ai.streamChat({
      messages,
      agent: advisorKey,
      model,
      systemPrompt,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // Transform StreamEvent → SSE text/event-stream
  const encoder = new TextEncoder();
  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          switch (value.type) {
            case 'text-delta':
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', text: value.content ?? '' })}\n\n`),
              );
              break;
            case 'error':
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', error: value.error })}\n\n`),
              );
              break;
            case 'done':
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'done', usage: value.usage })}\n\n`),
              );
              break;
            default:
              // tool-call / tool-result: pass through as-is
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(value)}\n\n`),
              );
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function getAdvisorSystemPrompt(advisorKey: string): Promise<string | undefined> {
  // Load advisor instructions — works on both platforms since advisors/ is in the repo
  try {
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const paths = [
      join(process.cwd(), '../../advisors', advisorKey, 'INSTRUCTIONS.md'),
      join(process.cwd(), '../advisors', advisorKey, 'INSTRUCTIONS.md'),
    ];

    for (const p of paths) {
      if (existsSync(p)) return readFileSync(p, 'utf-8');
    }
  } catch {
    // Not critical — fall back to no system prompt
  }
  return undefined;
}
