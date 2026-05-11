import { v4 as uuidv4 } from "uuid";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getApiKey } from "@/lib/db/queries/api-keys";
import { CMAAdapter } from "@/lib/deploy/cma-adapter";
import { listTargets, upsertTarget } from "@/lib/config-store";

export async function POST() {
  let user, org;
  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  // Resolve API key
  const keyInfo = await getApiKey(org.id, user.id);
  const apiKey = keyInfo.decrypted || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "No API key found. Add your Anthropic API key first." }, { status: 400 });
  }

  const adapter = new CMAAdapter();
  const discovered = await adapter.discover(apiKey, org.id);

  if (discovered.matchedCount === 0) {
    return Response.json({ found: 0, agents: [], targetId: null });
  }

  // Find or create the CMA deploy target for this user
  const existing = await listTargets(user.id);
  const cmaTarget = existing.find((t) => t.type === "cma");

  const agentState = {
    agents: discovered.agents,
    ...(discovered.environmentId ? { environment_id: discovered.environmentId } : {}),
  };

  const targetId = cmaTarget?.id ?? uuidv4();
  await upsertTarget({
    id: targetId,
    orgId: org.id,
    userId: user.id,
    type: "cma",
    name: cmaTarget?.name ?? "Claude Managed Agents",
    config: cmaTarget?.config ?? {},
    status: "deployed",
    lastDeployedAt: new Date().toISOString(),
    agentState,
    createdAt: cmaTarget?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return Response.json({
    found: discovered.matchedCount,
    agents: Object.entries(discovered.agents).map(([key, a]) => ({
      key,
      id: a.id,
      name: a.name,
      version: a.version,
    })),
    targetId,
  });
}
