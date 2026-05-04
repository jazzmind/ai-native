import fs from "fs";
import path from "path";
import type { CoachDefinition } from "./adapter";

const COACHES_DIR = path.resolve(process.cwd(), "..");

interface CoachConfig {
  key: string;
  name: string;
  dir: string;
  model: string;
  description: string;
  callable?: string[];
  mcp?: string[];
  skills?: { type: string; skill_id: string }[];
}

const COACH_CONFIGS: CoachConfig[] = [
  { key: "qa-judge", name: "QA Judge", dir: "qa-judge", model: "claude-sonnet-4-6", description: "Critical evaluator of AI research quality." },
  { key: "ea", name: "Chief of Staff", dir: "ea", model: "claude-sonnet-4-6", description: "Executive assistant, task management, advisor orchestration.", callable: ["founder", "strategy", "technology", "funding", "finance", "legal", "growth"], mcp: ["notion", "slack"] },
  { key: "technology", name: "Technology Coach", dir: "technology", model: "claude-sonnet-4-6", description: "Senior technology advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "founder", name: "Founder Coach", dir: "founder", model: "claude-sonnet-4-6", description: "Founder goals and vision advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "strategy", name: "Strategy Coach", dir: "strategy", model: "claude-sonnet-4-6", description: "Business strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "funding", name: "Funding Coach", dir: "funding", model: "claude-sonnet-4-6", description: "Capital strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"], skills: [{ type: "anthropic", skill_id: "xlsx" }] },
  { key: "finance", name: "Finance Coach", dir: "finance", model: "claude-sonnet-4-6", description: "Financial operations advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"], skills: [{ type: "anthropic", skill_id: "xlsx" }] },
  { key: "legal", name: "Legal Coach", dir: "legal", model: "claude-sonnet-4-6", description: "Legal strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "growth", name: "Growth Coach", dir: "growth", model: "claude-sonnet-4-6", description: "Growth strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "mk", name: "MK Coach", dir: "mk", model: "claude-sonnet-4-6", description: "Personal knowledge practices: readiness, enoughness, ignorance, wisdom, stewardship." },
];

export function loadCoachDefinitions(): CoachDefinition[] {
  const definitions: CoachDefinition[] = [];

  for (const config of COACH_CONFIGS) {
    const instructionsPath = path.join(COACHES_DIR, config.dir, "INSTRUCTIONS.md");
    let instructions = "";
    try {
      instructions = fs.readFileSync(instructionsPath, "utf-8");
    } catch {
      continue;
    }

    definitions.push({
      key: config.key,
      name: config.name,
      dir: config.dir,
      model: config.model,
      description: config.description,
      instructions,
      callable: config.callable,
      mcp: config.mcp,
      skills: config.skills,
    });
  }

  return definitions;
}
