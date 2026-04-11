export interface CoachDefinition {
  key: string;
  name: string;
  dir: string;
  model: string;
  description: string;
  instructions: string;
  callable?: string[];
  mcp?: string[];
  skills?: { type: string; skill_id: string }[];
}

export interface AgentDeployResult {
  key: string;
  agentId: string;
  version: number;
  name: string;
}

export interface DeployResult {
  success: boolean;
  agents: AgentDeployResult[];
  environmentId?: string;
  error?: string;
}

export interface AgentStatus {
  key: string;
  agentId: string;
  name: string;
  healthy: boolean;
  version: number;
  error?: string;
}

export interface TargetStatus {
  connected: boolean;
  agents: AgentStatus[];
  error?: string;
}

export interface DeployAdapter {
  readonly type: string;

  validate(config: Record<string, any>): Promise<{ valid: boolean; error?: string }>;

  deploy(coaches: CoachDefinition[], config: Record<string, any>): Promise<DeployResult>;

  status(config: Record<string, any>, agentState: Record<string, any>): Promise<TargetStatus>;

  teardown(config: Record<string, any>, agentState: Record<string, any>): Promise<{ success: boolean; error?: string }>;
}
