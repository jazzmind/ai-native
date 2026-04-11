import fs from "fs";
import path from "path";
import { COACH_META, type CoachConfig, type CoachIconName, type CoachMeta } from "./coaches";

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

function loadDeployState(): DeployState {
  if (_deployState) return _deployState;
  const statePath = path.resolve(process.cwd(), "..", ".deploy-state.json");
  const raw = fs.readFileSync(statePath, "utf-8");
  _deployState = JSON.parse(raw) as DeployState;
  return _deployState;
}

export function getAgentId(key: string): string {
  const state = loadDeployState();
  const entry = state.agents[key];
  if (!entry) throw new Error(`Agent '${key}' not found in deploy state`);
  return entry.id;
}

export function getEnvironmentId(): string {
  return loadDeployState().environment_id;
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

export const QA_JUDGE_CONFIG: CoachConfig = {
  key: "qa-judge",
  name: "QA Judge",
  agentId: getAgentId("qa-judge"),
  description: "Research quality evaluator",
  icon: "Target" as CoachIconName,
  keywords: [],
};
