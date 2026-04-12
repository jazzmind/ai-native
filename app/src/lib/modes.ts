export const AGENT_MODES = ["advise", "coach", "plan", "assist", "execute"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export interface ModeDefinition {
  key: AgentMode;
  name: string;
  description: string;
  icon: string;
  template: string;
}

export const MODE_META: Record<AgentMode, { name: string; description: string; icon: string }> = {
  advise: {
    name: "Advise",
    description: "Research and recommend",
    icon: "Lightbulb",
  },
  coach: {
    name: "Coach",
    description: "Build your capability",
    icon: "GraduationCap",
  },
  plan: {
    name: "Plan",
    description: "Structured action items",
    icon: "ClipboardList",
  },
  assist: {
    name: "Assist",
    description: "Prep work, you decide",
    icon: "Hammer",
  },
  execute: {
    name: "Execute",
    description: "Decide and act",
    icon: "Zap",
  },
};

export function getModeMeta(mode: AgentMode) {
  return MODE_META[mode];
}

export function isValidMode(mode: string): mode is AgentMode {
  return AGENT_MODES.includes(mode as AgentMode);
}
