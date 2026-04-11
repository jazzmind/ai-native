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

    for (const coach of [...baseCoaches, ...dependentCoaches]) {
      try {
        const systemPrompt = buildDatePreamble() + coach.instructions;
        const tools: any[] = [{ type: "agent_toolset_20260401" }];
        const existing = existingState.agents?.[coach.key];

        let callableAgents: any[] | undefined;
        if (coach.callable && coach.callable.length > 0) {
          callableAgents = [];
          for (const depKey of coach.callable) {
            const dep = existingState.agents?.[depKey] || agents.find(a => a.key === depKey);
            if (dep) {
              callableAgents.push({ type: "agent", id: dep.agentId || dep.id, version: dep.version });
            }
          }
        }

        const extraBody: any = {};
        if (callableAgents && callableAgents.length > 0) {
          extraBody.callable_agents = callableAgents;
        }

        const skills = (coach.skills || []).filter(s => s.skill_id);

        let agent: any;
        if (existing) {
          agent = await (client.beta as any).agents.update(existing.id, {
            version: existing.version,
            system: systemPrompt,
            description: coach.description,
            tools,
            skills: skills.length > 0 ? skills : undefined,
            extra_body: Object.keys(extraBody).length > 0 ? extraBody : undefined,
          });
        } else {
          agent = await (client.beta as any).agents.create({
            name: coach.name,
            model: coach.model || "claude-sonnet-4-6",
            system: systemPrompt,
            description: coach.description,
            tools,
            skills: skills.length > 0 ? skills : undefined,
            extra_body: Object.keys(extraBody).length > 0 ? extraBody : undefined,
          });
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
        agents.push({ key: coach.key, agentId: "", version: 0, name: `${coach.name} (FAILED: ${e.message})` });
      }
    }

    return { success: true, agents, environmentId };
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
