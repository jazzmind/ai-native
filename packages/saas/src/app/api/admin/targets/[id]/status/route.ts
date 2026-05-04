import { NextRequest } from "next/server";
import { getTarget } from "@/lib/config-store";
import { getAdapter } from "@/lib/deploy";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const target = getTarget(id, user.id);
  if (!target) return Response.json({ error: "Target not found" }, { status: 404 });

  const adapter = getAdapter(target.type);
  if (!adapter) return Response.json({ error: `Unknown adapter type: ${target.type}` }, { status: 400 });

  try {
    const status = await adapter.status(target.config, target.agentState);
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ connected: false, agents: [], error: e.message });
  }
}
