import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { listTargets, updateTargetStatus } from "@/lib/config-store";
import { getApiKey } from "@/lib/db/queries/api-keys";

export const runtime = "nodejs";

async function resolveApiKey(orgId: string, userId: string): Promise<string | null> {
  const keyInfo = await getApiKey(orgId, userId);
  if (keyInfo.hasKey && keyInfo.decrypted) return keyInfo.decrypted;
  return process.env.ANTHROPIC_API_KEY || null;
}

function getTrackedAgentIds(userId: string): Set<string> {
  const tracked = new Set<string>();
  const targets = listTargets(userId);
  for (const t of targets) {
    for (const agent of Object.values(t.agentState?.agents || {})) {
      const id = (agent as any).id;
      if (id) tracked.add(id);
    }
  }
  return tracked;
}

/** GET — list all agents from Anthropic, annotated with tracked/orphan status */
export async function GET(_req: NextRequest) {
  let user: { id: string; email: string; name: string };
  let org: { id: string };
  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  const apiKey = await resolveApiKey(org.id, user.id);
  if (!apiKey) return Response.json({ error: "No API key configured" }, { status: 400 });

  const client = new Anthropic({ apiKey });

  try {
    const tracked = getTrackedAgentIds(user.id);

    // Fetch all agents (paginate if needed)
    let allAgents: any[] = [];
    let cursor: string | undefined;

    do {
      const page: any = await (client.beta as any).agents.list({
        limit: 100,
        ...(cursor ? { after_id: cursor } : {}),
      });
      allAgents = allAgents.concat(page.data || []);
      cursor = page.has_more ? page.last_id : undefined;
    } while (cursor);

    const annotated = allAgents
      .filter((a: any) => !a.archived_at) // skip already archived
      .map((a: any) => ({
        id: a.id,
        name: a.name,
        model: a.model,
        version: a.version,
        createdAt: a.created_at,
        tracked: tracked.has(a.id),
      }));

    const orphans = annotated.filter((a) => !a.tracked);
    const active = annotated.filter((a) => a.tracked);

    return Response.json({ agents: annotated, orphans, active });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/** POST — archive specified agents or all orphans */
export async function POST(req: NextRequest) {
  let user: { id: string; email: string; name: string };
  let org: { id: string };
  try {
    ({ user, org } = await getRequiredUserAndOrg());
  } catch (err) {
    return handleAuthError(err);
  }

  const apiKey = await resolveApiKey(org.id, user.id);
  if (!apiKey) return Response.json({ error: "No API key configured" }, { status: 400 });

  const { agentIds, archiveOrphans } = await req.json() as { agentIds?: string[]; archiveOrphans?: boolean };
  const client = new Anthropic({ apiKey });

  let toArchive: string[] = agentIds || [];

  if (archiveOrphans) {
    // Build the list automatically
    const tracked = getTrackedAgentIds(user.id);
    let allAgents: any[] = [];
    let cursor: string | undefined;
    do {
      const page: any = await (client.beta as any).agents.list({ limit: 100, ...(cursor ? { after_id: cursor } : {}) });
      allAgents = allAgents.concat(page.data || []);
      cursor = page.has_more ? page.last_id : undefined;
    } while (cursor);

    toArchive = allAgents
      .filter((a: any) => !a.archived_at && !tracked.has(a.id))
      .map((a: any) => a.id);
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of toArchive) {
    try {
      await (client.beta as any).agents.archive(id);
      results.push({ id, ok: true });
    } catch (err: any) {
      results.push({ id, ok: false, error: err.message });
    }
  }

  // Also clean up any stale targets (targets with status=deployed but empty agentState)
  if (archiveOrphans) {
    const targets = listTargets(user.id);
    for (const t of targets) {
      if (t.status === "deployed") {
        const agentKeys = Object.keys(t.agentState?.agents || {});
        if (agentKeys.length === 0) {
          updateTargetStatus(t.id, "error");
        }
      }
    }
  }

  const archived = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return Response.json({ ok: true, archived, failed, results });
}
