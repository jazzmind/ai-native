"use client";

import { COACH_META } from "@/lib/coaches";
import { CoachIcon } from "./CoachIcon";

interface CoachSelectorProps {
  selectedCoach: string | null;
  onSelect: (key: string | null) => void;
}

export function CoachSelector({ selectedCoach, onSelect }: CoachSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
          selectedCoach === null
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
        }`}
      >
        Auto-route
      </button>
      {COACH_META.map((coach) => (
        <button
          key={coach.key}
          onClick={() => onSelect(coach.key)}
          title={coach.description}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            selectedCoach === coach.key
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
          }`}
        >
          <CoachIcon name={coach.icon} size={14} />
          {coach.name.replace(" Coach", "")}
        </button>
      ))}
    </div>
  );
}
