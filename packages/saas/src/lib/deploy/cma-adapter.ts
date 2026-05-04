import Anthropic from "@anthropic-ai/sdk";
import type { DeployAdapter, CoachDefinition, DeployResult, TargetStatus } from "./adapter";

const ENVIRONMENT_NAME = "coach-env";

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

    // Deploy base agents first (no callable deps), then ones with callable
    const baseCoaches = coaches.filter(c => !c.callable || c.callable.length === 0);
    const dependentCoaches = coaches.filter(c => c.callable && c.callable.length > 0);

    console.log(`[cma-deploy] Base coaches: ${baseCoaches.map(c => c.key).join(", ")}`);
    console.log(`[cma-deploy] Dependent coaches: ${dependentCoaches.map(c => c.key).join(", ")}`);
    console.log(`[cma-deploy] Existing state keys: ${Object.keys(existingState.agents || {}).join(", ") || "none"}`);
    console.log(`[cma-deploy] Environment ID: ${environmentId || "none"}`);

    for (const coach of [...baseCoaches, ...dependentCoaches]) {
      try {
        const systemPrompt = buildDatePreamble() + coach.instructions;
        const tools: any[] = [{ type: "agent_toolset_20260401" }];
        const existing = existingState.agents?.[coach.key];
        console.log(`[cma-deploy] ${coach.key}: existing=${existing ? existing.id + " v" + existing.version : "NEW"}`);

        let callableAgents: any[] | undefined;
        if (coach.callable && coach.callable.length > 0) {
          callableAgents = [];
          for (const depKey of coach.callable) {
            const dep = existingState.agents?.[depKey] || agents.find(a => a.key === depKey);
            if (dep) {
              const depId = dep.agentId || dep.id;
              const depVersion = dep.version;
              if (depId && depVersion) {
                callableAgents.push({ type: "agent", id: depId, version: depVersion });
              }
            }
          }
        }

        const skills = (coach.skills || []).filter(s => s.skill_id);

        let agent: any;
        if (existing) {
          const updateParams: any = {
            version: existing.version,
            system: systemPrompt,
            description: coach.description,
            tools,
            skills: skills.length > 0 ? skills : undefined,
          };
          if (callableAgents && callableAgents.length > 0) {
            updateParams.callable_agents = callableAgents;
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
