"use client";

import { useState } from "react";
import { Check, PenLine } from "lucide-react";

interface MultipleChoiceCardProps {
  title: string;
  options: string[];
  hasWriteIn: boolean;
  onSelect: (choice: string) => void;
  disabled?: boolean;
}

const WRITE_IN_PATTERN = /^other\b|please specify|write.?in|custom|something else/i;

export function MultipleChoiceCard({
  title,
  options,
  hasWriteIn,
  onSelect,
  disabled,
}: MultipleChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [writeInValue, setWriteInValue] = useState("");
  const [showWriteIn, setShowWriteIn] = useState(false);

  const handleSelect = (option: string) => {
    if (disabled || selected) return;

    if (hasWriteIn && WRITE_IN_PATTERN.test(option)) {
      setShowWriteIn(true);
      return;
    }

    setSelected(option);
    onSelect(option);
  };

  const handleWriteInSubmit = () => {
    if (!writeInValue.trim() || disabled || selected) return;
    const value = writeInValue.trim();
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="my-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
      <p className="text-sm font-medium text-[var(--text)] mb-3">{title}</p>
      <div className="space-y-2">
        {options.map((option, i) => {
          const isWriteInOption = hasWriteIn && WRITE_IN_PATTERN.test(option);
          const isSelected = selected === option;

          if (isWriteInOption && showWriteIn) {
            return (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={writeInValue}
                  onChange={(e) => setWriteInValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWriteInSubmit()}
                  placeholder="Type your answer..."
                  autoFocus
                  disabled={!!selected}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--accent)]/50 rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={handleWriteInSubmit}
                  disabled={!writeInValue.trim() || !!selected}
                  className="px-3 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
                >
                  Send
                </button>
              </div>
            );
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              disabled={disabled || (!!selected && !isSelected)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isSelected
                  ? "bg-[var(--accent)]/15 border border-[var(--accent)]/50 text-[var(--text)]"
                  : selected
                    ? "bg-[var(--bg-tertiary)] border border-transparent text-[var(--text-muted)] opacity-50"
                    : "bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 text-[var(--text)]"
              }`}
            >
              <span
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]"
                    : "border-[var(--text-muted)]/30"
                }`}
              >
                {isSelected && <Check size={12} className="text-white" />}
              </span>
              <span className="flex-1">{option}</span>
              {isWriteInOption && !showWriteIn && (
                <PenLine size={14} className="text-[var(--text-muted)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
