import type { DeployAdapter, CoachDefinition, DeployResult, TargetStatus } from "./adapter";

export class BusiboxAdapter implements DeployAdapter {
  readonly type = "busibox";

  async validate(config: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    const { hostUrl, apiKey } = config;
    if (!hostUrl) return { valid: false, error: "Busibox host URL is required" };
    if (!apiKey) return { valid: false, error: "Busibox API key is required" };

    try {
      const res = await fetch(`${hostUrl}/api/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { valid: false, error: `Busibox returned ${res.status}` };
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: `Cannot connect to Busibox: ${e.message}` };
    }
  }

  async deploy(coaches: CoachDefinition[], config: Record<string, any>): Promise<DeployResult> {
    const { hostUrl, apiKey } = config;
    if (!hostUrl || !apiKey) return { success: false, agents: [], error: "Missing Busibox credentials" };

    const agents: DeployResult["agents"] = [];

    for (const coach of coaches) {
      try {
        const res = await fetch(`${hostUrl}/api/agents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            name: coach.name,
            key: coach.key,
            description: coach.description,
            instructions: coach.instructions,
            model: coach.model,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          agents.push({ key: coach.key, agentId: "", version: 0, name: `${coach.name} (FAILED: ${err})` });
          continue;
        }

        const result = await res.json();
        agents.push({
          key: coach.key,
          agentId: result.id || result.agent_id || coach.key,
          version: result.version || 1,
          name: coach.name,
        });
      } catch (e: any) {
        agents.push({ key: coach.key, agentId: "", version: 0, name: `${coach.name} (FAILED: ${e.message})` });
      }
    }

    return { success: agents.some(a => a.agentId !== ""), agents };
  }

  async status(config: Record<string, any>, agentState: Record<string, any>): Promise<TargetStatus> {
    const { hostUrl, apiKey } = config;
    if (!hostUrl || !apiKey) return { connected: false, agents: [], error: "Missing Busibox credentials" };

    try {
      const res = await fetch(`${hostUrl}/api/agents`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { connected: false, agents: [], error: `Status check failed: ${res.status}` };

      const data = await res.json();
      const remoteAgents = Array.isArray(data) ? data : data.agents || [];

      return {
        connected: true,
        agents: remoteAgents.map((a: any) => ({
          key: a.key || a.name?.toLowerCase().replace(/\s+/g, "-"),
          agentId: a.id || a.agent_id,
          name: a.name,
          healthy: true,
          version: a.version || 1,
        })),
      };
    } catch (e: any) {
      return { connected: false, agents: [], error: e.message };
    }
  }

  async teardown(config: Record<string, any>, agentState: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    const { hostUrl, apiKey } = config;
    if (!hostUrl || !apiKey) return { success: false, error: "Missing Busibox credentials" };

    const agentEntries = agentState.agents || {};
    for (const [, info] of Object.entries(agentEntries) as [string, any][]) {
      try {
        await fetch(`${hostUrl}/api/agents/${info.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } catch { /* ignore */ }
    }

    return { success: true };
  }
}
