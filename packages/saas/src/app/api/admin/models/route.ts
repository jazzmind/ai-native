import { handleAuthError, getRequiredUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

// Simple in-process cache so we don't hammer the API on every keystroke
let cachedModels: { id: string; displayName: string; created: number }[] | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  try {
    await getRequiredUser();

    if (cachedModels && Date.now() < cacheExpiresAt) {
      return Response.json({ models: cachedModels });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return well-known defaults when no key is available
      return Response.json({ models: FALLBACK_MODELS });
    }

    const client = new Anthropic({ apiKey });

    // Paginate through all models
    const allModels: { id: string; displayName: string; created: number }[] = [];
    let afterId: string | undefined;

    while (true) {
      const page = await client.models.list({ limit: 100, ...(afterId ? { after_id: afterId } : {}) });
      for (const m of page.data) {
        allModels.push({
          id: m.id,
          displayName: (m as any).display_name || m.id,
          created: (m as any).created_at
            ? new Date((m as any).created_at).getTime()
            : 0,
        });
      }
      if (!page.has_more) break;
      afterId = page.data[page.data.length - 1]?.id;
    }

    // Sort newest first
    allModels.sort((a, b) => b.created - a.created);

    cachedModels = allModels.length > 0 ? allModels : FALLBACK_MODELS;
    cacheExpiresAt = Date.now() + 5 * 60 * 1000; // 5 min cache

    return Response.json({ models: cachedModels });
  } catch (err) {
    return handleAuthError(err);
  }
}

const FALLBACK_MODELS = [
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", created: 0 },
  { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5", created: 0 },
  { id: "claude-opus-4-5", displayName: "Claude Opus 4.5", created: 0 },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5 (fast)", created: 0 },
];
