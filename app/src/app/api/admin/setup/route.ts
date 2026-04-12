import { NextRequest } from "next/server";
import { getAdapter } from "@/lib/deploy";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { type, config } = await req.json();

  const adapter = getAdapter(type);
  if (!adapter) return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });

  const result = await adapter.validate(config);
  return Response.json(result);
}
