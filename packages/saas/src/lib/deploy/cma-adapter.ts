import Anthropic from "@anthropic-ai/sdk";
import type { DeployAdapter, CoachDefinition, DeployResult, TargetStatus } from "./adapter";

const ENVIRONMENT_NAME = "coach-env";

// Canonical base names → key mapping for all known coaches. Used for discovery.
const COACH_BASE_NAMES: Record<string, string> = {
  "QA Judge": "qa-judge",
  "Chief of Staff": "ea",
  "Technology Coach": "technology",
  "Founder Coach": "founder",
  "Strategy Coach": "strategy",
  "Funding Coach": "funding",
  "Finance Coach": "finance",
  "Legal Coach": "legal",
  "Growth Coach": "growth",
  "MK Coach": "mk",
};

export interface DiscoveredState {
  agents: Record<string, { id: string; version: number; name: string }>;
  environmentId?: string;
  matchedCount: number;
}

function buildDatePreamble(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
  return (
    `Current date: ${dateStr}. Current time: ${timeStr} UTC.\n` +
    "Your training data has a knowledge cutoff. Always use web_search " +
    "when you need current information, recent developments, or to verify " +
    "claims about tools, frameworks, or market conditions.\n\n"
  );
}

export class CMAAdapter implements DeployAdapter {
  readonly type = "cma";

  async discover(apiKey: string, orgId?: string): Promise<DiscoveredState> {
    const client = new Anthropic({ apiKey });
    const agents: DiscoveredState["agents"] = {};

    // Build lookup maps: org-scoped name (preferred) and bare name (migration fallback)
    const scopedNameToKey: Record<string, string> = {};
    const bareNameToKey: Record<string, string> = { ...COACH_BASE_NAMES };
    if (orgId) {
      const { orgHash } = await import("./coach-loader");
      const hash = orgHash(orgId);
      for (const [baseName, key] of Object.entries(COACH_BASE_NAMES)) {
        scopedNameToKey[`${baseName} [${hash}]`] = key;
      }
    }

    try {
      // List all agents, paginating through results
      let after: string | undefined;
      const allAgents: any[] = [];
      while (true) {
        const page: any = await (client.beta as any).agents.list({ limit: 100, ...(after ? { after } : {}) });
        const items: any[] = page.data ?? page.agents ?? [];
        allAgents.push(...items);
        if (!page.has_more || items.length === 0) break;
        after = items[items.length - 1].id;
      }

      for (const agent of allAgents) {
        if (agent.archived_at) continue; // skip archived
        // Prefer org-scoped match; fall back to bare name for migration
        const key = scopedNameToKey[agent.name] ?? bareNameToKey[agent.name];
        if (key && !agents[key]) {
          // If there are multiple matches for a key (e.g. old + new name), prefer scoped
          const isScoped = !!scopedNameToKey[agent.name];
          if (isScoped || !agents[key]) {
            agents[key] = { id: agent.id, version: agent.version, name: agent.name };
          }
        }
      }
    } catch (e: any) {
      console.warn(`[cma-discover] Failed to list agents: ${e.message}`);
    }

    // Find the environment named "coach-env"
    let environmentId: string | undefined;
    try {
      const envPage: any = await (client.beta as any).environments.list({ limit: 100 });
      const envs: any[] = envPage.data ?? envPage.environments ?? [];
      const env = envs.find((e: any) => !e.archived_at && e.name === ENVIRONMENT_NAME);
      if (env) environmentId = env.id;
    } catch {
      // environments listing not critical
    }

    return { agents, environmentId, matchedCount: Object.keys(agents).length };
  }

  async validate(config: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    const apiKey = config.apiKey;
    if (!apiKey) return { valid: false, error: "API key is required" };

    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }

