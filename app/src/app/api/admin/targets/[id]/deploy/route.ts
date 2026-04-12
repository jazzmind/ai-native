import { NextRequest } from "next/server";
import { getTarget, updateTargetStatus } from "@/lib/config-store";
import { getAdapter } from "@/lib/deploy";
import { loadCoachDefinitions } from "@/lib/deploy/coach-loader";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function POST(
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

  updateTargetStatus(id, "deploying");

  try {
    const coaches = loadCoachDefinitions();
    if (coaches.length === 0) {
      updateTargetStatus(id, "error");
      return Response.json({ ok: false, error: "No coach definitions found. Check that INSTRUCTIONS.md files exist." }, { status: 500 });
    }

    console.log(`[deploy] Loaded ${coaches.length} coach definitions: ${coaches.map(c => c.key).join(", ")}`);

    const configWithState = { ...target.config, _agentState: target.agentState };
    const result = await adapter.deploy(coaches, configWithState);

    console.log(`[deploy] Result: success=${result.success}, agents=${result.agents.length}, error=${result.error || "none"}`);
    for (const a of result.agents) {
      console.log(`[deploy]   ${a.key}: agentId=${a.agentId || "NONE"} version=${a.version} name=${a.name}`);
    }

    const agentState: Record<string, any> = { agents: {} };
    for (const a of result.agents) {
      if (a.agentId) {
        agentState.agents[a.key] = { id: a.agentId, version: a.version, name: a.name };
      }
    }
    if (result.environmentId) agentState.environment_id = result.environmentId;

    if (result.success) {
      updateTargetStatus(id, "deployed", agentState);
      return Response.json({ ok: true, result });
    } else {
      updateTargetStatus(id, "error", agentState);
      return Response.json({ ok: false, error: result.error, result }, { status: 500 });
    }
  } catch (e: any) {
    updateTargetStatus(id, "error");
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
