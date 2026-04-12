"use client";

import { COACH_META } from "@/lib/coaches";
import { CoachIcon } from "./CoachIcon";

interface CoachSelectorProps {
  selectedCoaches: string[];
  onSelect: (keys: string[]) => void;
}

export function CoachSelector({ selectedCoaches, onSelect }: CoachSelectorProps) {
  const isAutoRoute = selectedCoaches.length === 0;

  const toggleCoach = (key: string) => {
    if (selectedCoaches.includes(key)) {
      onSelect(selectedCoaches.filter((k) => k !== key));
    } else {
      onSelect([...selectedCoaches, key]);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect([])}
        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
          isAutoRoute
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
        }`}
      >
        Auto-route
      </button>
      {COACH_META.map((coach) => {
        const selected = selectedCoaches.includes(coach.key);
        return (
          <button
            key={coach.key}
            onClick={() => toggleCoach(coach.key)}
            title={coach.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              selected
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            <CoachIcon name={coach.icon} size={14} />
            {coach.name.replace(/ (Coach|Advisor)$/, "")}
          </button>
        );
      })}
    </div>
  );
}
