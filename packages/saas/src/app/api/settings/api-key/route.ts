import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError, AuthError } from "@/lib/auth";
import { storeApiKey, getApiKeyInfo, deleteApiKey } from "@/lib/db/queries/api-keys";
import { trackEvent, Events } from "@/lib/usage-tracking";

export async function GET() {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const info = await getApiKeyInfo(org.id, user.id);
    if (info.hasKey) return Response.json(info);

    // Fall back to env key so the UI shows the correct state
    if (process.env.ANTHROPIC_API_KEY) {
      return Response.json({ hasKey: true, hint: "env", provider: 'anthropic', isEnvKey: true });
    }

    return Response.json(info);
  } catch (err) {
    if (err instanceof AuthError) return handleAuthError(err);
    // Even on auth error, surface env key presence
    if (process.env.ANTHROPIC_API_KEY) {
      return Response.json({ hasKey: true, hint: "env", provider: 'anthropic', isEnvKey: true });
    }
    return Response.json({ hasKey: false, hint: null, provider: 'anthropic' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const body = await req.json();
    const { key, provider = 'anthropic' } = body as { key: string; provider?: string };

    if (!key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }

    if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
      return Response.json(
        { error: "Invalid API key format. Anthropic keys start with 'sk-ant-'" },
        { status: 400 }
      );
    }

    const result = await storeApiKey(org.id, user.id, key, provider);
    trackEvent(org.id, user.id, Events.API_KEY_ADDED, { provider });
    return Response.json({ ok: true, hint: result.hint });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE() {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    await deleteApiKey(org.id, user.id);
    trackEvent(org.id, user.id, Events.API_KEY_REMOVED, {});
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
