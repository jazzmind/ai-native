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

let _deployState: DeployState | null = null;
let _deployStateLoaded = false;

function loadDeployState(): DeployState | null {
  if (_deployStateLoaded) return _deployState;
  _deployStateLoaded = true;

  // Try .deploy-state.json first (CLI deployment via deploy.py)
  const statePath = path.resolve(process.cwd(), "..", ".deploy-state.json");
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    _deployState = JSON.parse(raw) as DeployState;
    return _deployState;
  } catch {
    // Fall through to database
  }

  // Fall back to database: find the first deployed target with agent state
  try {
    const targets = listTargets();
    const deployed = targets.find(
      (t) => t.status === "deployed" && t.agentState?.agents && Object.keys(t.agentState.agents).length > 0
    );
    if (deployed) {
      _deployState = {
        agents: deployed.agentState.agents || {},
        environment_id: deployed.agentState.environment_id || "",
      };
      return _deployState;
    }
  } catch {
    // ignore DB errors during startup
  }

  return null;
}

export function resetDeployState(): void {
  _deployState = null;
  _deployStateLoaded = false;
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
