import { NextRequest } from "next/server";
import { getTarget, updateTargetStatus, upsertTarget } from "@/lib/config-store";
import { getAdapter } from "@/lib/deploy";
import { loadCoachDefinitions } from "@/lib/deploy/coach-loader";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const target = getTarget(id);
  if (!target) return Response.json({ error: "Target not found" }, { status: 404 });

  const adapter = getAdapter(target.type);
  if (!adapter) return Response.json({ error: `Unknown adapter type: ${target.type}` }, { status: 400 });

  updateTargetStatus(id, "deploying");

  try {
    const coaches = loadCoachDefinitions();
    const configWithState = { ...target.config, _agentState: target.agentState };
    const result = await adapter.deploy(coaches, configWithState);

    if (result.success) {
      const agentState: Record<string, any> = { agents: {} };
      for (const a of result.agents) {
        if (a.agentId) agentState.agents[a.key] = { id: a.agentId, version: a.version, name: a.name };
      }
      if (result.environmentId) agentState.environment_id = result.environmentId;

      updateTargetStatus(id, "deployed", agentState);
      return Response.json({ ok: true, result });
    } else {
      updateTargetStatus(id, "error");
      return Response.json({ ok: false, error: result.error, result });
    }
  } catch (e: any) {
    updateTargetStatus(id, "error");
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
