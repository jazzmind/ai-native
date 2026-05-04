import { NextRequest } from "next/server";
import { getAdapter } from "@/lib/deploy";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getApiKey } from "@/lib/db/queries/api-keys";

export async function POST(req: NextRequest) {
  let user, org;
  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  const { type, config } = await req.json();

  const adapter = getAdapter(type);
  if (!adapter) return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });

  // Resolve the API key: DB key → env key
  const resolvedConfig = { ...config };
  if (!resolvedConfig.apiKey) {
    const keyInfo = await getApiKey(org.id, user.id);
    if (keyInfo.hasKey && keyInfo.decrypted) {
      resolvedConfig.apiKey = keyInfo.decrypted;
    } else if (process.env.ANTHROPIC_API_KEY) {
      resolvedConfig.apiKey = process.env.ANTHROPIC_API_KEY;
    }
  }

  const result = await adapter.validate(resolvedConfig);
  return Response.json(result);
}
