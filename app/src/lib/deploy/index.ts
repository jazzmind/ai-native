import type { DeployAdapter } from "./adapter";
import { CMAAdapter } from "./cma-adapter";
import { BusiboxAdapter } from "./busibox-adapter";

const adapters: Record<string, DeployAdapter> = {
  cma: new CMAAdapter(),
  busibox: new BusiboxAdapter(),
};

export function getAdapter(type: string): DeployAdapter | undefined {
  return adapters[type];
}

export function listAdapterTypes(): string[] {
  return Object.keys(adapters);
}

export type { DeployAdapter, CoachDefinition, DeployResult, TargetStatus, AgentStatus, AgentDeployResult } from "./adapter";