  async deploy(coaches: CoachDefinition[], config: Record<string, any>): Promise<DeployResult> {
    const apiKey = config.apiKey;
    if (!apiKey) return { success: false, agents: [], error: "No API key" };

    const client = new Anthropic({ apiKey });
    const existingState = config._agentState || {};
    const agents: DeployResult["agents"] = [];
    const errors: string[] = [];

    // Also try to load state from .deploy-state.json (created by deploy.py)
    if (!existingState.agents || Object.keys(existingState.agents).length === 0) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const stateFile = path.resolve(process.cwd(), "..", ".deploy-state.json");
        console.log(`[cma-deploy] Looking for deploy state at: ${stateFile}`);
        if (fs.existsSync(stateFile)) {
          const fileState = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
          console.log(`[cma-deploy] Loaded .deploy-state.json with ${Object.keys(fileState.agents || {}).length} agents`);
          if (fileState.agents) existingState.agents = fileState.agents;
          if (fileState.environment_id) existingState.environment_id = fileState.environment_id;
        } else {
          console.log(`[cma-deploy] .deploy-state.json not found`);
        }
      } catch (e: any) {
        console.log(`[cma-deploy] Failed to load .deploy-state.json: ${e.message}`);
      }
    } else {
      console.log(`[cma-deploy] Using existing agent state with ${Object.keys(existingState.agents).length} agents`);
    }

    // Ensure environment exists
    let environmentId = existingState.environment_id;
    if (!environmentId) {
      try {
        const env = await (client.beta as any).environments.create({
          name: ENVIRONMENT_NAME,
          config: { type: "cloud", networking: { type: "unrestricted" } },
        });
        environmentId = env.id;
      } catch (e: any) {
        return { success: false, agents: [], error: `Failed to create environment: ${e.message}` };
      }
    }

    // Coaches with neither callable nor multiagent are "base" and deploy first.
    // Coaches with callable or multiagent depend on others and deploy second.
    const baseCoaches = coaches.filter(c =>
      (!c.callable || c.callable.length === 0) && !c.multiagent
    );
    const dependentCoaches = coaches.filter(c =>
      (c.callable && c.callable.length > 0) || c.multiagent
    );

    console.log(`[cma-deploy] Base coaches: ${baseCoaches.map(c => c.key).join(", ")}`);
    console.log(`[cma-deploy] Dependent coaches: ${dependentCoaches.map(c => c.key).join(", ")}`);
    console.log(`[cma-deploy] Existing state keys: ${Object.keys(existingState.agents || {}).join(", ") || "none"}`);
    console.log(`[cma-deploy] Environment ID: ${environmentId || "none"}`);

    for (const coach of [...baseCoaches, ...dependentCoaches]) {
      try {
        const systemPrompt = buildDatePreamble() + coach.instructions;
        const tools: any[] = [
          { type: "agent_toolset_20260401" },
          {
            name: "ask_user",
            description:
              "Ask the user a clarifying question and wait for their answer before continuing. Use this when you need specific input from the user that you cannot infer — for example, confirming preferences, getting authorization, or collecting a required value. Provide clear, specific questions. Optionally provide a short list of options to make answering easy.",
            input_schema: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "The specific question to ask the user.",
                },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional short list of suggested answer choices (2-4 items). Omit for open-ended questions.",
                },
              },
              required: ["question"],
            },
          },
        ];
        const existing = existingState.agents?.[coach.key];
        console.log(`[cma-deploy] ${coach.key}: existing=${existing ? existing.id + " v" + existing.version : "NEW"}`);

        const skills = (coach.skills || []).filter(s => s.skill_id);

        // Build callable_agents for coaches that use the single-thread callable pattern (e.g. coaches -> qa-judge)
        let callableAgents: any[] | undefined;
        if (!coach.multiagent && coach.callable && coach.callable.length > 0) {
          callableAgents = [];
          for (const depKey of coach.callable) {
            const dep = existingState.agents?.[depKey] || agents.find(a => a.key === depKey);
            if (dep) {
              const depId = dep.agentId || (dep as any).id;
              const depVersion = dep.version;
              if (depId && depVersion) {
                callableAgents.push({ type: "agent", id: depId, version: depVersion });
              }
            }
          }
        }

        // Build multiagent coordinator config for the EA
        let multiagentConfig: any | undefined;
        if (coach.multiagent?.type === "coordinator" && coach.multiagent.agents.length > 0) {
          const rosterAgents: any[] = [];
          for (const agentKey of coach.multiagent.agents) {
            const dep = existingState.agents?.[agentKey] || agents.find(a => a.key === agentKey);
            if (dep) {
              const depId = dep.agentId || (dep as any).id;
              if (depId) {
                rosterAgents.push({ type: "agent", id: depId });
              }
            }
          }
          if (rosterAgents.length > 0) {
            multiagentConfig = { type: "coordinator", agents: rosterAgents };
          }
        }

        let agent: any;
        if (existing) {
          const updateParams: any = {
            version: existing.version,
            name: coach.name, // renames bare-name agents to org-scoped on update
            system: systemPrompt,
            description: coach.description,
            tools,
            skills: skills.length > 0 ? skills : undefined,
          };
          if (callableAgents && callableAgents.length > 0) {
            updateParams.callable_agents = callableAgents;
          }
          if (multiagentConfig) {
            updateParams.multiagent = multiagentConfig;
          }
          agent = await (client.beta as any).agents.update(existing.id, updateParams);
        } else {
          const createParams: any = {
            name: coach.name,
            model: coach.model || "claude-sonnet-4-6",
            system: systemPrompt,
            description: coach.description,
            tools,
            skills: skills.length > 0 ? skills : undefined,
          };
          if (callableAgents && callableAgents.length > 0) {
            createParams.callable_agents = callableAgents;
          }
          if (multiagentConfig) {
            createParams.multiagent = multiagentConfig;
          }
          agent = await (client.beta as any).agents.create(createParams);
        }

        agents.push({
          key: coach.key,
          agentId: agent.id,
          version: agent.version,
          name: coach.name,
        });

        if (!existingState.agents) existingState.agents = {};
        existingState.agents[coach.key] = { id: agent.id, version: agent.version, name: coach.name };
      } catch (e: any) {
        const errMsg = `${coach.name}: ${e.message}`;
        console.error(`[cma-deploy] FAILED ${coach.key}: ${e.message}`);
        errors.push(errMsg);
        agents.push({ key: coach.key, agentId: "", version: 0, name: `${coach.name} (FAILED: ${e.message})` });
      }
    }

    const successCount = agents.filter(a => a.agentId).length;
    if (successCount === 0) {
      return { success: false, agents, error: `All deployments failed: ${errors.join("; ")}` };
    }

    return {
      success: true,
      agents,
      environmentId,
      error: errors.length > 0 ? `${errors.length} agent(s) failed: ${errors.join("; ")}` : undefined,
    };
  }

  async status(config: Record<string, any>, agentState: Record<string, any>): Promise<TargetStatus> {
    const apiKey = config.apiKey;
    if (!apiKey) return { connected: false, agents: [], error: "No API key" };

    const client = new Anthropic({ apiKey });
    const agentEntries = agentState.agents || {};
    const statuses: TargetStatus["agents"] = [];

    for (const [key, info] of Object.entries(agentEntries) as [string, any][]) {
      try {
        const agent = await (client.beta as any).agents.retrieve(info.id);
        statuses.push({
          key,
          agentId: agent.id,
          name: agent.name,
          healthy: !agent.archived_at,
          version: agent.version,
        });
      } catch (e: any) {
        statuses.push({ key, agentId: info.id, name: info.name, healthy: false, version: info.version, error: e.message });
      }
    }

    return { connected: true, agents: statuses };
  }

  async teardown(config: Record<string, any>, agentState: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    const apiKey = config.apiKey;
    if (!apiKey) return { success: false, error: "No API key" };

    const client = new Anthropic({ apiKey });
    const agentEntries = agentState.agents || {};

    for (const [, info] of Object.entries(agentEntries) as [string, any][]) {
      try {
        await (client.beta as any).agents.archive(info.id);
      } catch { /* ignore archive failures */ }
    }

    if (agentState.environment_id) {
      try {
        await (client.beta as any).environments.archive(agentState.environment_id);
      } catch { /* ignore */ }
    }

    return { success: true };
  }
}
