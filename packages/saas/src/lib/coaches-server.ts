import fs from "fs";
import path from "path";
import { COACH_META, type CoachConfig, type CoachIconName, type CoachMeta } from "./coaches";
import { listTargets } from "./config-store";

interface DeployStateEntry {
  id: string;
  version: number;
  name: string;
}

interface DeployState {
  agents: Record<string, DeployStateEntry>;
  environment_id: string;
}

/**
 * Loads the deploy state for a specific user.
 * Scoped to userId so one tenant's deployment cannot bleed into another's session.
 */
async function loadDeployState(userId: string): Promise<DeployState | null> {
  // Try .deploy-state.json first (CLI deployment via deploy.py).
  const statePath = path.resolve(process.cwd(), "..", ".deploy-state.json");
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as DeployState;
  } catch {
    // Fall through to database
  }

  // Read from Neon — scoped to the current user to prevent cross-tenant agent bleed.
  try {
    const targets = await listTargets(userId);
    const deployedCandidates = targets
      .filter((t) => t.status === "deployed" && t.agentState?.agents && Object.keys(t.agentState.agents).length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const deployed = deployedCandidates[0];
    if (deployed) {
      return {
        agents: deployed.agentState.agents || {},
        environment_id: deployed.agentState.environment_id || "",
      };
    }
  } catch {
    // ignore DB errors during startup
  }

  return null;
}

export function resetDeployState(): void {
  // No-op — state is always read fresh from Neon on each call.
}

export async function getAgentId(key: string, userId: string): Promise<string> {
  const state = await loadDeployState(userId);
  if (!state) return "";
  const entry = state.agents[key];
  if (!entry) return "";
  return entry.id;
}

export async function getEnvironmentId(userId: string): Promise<string> {
  return (await loadDeployState(userId))?.environment_id ?? "";
}

export async function getCoachConfig(meta: CoachMeta, userId: string): Promise<CoachConfig> {
  return {
    ...meta,
    agentId: await getAgentId(meta.key, userId),
  };
}

export async function getCoachByKey(key: string, userId: string): Promise<CoachConfig | undefined> {
  const meta = COACH_META.find((c) => c.key === key);
  if (!meta) return undefined;
  return getCoachConfig(meta, userId);
}

export async function getAllCoaches(userId: string): Promise<CoachConfig[]> {
  return Promise.all(COACH_META.map((m) => getCoachConfig(m, userId)));
}

export async function getQAJudgeConfig(userId: string): Promise<CoachConfig> {
  return {
    key: "qa-judge",
    name: "QA Judge",
    agentId: await getAgentId("qa-judge", userId),
    description: "Research quality evaluator",
    icon: "Target" as CoachIconName,
    keywords: [],
  };
}
