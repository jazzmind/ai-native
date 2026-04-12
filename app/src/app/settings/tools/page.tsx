"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useProject } from "@/components/ProjectContext";
import { Shield, Plus, Trash2, Check, X } from "lucide-react";

interface ToolTrustEntry {
  id: string;
  tool_pattern: string;
  trust_level: "auto" | "confirm" | "blocked";
  created_at: string;
}

const TRUST_COLORS = {
  auto: "text-green-400 bg-green-500/20",
  confirm: "text-yellow-400 bg-yellow-500/20",
  blocked: "text-red-400 bg-red-500/20",
};

const DEFAULT_TOOLS = [
  { pattern: "web_search", default: "auto", description: "Web search (read-only)" },
  { pattern: "mcp:notion:*", default: "confirm", description: "All Notion tools" },
  { pattern: "mcp:slack:*", default: "confirm", description: "All Slack tools" },
  { pattern: "mcp:email:*", default: "confirm", description: "All email tools" },
];

export default function ToolTrustPage() {
  const { data: session } = useSession();
  const { activeProject } = useProject();
  const [tools, setTools] = useState<ToolTrustEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newLevel, setNewLevel] = useState<"auto" | "confirm" | "blocked">("confirm");

  const load = useCallback(async () => {
    if (!activeProject) return;
    const res = await fetch(`/api/tools?projectId=${activeProject.id}`);
    if (res.ok) {
      const data = await res.json();
      setTools(data.tools || []);
    }
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  const handleSet = async (pattern: string, level: "auto" | "confirm" | "blocked") => {
    if (!activeProject) return;
    await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set",
        projectId: activeProject.id,
        toolPattern: pattern,
        trustLevel: level,
      }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  };

  const handleAdd = async () => {
    if (!newPattern.trim()) return;
    await handleSet(newPattern.trim(), newLevel);
    setNewPattern("");
    setShowAdd(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={24} /> Tool Trust Levels
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Control which tools require approval in Execute mode. Tools not listed here use smart defaults.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full ${TRUST_COLORS.auto}`}>auto</span>
          <span className="text-[var(--text-muted)]">Executes immediately</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full ${TRUST_COLORS.confirm}`}>confirm</span>
          <span className="text-[var(--text-muted)]">Requires approval</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full ${TRUST_COLORS.blocked}`}>blocked</span>
          <span className="text-[var(--text-muted)]">Not available</span>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-[var(--border)] rounded-xl p-4 mb-6 bg-[var(--bg-secondary)]">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-[var(--text-muted)] block mb-1">Tool Pattern</label>
              <input
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g., mcp:slack:* or send_email"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Trust Level</label>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as "auto" | "confirm" | "blocked")}
                className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="auto">Auto</option>
                <option value="confirm">Confirm</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <button onClick={handleAdd} className="p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)]">
              <Check size={16} />
            </button>
            <button onClick={() => setShowAdd(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            Use * for wildcards: <code className="bg-[#1a1a2e] px-1 rounded">mcp:slack:*</code> matches all Slack tools
          </p>
        </div>
      )}

      {/* Default tools (informational) */}
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Common Tools</h3>
      <div className="space-y-2 mb-8">
        {DEFAULT_TOOLS.map((dt) => {
          const override = tools.find((t) => t.tool_pattern === dt.pattern);
          const level = override?.trust_level || dt.default;
          return (
            <div key={dt.pattern} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-secondary)]">
              <div>
                <code className="text-xs font-mono">{dt.pattern}</code>
                <p className="text-[10px] text-[var(--text-muted)]">{dt.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={level}
                  onChange={(e) => handleSet(dt.pattern, e.target.value as "auto" | "confirm" | "blocked")}
                  className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${TRUST_COLORS[level as keyof typeof TRUST_COLORS]}`}
                >
                  <option value="auto">auto</option>
                  <option value="confirm">confirm</option>
                  <option value="blocked">blocked</option>
                </select>
                {override && (
                  <span className="text-[9px] text-[var(--text-muted)]">customized</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom rules */}
      {tools.filter((t) => !DEFAULT_TOOLS.some((dt) => dt.pattern === t.tool_pattern)).length > 0 && (
        <>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Custom Rules</h3>
          <div className="space-y-2">
            {tools
              .filter((t) => !DEFAULT_TOOLS.some((dt) => dt.pattern === t.tool_pattern))
              .map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-secondary)]">
                  <code className="text-xs font-mono">{t.tool_pattern}</code>
                  <div className="flex items-center gap-2">
                    <select
                      value={t.trust_level}
                      onChange={(e) => handleSet(t.tool_pattern, e.target.value as "auto" | "confirm" | "blocked")}
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${TRUST_COLORS[t.trust_level]}`}
                    >
                      <option value="auto">auto</option>
                      <option value="confirm">confirm</option>
                      <option value="blocked">blocked</option>
                    </select>
                    <button onClick={() => handleDelete(t.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
