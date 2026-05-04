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

function loadDeployState(): DeployState | null {
  // Try .deploy-state.json first (CLI deployment via deploy.py).
  // This file only changes on deploy.py runs so a hit here is always fresh.
  const statePath = path.resolve(process.cwd(), "..", ".deploy-state.json");
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as DeployState;
  } catch {
    // Fall through to database
  }

  // Always read from DB — no module-level cache so post-deploy state is
  // always visible without requiring a process restart or resetDeployState().
  try {
    const targets = listTargets();
    // Use the NEWEST deployed target (sort descending by updatedAt) so that
    // re-deployments from the UI take precedence over stale older targets.
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
  // No-op — state is now always read fresh from DB on each call.
}

export function getAgentId(key: string): string {
  const state = loadDeployState();
  if (!state) return "";
  const entry = state.agents[key];
  if (!entry) return "";
  return entry.id;
}

export function getEnvironmentId(): string {
  return loadDeployState()?.environment_id ?? "";
}

export function getCoachConfig(meta: CoachMeta): CoachConfig {
  return {
    ...meta,
    agentId: getAgentId(meta.key),
  };
}

export function getCoachByKey(key: string): CoachConfig | undefined {
  const meta = COACH_META.find((c) => c.key === key);
  if (!meta) return undefined;
  return getCoachConfig(meta);
}

export function getAllCoaches(): CoachConfig[] {
  return COACH_META.map((m) => getCoachConfig(m));
}

export function getQAJudgeConfig(): CoachConfig {
  return {
    key: "qa-judge",
    name: "QA Judge",
    agentId: getAgentId("qa-judge"),
    description: "Research quality evaluator",
    icon: "Target" as CoachIconName,
    keywords: [],
  };
}
