import { NextRequest } from "next/server";
import { getTarget, updateTargetStatus } from "@/lib/config-store";
import { getAdapter } from "@/lib/deploy";
import { loadCoachDefinitions } from "@/lib/deploy/coach-loader";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { resetDeployState } from "@/lib/coaches-server";
import { getApiKey } from "@/lib/db/queries/api-keys";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user, org;
  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const target = await getTarget(id, user.id);
  if (!target) return Response.json({ error: "Target not found" }, { status: 404 });

  const adapter = getAdapter(target.type);
  if (!adapter) return Response.json({ error: `Unknown adapter type: ${target.type}` }, { status: 400 });

  await updateTargetStatus(id, "deploying");

  try {
    const coaches = loadCoachDefinitions();
    if (coaches.length === 0) {
      await updateTargetStatus(id, "error");
      return Response.json({ ok: false, error: "No coach definitions found. Check that INSTRUCTIONS.md files exist." }, { status: 500 });
    }

    console.log(`[deploy] Loaded ${coaches.length} coach definitions: ${coaches.map(c => c.key).join(", ")}`);

    // Resolve API key: target.config.apiKey → DB key → env key
    let apiKey = target.config.apiKey;
    if (!apiKey) {
      const keyInfo = await getApiKey(org.id, user.id);
      if (keyInfo.hasKey && keyInfo.decrypted) {
        apiKey = keyInfo.decrypted;
      } else if (process.env.ANTHROPIC_API_KEY) {
        apiKey = process.env.ANTHROPIC_API_KEY;
      }
    }

    const configWithState = { ...target.config, apiKey, _agentState: target.agentState };
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
      await updateTargetStatus(id, "deployed", agentState);
      resetDeployState();
      return Response.json({ ok: true, result });
    } else {
      await updateTargetStatus(id, "error", agentState);
      resetDeployState();
      return Response.json({ ok: false, error: result.error, result }, { status: 500 });
    }
  } catch (e: any) {
    await updateTargetStatus(id, "error");
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
