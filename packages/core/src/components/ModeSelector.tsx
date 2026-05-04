"use client";

import { Lightbulb, GraduationCap, ClipboardList, Hammer, Zap, Sparkles } from "lucide-react";
import type { AgentMode } from "../modes/index";

const MODE_OPTIONS: { key: AgentMode | "auto"; label: string; description: string; icon: typeof Lightbulb }[] = [
  { key: "auto", label: "Auto", description: "Router picks the best mode", icon: Sparkles },
  { key: "advise", label: "Advise", description: "Research and recommend", icon: Lightbulb },
  { key: "coach", label: "Coach", description: "Build your capability", icon: GraduationCap },
  { key: "plan", label: "Plan", description: "Structured action items", icon: ClipboardList },
  { key: "assist", label: "Assist", description: "Prep work, you decide", icon: Hammer },
  { key: "execute", label: "Execute", description: "Decide and act", icon: Zap },
];

interface ModeSelectorProps {
  selected: AgentMode | "auto";
  onSelect: (mode: AgentMode | "auto") => void;
}

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {MODE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = selected === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            title={opt.description}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] border border-transparent"
            }`}
          >
            <Icon size={12} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const opt = MODE_OPTIONS.find((o) => o.key === mode);
  if (!opt) return null;
  const Icon = opt.icon;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
      <Icon size={9} />
      {opt.label}
    </span>
  );
}
