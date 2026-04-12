"use client";

import { useState } from "react";
import { Wrench, Eye, Zap, ChevronDown, ChevronRight, Cpu, BarChart3 } from "lucide-react";
import type { ActivityItem } from "./Chat";

interface ActivityLogProps {
  activity: ActivityItem[];
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);

  switch (item.eventType) {
    case "tool_use": {
      const toolName = String(item.data.tool || "unknown");
      const isMcp = toolName.startsWith("mcp:");
      return (
        <div className="flex flex-col">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-left hover:text-[var(--text)] transition-colors"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <Wrench size={10} className={isMcp ? "text-purple-400" : "text-blue-400"} />
            <span>{isMcp ? toolName.slice(4) : toolName}</span>
            {isMcp && (
              <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">MCP</span>
            )}
          </button>
          {expanded && item.data.input && (
            <pre className="mt-1 ml-5 text-[10px] bg-[#0d0d0d] rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto">
              {typeof item.data.input === "string"
                ? item.data.input
                : JSON.stringify(item.data.input, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    case "tool_result": {
      const toolName = String(item.data.tool || "");
      return (
        <div className="flex flex-col">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-left hover:text-[var(--text)] transition-colors"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <Eye size={10} className="text-green-400" />
            <span>{toolName ? `${toolName} result` : "tool result"}</span>
          </button>
          {expanded && item.data.result && (
            <pre className="mt-1 ml-5 text-[10px] bg-[#0d0d0d] rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto">
              {String(item.data.result)}
            </pre>
          )}
        </div>
      );
    }

    case "thinking":
      return (
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-yellow-400" />
          <span>Extended thinking</span>
        </div>
      );

    case "usage": {
      const input = Number(item.data.input_tokens) || 0;
      const output = Number(item.data.output_tokens) || 0;
      const cacheRead = Number(item.data.cache_read) || 0;
      return (
        <div className="flex items-center gap-1.5">
          <BarChart3 size={10} className="text-cyan-400" />
          <span>
            {formatTokens(input)} in / {formatTokens(output)} out
            {cacheRead > 0 && ` (${formatTokens(cacheRead)} cached)`}
          </span>
        </div>
      );
    }

    case "context_compacted":
      return (
        <div className="flex items-center gap-1.5">
          <Zap size={10} className="text-orange-400" />
          <span>Context compacted</span>
        </div>
      );

    default:
      return (
        <div className="flex items-center gap-1.5">
          <span>{item.eventType}</span>
        </div>
      );
  }
}

export function ActivityLog({ activity }: ActivityLogProps) {
  const [open, setOpen] = useState(false);

  if (!activity || activity.length === 0) return null;

  const toolCount = activity.filter(
    (a) => a.eventType === "tool_use"
  ).length;
  const totalTokens = activity
    .filter((a) => a.eventType === "usage")
    .reduce(
      (acc, a) => ({
        input: acc.input + (Number(a.data.input_tokens) || 0),
        output: acc.output + (Number(a.data.output_tokens) || 0),
      }),
      { input: 0, output: 0 }
    );

  const summary = [
    toolCount > 0 ? `${toolCount} tool${toolCount > 1 ? "s" : ""}` : null,
    totalTokens.input + totalTokens.output > 0
      ? `${formatTokens(totalTokens.input + totalTokens.output)} tokens`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-2 border-t border-[var(--border)] pt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Wrench size={10} />
        <span>Activity{summary ? ` · ${summary}` : ""}</span>
      </button>

      {open && (
        <div className="mt-1.5 ml-1 space-y-1 text-[10px] text-[var(--text-muted)]">
          {activity.map((item, i) => (
            <ActivityEntry key={`${item.eventType}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
