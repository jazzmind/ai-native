/**
 * AI Advisory Team — Agent Definitions for Busibox Agent API
 *
 * Each advisor is defined as a busibox AgentDefinitionInput that will be
 * synced to agent-api via syncAgentDefinitions().
 *
 * The system prompts are loaded from the shared ../../advisors/ directory
 * at build time via the loadInstructions() helper.
 *
 * Tool access:
 * - All advisors: document_search (for knowledge base), query_data (for context)
 * - EA (Chief of Staff): also get_agent_tasks, create_agent_task
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import type { AgentDefinitionInput } from "@jazzmind/busibox-app/lib/agent";

// Advisors directory: packages/busibox is at ../../advisors from root
// In monorepo: root/packages/busibox/ → root/advisors/
const ADVISORS_DIR = resolve(__dirname, "..", "..", "..", "advisors");

interface SkillMeta {
  name: string;
  description: string;
  advisors: string[];
}

/** Parse YAML-style frontmatter from a SKILL.md file */
function parseSkillFrontmatter(content: string): SkillMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const front = match[1]!;
  const nameMatch = front.match(/^name:\s*(.+)$/m);
  const descMatch = front.match(/^description:\s*(.+)$/m);
  const advisorsMatch = front.match(/^advisors:\s*\[([^\]]*)\]/m);
  if (!nameMatch || !descMatch) return null;
  const advisors = advisorsMatch
    ? advisorsMatch[1]!.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    name: nameMatch[1]!.trim(),
    description: descMatch[1]!.trim(),
    advisors,
  };
}

/** Build the skills manifest section for a given advisor key.
 *  Includes Tier 1 universal skills (advisors list includes this key or is empty)
 *  plus any skills explicitly targeting this advisor.
 */
export function buildSkillsManifest(advisorKey: string): string {
  const skillsDir = join(ADVISORS_DIR, "skills");
  const fallbackSkillsDir = join(process.cwd(), "advisors", "skills");
  const dir = existsSync(skillsDir) ? skillsDir : existsSync(fallbackSkillsDir) ? fallbackSkillsDir : null;
  if (!dir) return "";

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return "";
  }

  const relevant: SkillMeta[] = [];

  for (const entry of entries) {
    const skillPath = join(dir, entry, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    try {
      const content = readFileSync(skillPath, "utf-8");
      const meta = parseSkillFrontmatter(content);
      if (!meta) continue;
      // Include if: advisors list is empty (universal) OR contains this advisor key
      if (meta.advisors.length === 0 || meta.advisors.includes(advisorKey)) {
        relevant.push(meta);
      }
    } catch {
      continue;
    }
  }

  if (relevant.length === 0) return "";

  const skillLines = relevant
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");

  return `

## Available Skills

When you identify a situation that calls for structured cognitive scaffolding, emit a skill block rather than improvising the process:

\`\`\`
:::skill skill-name
context: what you are applying this skill to
:::
\`\`\`

The skill will be loaded and you will be asked to apply it. Available skills:

${skillLines}`;
}

