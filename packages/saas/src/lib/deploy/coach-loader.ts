import fs from "fs";
import path from "path";
import type { CoachDefinition } from "./adapter";

// Default: two levels up from packages/saas → ai-native root, then into advisors/
// Override with COACHES_DIR env var for non-standard deployments (e.g. Vercel).
const COACHES_DIR = process.env.COACHES_DIR || path.resolve(process.cwd(), "../../advisors");

interface CoachConfig {
  key: string;
  name: string;
  dir: string;
  model: string;
  description: string;
  callable?: string[];
  mcp?: string[];
  skills?: { type: string; skill_id: string; version?: string }[];
  multiagent?: { type: "coordinator"; agents: string[] };
}

const COACH_CONFIGS: CoachConfig[] = [
  { key: "qa-judge", name: "QA Judge", dir: "qa-judge", model: "claude-sonnet-4-6", description: "Critical evaluator of AI research quality." },
  {
    key: "ea",
    name: "Chief of Staff",
    dir: "ea",
    model: "claude-sonnet-4-6",
    description: "Executive assistant, task management, advisor orchestration.",
    multiagent: { type: "coordinator", agents: ["founder", "strategy", "technology", "funding", "finance", "legal", "growth"] },
    mcp: ["notion", "slack"],
  },
  { key: "technology", name: "Technology Coach", dir: "technology", model: "claude-sonnet-4-6", description: "Senior technology advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "founder", name: "Founder Coach", dir: "founder", model: "claude-sonnet-4-6", description: "Founder goals and vision advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"] },
  { key: "strategy", name: "Strategy Coach", dir: "strategy", model: "claude-sonnet-4-6", description: "Business strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"], skills: [{ type: "anthropic", skill_id: "pptx" }] },
  {
    key: "funding",
    name: "Funding Coach",
    dir: "funding",
    model: "claude-sonnet-4-6",
    description: "Capital strategy advisor.",
    callable: ["qa-judge"],
    mcp: ["notion", "slack"],
    skills: [{ type: "anthropic", skill_id: "xlsx" }, { type: "anthropic", skill_id: "pdf" }],
  },
  {
    key: "finance",
    name: "Finance Coach",
    dir: "finance",
    model: "claude-sonnet-4-6",
    description: "Financial operations advisor.",
    callable: ["qa-judge"],
    mcp: ["notion", "slack"],
    skills: [{ type: "anthropic", skill_id: "xlsx" }, { type: "anthropic", skill_id: "pdf" }],
  },
  { key: "legal", name: "Legal Coach", dir: "legal", model: "claude-sonnet-4-6", description: "Legal strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"], skills: [{ type: "anthropic", skill_id: "docx" }, { type: "anthropic", skill_id: "pdf" }] },
  { key: "growth", name: "Growth Coach", dir: "growth", model: "claude-sonnet-4-6", description: "Growth strategy advisor.", callable: ["qa-judge"], mcp: ["notion", "slack"], skills: [{ type: "anthropic", skill_id: "pptx" }] },
  { key: "mk", name: "MK Coach", dir: "mk", model: "claude-sonnet-4-6", description: "Personal knowledge practices: readiness, enoughness, ignorance, wisdom, stewardship." },
];

function readDefinitionsFromDisk(): Map<string, CoachDefinition> {
  const map = new Map<string, CoachDefinition>();
  for (const config of COACH_CONFIGS) {
    const instructionsPath = path.join(COACHES_DIR, config.dir, "INSTRUCTIONS.md");
    let instructions = "";
    try {
      instructions = fs.readFileSync(instructionsPath, "utf-8");
    } catch {
      continue;
    }
    map.set(config.key, {
      key: config.key,
      name: config.name,
      dir: config.dir,
      model: config.model,
      description: config.description,
      instructions,
      callable: config.callable,
      mcp: config.mcp,
      skills: config.skills ? [...config.skills] : [],
      multiagent: config.multiagent,
    });
  }
  return map;
}

/** Synchronous load — used by existing code paths that don't have DB access. */
export function loadCoachDefinitions(): CoachDefinition[] {
  return Array.from(readDefinitionsFromDisk().values());
}

/** 8-char org hash suffix used to scope agent names to a specific org tenant. */
export function orgHash(orgId: string): string {
  return orgId.replace(/-/g, "").slice(0, 8);
}

/** Returns the org-scoped agent name: e.g. "Strategy Coach [4efdee24]" */
export function orgScopedName(baseName: string, orgId: string): string {
  return `${baseName} [${orgHash(orgId)}]`;
}

/**
 * Async load — merges hardcoded skills with custom skills assigned in the DB for this org.
 * Names are org-scoped so agents from different tenants never collide in CMA.
 * Used by the deploy route so that user-uploaded custom skills are included at deploy time.
 */
export async function loadCoachDefinitionsWithCustomSkills(
  orgId: string,
  userId: string,
): Promise<CoachDefinition[]> {
  const defMap = readDefinitionsFromDisk();

  try {
    const { getAllCustomSkillAssignments } = await import("@/lib/skills-service");
    const assignments = await getAllCustomSkillAssignments(orgId);
    for (const assignment of assignments) {
      const def = defMap.get(assignment.coachKey);
      if (!def) continue;
      if (!def.skills) def.skills = [];
      def.skills.push({
        type: assignment.skillType,
        skill_id: assignment.skillId,
        version: assignment.version ?? "latest",
      });
    }
  } catch {
    // skills-service or DB unavailable — proceed with hardcoded skills only
  }

  // Scope each agent name to this org so agents from different tenants don't collide.
  const hash = orgHash(orgId);
  return Array.from(defMap.values()).map((def) => ({
    ...def,
    name: `${def.name} [${hash}]`,
  }));
}
