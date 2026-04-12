import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError, AuthError } from "@/lib/auth";
import { storeApiKey, getApiKeyInfo, deleteApiKey } from "@/lib/db/queries/api-keys";

export async function GET() {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const info = await getApiKeyInfo(org.id, user.id);
    return Response.json(info);
  } catch (err) {
    if (err instanceof AuthError) return handleAuthError(err);
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
    return Response.json({ ok: true, hint: result.hint });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE() {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    await deleteApiKey(org.id, user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
