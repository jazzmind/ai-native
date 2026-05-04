import fs from "fs";
import path from "path";
import { type AgentMode, type ModeDefinition, AGENT_MODES, MODE_META } from "./modes";

const MODES_DIR = path.resolve(process.cwd(), "..", "modes");
const _templateCache = new Map<AgentMode, string>();

export function loadModeTemplate(mode: AgentMode): string {
  const cached = _templateCache.get(mode);
  if (cached) return cached;

  const filePath = path.join(MODES_DIR, `${mode}.md`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    _templateCache.set(mode, content);
    return content;
  } catch {
    return `You are operating in ${mode.toUpperCase()} mode.`;
  }
}

export function getAllModes(): ModeDefinition[] {
  return AGENT_MODES.map((key) => ({
    key,
    ...MODE_META[key],
    template: loadModeTemplate(key),
  }));
}
