"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Save, Cpu, Zap, FlaskConical, MessageSquare, CheckCircle } from "lucide-react";

interface ModelOption {
  id: string;
  displayName: string;
}

interface ModelRoleConfig {
  agent: string;
  fast: string;
  research: string;
  chat: string;
}

const ROLE_META: {
  key: keyof ModelRoleConfig;
  label: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  {
    key: "agent",
    label: "Agent",
    description: "General agent tasks — briefings, scheduled actions, structured output. Balanced capability and speed.",
    Icon: Cpu,
  },
  {
    key: "fast",
    label: "Fast",
    description: "Routing, quick classifications, and latency-sensitive operations. Prefer the smallest capable model.",
    Icon: Zap,
  },
  {
    key: "research",
    label: "Research",
    description: "Deep analysis, long documents, and complex reasoning. Use the highest-capability model available.",
    Icon: FlaskConical,
  },
  {
    key: "chat",
    label: "Chat",
    description: "Interactive conversations with your advisors. Good balance of quality and cost.",
    Icon: MessageSquare,
  },
];

export default function ModelsSettingsPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [config, setConfig] = useState<ModelRoleConfig | null>(null);
  const [draft, setDraft] = useState<ModelRoleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [modelsRes, configRes] = await Promise.all([
        fetch("/api/admin/models"),
        fetch("/api/settings/models"),
      ]);
      const modelsData = await modelsRes.json();
      const configData = await configRes.json();
      setModels(modelsData.models || []);
      setConfig(configData.config);
      setDraft(configData.config);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (role: keyof ModelRoleConfig, modelId: string) => {
    setDraft((prev) => prev ? { ...prev, [role]: modelId } : prev);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setConfig(data.config);
      setDraft(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text)]">Model Configuration</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Map each role to an Anthropic model. These mappings apply across all advisors and scheduled actions.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-8">
          <RefreshCw size={14} className="animate-spin" /> Loading models…
        </div>
      ) : (
        <div className="space-y-3">
          {ROLE_META.map(({ key, label, description, Icon }) => (
            <div
              key={key}
              className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] shrink-0 mt-0.5">
                  <Icon size={16} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
                    <select
                      value={draft?.[key] || ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors min-w-[220px]"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
                  {draft?.[key] && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5 font-mono opacity-70">
                      {draft[key]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle size={12} /> Saved
          </span>
        )}
        {isDirty && !saving && (
          <span className="text-xs text-[var(--text-muted)]">Unsaved changes</span>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
        <p className="font-medium mb-1">How roles are used</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><span className="text-[var(--text)]">Agent</span> — briefing runs, scheduled actions, structured generation</li>
          <li><span className="text-[var(--text)]">Fast</span> — intent routing, quick classifications</li>
          <li><span className="text-[var(--text)]">Research</span> — deep analysis tasks (coming soon)</li>
          <li><span className="text-[var(--text)]">Chat</span> — all advisor conversations</li>
        </ul>
      </div>
    </div>
  );
}