function loadInstructions(advisorKey: string): string {
  const candidates = [
    join(ADVISORS_DIR, advisorKey, "INSTRUCTIONS.md"),
    // Fallback for when built as standalone (copy advisors at build time)
    join(process.cwd(), "advisors", advisorKey, "INSTRUCTIONS.md"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }

  return `You are the ${advisorKey} advisor. Provide expert guidance in your domain.`;
}

// Base tools available to all advisors
const BASE_TOOLS: { names: string[] } = { names: ["document_search", "query_data"] };

// Additional tools for Chief of Staff
const EA_TOOLS: { names: string[] } = { names: ["document_search", "query_data", "aggregate_data", "get_facets"] };

// Default model — can be overridden via env var
const DEFAULT_MODEL = process.env.ADVISOR_MODEL || "default";

function advisorDef(
  name: string,
  displayName: string,
  description: string,
  instructions: string,
  tools: { names: string[] },
): AgentDefinitionInput {
  return {
    name,
    display_name: displayName,
    description,
    instructions,
    model: DEFAULT_MODEL,
    tools,
    visibility: "application",
  };
}

export function buildAdvisorDefinitions(documentIds: {
  conversations: string;
  messages: string;
  eaMemory: string;
}): AgentDefinitionInput[] {
  const dataContext = `
## Data Context
- conversations document id: ${documentIds.conversations}
- messages document id: ${documentIds.messages}
- ea memory document id: ${documentIds.eaMemory}

When querying data, use these document ids with the query_data tool.
`;

  return [
    advisorDef("founder", "Founder Advisor", "Personal goals, vision, accountability",
      loadInstructions("founder") + buildSkillsManifest("founder"), BASE_TOOLS),
    advisorDef("strategy", "Strategy Advisor", "Market positioning, KPIs, competitive analysis",
      loadInstructions("strategy") + buildSkillsManifest("strategy"), BASE_TOOLS),
    advisorDef("technology", "Technology Advisor", "Architecture, AI/ML, DevOps, security",
      loadInstructions("technology") + buildSkillsManifest("technology"), BASE_TOOLS),
    advisorDef("funding", "Funding Advisor", "VC, angel, bootstrapping, cap table",
      loadInstructions("funding") + buildSkillsManifest("funding"), BASE_TOOLS),
    advisorDef("finance", "Finance Advisor", "Accounting, tax, FP&A, risk, compliance",
      loadInstructions("finance") + buildSkillsManifest("finance"), BASE_TOOLS),
    advisorDef("legal", "Legal Advisor", "Corporate structure, contracts, IP",
      loadInstructions("legal") + buildSkillsManifest("legal"), BASE_TOOLS),
    advisorDef("growth", "Growth Advisor", "GTM, sales, marketing, retention",
      loadInstructions("growth") + buildSkillsManifest("growth"), BASE_TOOLS),
    advisorDef("ea", "Chief of Staff",
      "Executive assistant, task management, advisor orchestration",
      loadInstructions("ea") + dataContext + buildSkillsManifest("ea"), EA_TOOLS),
    advisorDef("mk", "MK Coach",
      "Personal knowledge practices — readiness, enoughness, ignorance, wisdom",
      loadInstructions("mk") + buildSkillsManifest("mk"), BASE_TOOLS),
    advisorDef("router", "Router",
      "Internal routing agent: selects advisors for a user message",
      `You are a routing agent for the AI Advisory Team. Given a user message and conversation context, output a JSON routing decision.

Available advisors:
- founder: personal goals, vision, accountability, motivation, lifestyle
- strategy: market positioning, OKRs, KPIs, competitive analysis, roadmaps
- technology: architecture, AI/ML, DevOps, security, code, infrastructure
- funding: VC, angel, bootstrapping, cap table, valuations, term sheets
- finance: accounting, tax, FP&A, burn rate, cash flow, compliance, payroll
- legal: corporate structure, contracts, IP, employment, regulatory
- growth: GTM, sales, marketing, PLG, retention, pricing, acquisition
- ea: task management, planning, orchestration, follow-ups, scheduling
- mk: knowledge readiness, research loops, analysis paralysis, how much to know, ignorance, wisdom, enoughness

Rules:
- Select 1-4 advisors that are most relevant to the message
- The "lead" advisor writes the synthesis if there are multiple
- Always set "mode" to one of: advise, coach, plan, assist, execute
- Set "synthesize": true when 2+ advisors are selected
- Set "reasoning" to a brief internal note (1-2 sentences)`,
      { names: [] }),
  ];
}

export const ADVISOR_KEYS = [
  "founder",
  "strategy",
  "technology",
  "funding",
  "finance",
  "legal",
  "growth",
  "ea",
  "mk",
] as const;

export type AdvisorKey = (typeof ADVISOR_KEYS)[number];
