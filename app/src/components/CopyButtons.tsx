"use client";

import { useState, useCallback } from "react";
import { Copy, FileText, Check } from "lucide-react";

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").replace(/```/g, ""))
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^\|.*\|$/gm, (row) =>
      row
        .split("|")
        .filter(Boolean)
        .map((c) => c.trim())
        .join(" | ")
    )
    .replace(/^\|[-:| ]+\|$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface CopyButtonsProps {
  content: string;
}

export function CopyButtons({ content }: CopyButtonsProps) {
  const [copiedType, setCopiedType] = useState<"md" | "plain" | null>(null);

  const handleCopy = useCallback(async (type: "md" | "plain") => {
    const text = type === "md" ? content : stripMarkdown(content);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1500);
    }
  }, [content]);

  if (!content) return null;

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => handleCopy("md")}
        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-blue-400 transition-colors"
        title="Copy as markdown"
      >
        {copiedType === "md" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
      <button
        onClick={() => handleCopy("plain")}
        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-blue-400 transition-colors"
        title="Copy as plain text"
      >
        {copiedType === "plain" ? <Check size={12} className="text-green-400" /> : <FileText size={12} />}
      </button>
    </div>
  );
}
