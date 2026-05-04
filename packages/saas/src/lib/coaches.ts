// Re-export shared coach metadata from @ai-native/core
export type { AgentMode, CoachIconName, CoachMeta } from "@ai-native/core";
export { COACH_META, getCoachMeta, getCoachByKey, AGENT_MODES } from "@ai-native/core";

// SaaS-specific: CoachConfig includes runtime agentId from CMA deployment
export interface CoachConfig {
  key: string;
  name: string;
  agentId: string;
  description: string;
  icon: import("@ai-native/core").CoachIconName;
  keywords: string[];
}
