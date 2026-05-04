"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useProject } from "@/components/ProjectContext";
import { CoachIcon } from "@/components/CoachIcon";
import { COACH_META } from "@/lib/coaches";
import {
  Zap, Clock, CheckCircle, XCircle, RefreshCw, Calendar,
  ChevronRight, MessageSquare, Repeat, FileText, Pencil, Play, X, Save, Globe, Eye, EyeOff, Mail,
} from "lucide-react";

type TaskStatus = "pending" | "triggered" | "completed" | "dismissed";
type TaskType = "coaching_followup" | "reminder" | "deadline" | "check_in" | "status_report_collection" | "ea_briefing";

interface AgentTask {
  id: string;
  taskType: TaskType;
  coachKey: string;
  status: TaskStatus;
  triggerAt: string;
  repeatInterval: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  context: Record<string, unknown> | null;
  conversationId: string | null;
  artifactCount?: number;
  latestArtifactId?: string | null;
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  coaching_followup: "Follow-up",
  reminder: "Reminder",
  deadline: "Deadline",
  check_in: "Check-in",
  status_report_collection: "Status Report",
  ea_briefing: "Briefing",
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  triggered: { label: "Triggered", icon: Zap, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-400 bg-green-500/10 border-green-500/20" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border)]" },
};

const TABS: { key: TaskStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "triggered", label: "Triggered" },
  { key: "completed", label: "Completed" },
  { key: "dismissed", label: "Dismissed" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function formatRepeat(interval: string) {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match) return interval;
  const amount = parseInt(match[1]);
  const unitMap: Record<string, string> = { m: "min", h: amount === 1 ? "hour" : "hours", d: amount === 1 ? "day" : "days", w: amount === 1 ? "week" : "weeks" };
  return `Every ${amount === 1 ? "" : amount + " "}${unitMap[match[2]] || match[2]}`.trim();
}

// ISO-local datetime string for <input type="datetime-local">
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Model helpers ─────────────────────────────────────────────────────────

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

const FALLBACK_MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5" },
  { id: "claude-opus-4-5", displayName: "Claude Opus 4.5" },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5 (fast)" },
];

const FALLBACK_ROLE_CONFIG: ModelRoleConfig = {
  agent: "claude-sonnet-4-5",
  fast: "claude-haiku-4-5",
  research: "claude-opus-4-5",
  chat: "claude-sonnet-4-5",
};

const DEFAULT_COLLECTION_PROMPT =
  `You are the Chief of Staff helping gather status updates for a report.\nAsk focused questions to understand what happened this period: key accomplishments, blockers, upcoming priorities, and any decisions needed.\nKeep questions concise. When you have enough detail (usually after 3-6 exchanges), respond with a message ending with "I have enough to complete the report." and include nothing else after that phrase.`;

function buildPreviewPrompt(ctx: Record<string, unknown>): string {
  const customPrompt = ctx.customPrompt as string | undefined;
  if (customPrompt?.trim()) return customPrompt.trim();

  const title = (ctx.title as string) || "Daily Briefing";
  const topics = ctx.topics as string | undefined;
  const format = ctx.format as string | undefined;
  const useWebSearch = ctx.useWebSearch !== false;

  return [
    `You are the Chief of Staff generating a briefing titled: "${title}".`,
    topics ? `Focus on these topics: ${topics}.` : "",
    format ? `Use this format: ${format}.` : "Format as structured markdown with clear sections.",
    ctx.contextKey ? `[Template from memory key "${ctx.contextKey}" will be appended here]` : "",
    useWebSearch
      ? "Search the web for the latest information, then produce the briefing in full. Be thorough and specific."
      : "Produce the briefing in full based on your knowledge. Be thorough and specific.",
  ].filter(Boolean).join("\n\n");
}

// ─── Edit Modal ────────────────────────────────────────────────────────────

function EditModal({ task, projectId, models, roleConfig, onClose, onSave }: {
  task: AgentTask;
  projectId: string;
  models: ModelOption[];
  roleConfig: ModelRoleConfig;
  onClose: () => void;
  onSave: (updates: Partial<AgentTask>) => Promise<void>;
}) {
  const ctx = (task.context ?? {}) as Record<string, unknown>;
  const contextKey = ctx.contextKey as string | undefined;

  // Schedule fields
  const [title, setTitle] = useState((ctx.title as string) || "");
  const [repeatInterval, setRepeatInterval] = useState(task.repeatInterval || "");
  const [triggerAt, setTriggerAt] = useState(toDatetimeLocal(task.triggerAt));

  // Briefing fields
  const [topics, setTopics] = useState((ctx.topics as string) || "");
  const [format, setFormat] = useState((ctx.format as string) || "");
  const [useWebSearch, setUseWebSearch] = useState(ctx.useWebSearch !== false);
  const [customPrompt, setCustomPrompt] = useState((ctx.customPrompt as string) || "");

  // EA memory content (when contextKey is set — this is what actually drives the briefing)
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryLoading, setMemoryLoading] = useState(false);

  // Collection fields
  const [description, setDescription] = useState((ctx.description as string) || "");
  const [customSystemPrompt, setCustomSystemPrompt] = useState((ctx.customSystemPrompt as string) || "");

  // Shared — default to the "agent" role model from settings if task has no explicit model set
  const [model, setModel] = useState((ctx.model as string) || roleConfig.agent);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const isBriefing = task.taskType === "ea_briefing";
  const isCollection = task.taskType === "status_report_collection";

  // Fetch EA memory entry when contextKey is present
  useEffect(() => {
    if (!contextKey || !projectId) return;
    setMemoryLoading(true);
    fetch(`/api/ea-memory?key=${encodeURIComponent(contextKey)}&projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) {
          setMemoryContent(data.entry.content || "");
          setMemoryTitle(data.entry.title || contextKey);
        }
      })
      .catch(() => {})
      .finally(() => setMemoryLoading(false));
  }, [contextKey, projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // For the preview, merge memory content into topics if no explicit topics/customPrompt set
  const previewCtx = {
    ...ctx, title, topics: topics || memoryContent, format, useWebSearch, customPrompt,
  };

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      // Save EA memory entry if we have a contextKey and memory was loaded/edited
      if (contextKey && memoryContent.trim()) {
        await fetch("/api/ea-memory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: contextKey,
            projectId,
            content: memoryContent,
            title: memoryTitle || contextKey,
            memoryType: "preference",
          }),
        });
      }

      const newContext: Record<string, unknown> = {
        ...ctx,
        title,
        topics,
        format,
        useWebSearch,
        model,
        description,
        ...(customPrompt.trim() ? { customPrompt: customPrompt.trim() } : { customPrompt: undefined }),
        ...(customSystemPrompt.trim() ? { customSystemPrompt: customSystemPrompt.trim() } : { customSystemPrompt: undefined }),
      };
      await onSave({
        context: newContext,
        repeatInterval: repeatInterval || null,
        triggerAt,
      } as any);
      onClose();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">Edit Action</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">

          {/* ── Schedule ── */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Schedule</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Next Run</label>
                  <input
                    type="datetime-local"
                    value={triggerAt}
                    onChange={(e) => setTriggerAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Repeat</label>
                  <input
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(e.target.value)}
                    placeholder="1d, 7d, 1w…"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">m h d w · blank = one-off</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Briefing instructions ── */}
          {isBriefing && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Content</h3>
              <div className="space-y-3">

                {/* Memory content — what actually drives this briefing */}
                {contextKey && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Briefing Preferences
                      <span className="ml-1 text-[10px] text-[var(--text-muted)] font-normal opacity-70">
                        (stored by your advisor — edits here change future runs)
                      </span>
                    </label>
                    {memoryLoading ? (
                      <div className="w-full px-3 py-2 text-xs text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                        Loading preferences…
                      </div>
                    ) : (
                      <textarea
                        value={memoryContent}
                        onChange={(e) => setMemoryContent(e.target.value)}
                        rows={6}
                        placeholder="No preferences stored yet — the advisor captured none during setup."
                        className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--accent)]/30 rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-y"
                      />
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      This is the preference note your advisor saved. It&apos;s used as context when generating the briefing.
                    </p>
                  </div>
                )}

                {/* Only show Topics/Format when no contextKey (task set them directly) */}
                {!contextKey && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Topics</label>
                      <input
                        value={topics}
                        onChange={(e) => setTopics(e.target.value)}
                        placeholder="e.g. AI news, funding rounds, regulatory updates"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Format</label>
                      <input
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        placeholder="e.g. 5 bullets per topic with source links"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                  </>
                )}

                {/* Custom prompt override */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Custom Instructions
                    <span className="ml-1 text-[10px] text-[var(--text-muted)] font-normal">(overrides Topics + Format above when set)</span>
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={5}
                    placeholder="Write the full prompt sent to the AI. Leave blank to use the auto-generated prompt from Topics + Format."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-y font-mono"
                  />
                </div>

                {/* Prompt preview */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPromptPreview((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    {showPromptPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                    {showPromptPreview ? "Hide" : "Preview"} effective prompt
                  </button>
                  {showPromptPreview && (
                    <pre className="mt-2 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {buildPreviewPrompt(previewCtx)}
                    </pre>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Collection instructions ── */}
          {isCollection && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Collection</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Email Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="What will appear in the collection email body"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Chat System Prompt
                    <span className="ml-1 text-[10px] text-[var(--text-muted)] font-normal">(instructions for the AI in the collection chat)</span>
                  </label>
                  <textarea
                    value={customSystemPrompt}
                    onChange={(e) => setCustomSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={DEFAULT_COLLECTION_PROMPT}
                    className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-y font-mono"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Leave blank to use the default collection prompt.</p>
                </div>
              </div>
            </section>
          )}

          {/* ── Model & Tools ── */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Model & Tools</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                      {m.id === roleConfig.agent ? " · agent default" : ""}
                      {m.id === roleConfig.fast ? " · fast default" : ""}
                      {m.id === roleConfig.research ? " · research default" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Change defaults in{" "}
                  <a href="/settings/models" className="text-[var(--accent)] hover:underline">
                    Settings → Models
                  </a>
                </p>
              </div>

              {isBriefing && (
                <div
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    useWebSearch
                      ? "bg-blue-500/5 border-blue-500/20"
                      : "bg-[var(--bg)] border-[var(--border)]"
                  }`}
                  onClick={() => setUseWebSearch((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Globe size={13} className={useWebSearch ? "text-blue-400" : "text-[var(--text-muted)]"} />
                    <div>
                      <p className={`text-xs font-medium ${useWebSearch ? "text-blue-400" : "text-[var(--text-muted)]"}`}>
                        Web Search
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {useWebSearch ? "On — AI will search the web for current info" : "Off — AI uses training knowledge only"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${useWebSearch ? "bg-blue-500" : "bg-[var(--bg-tertiary)]"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${useWebSearch ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity"
          >
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const { data: session } = useSession();
  const { activeProject } = useProject();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [tab, setTab] = useState<TaskStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ taskId: string; ok: boolean; error?: string; msg?: string } | null>(null);
  const [editingTask, setEditingTask] = useState<AgentTask | null>(null);

  // Model list + role config — fetched once for the modal
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [roleConfig, setRoleConfig] = useState<ModelRoleConfig>(FALLBACK_ROLE_CONFIG);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/models").then((r) => r.json()).catch(() => ({ models: FALLBACK_MODELS })),
      fetch("/api/settings/models").then((r) => r.json()).catch(() => ({ config: FALLBACK_ROLE_CONFIG })),
    ]).then(([modelsData, configData]) => {
      if (modelsData.models?.length) setAvailableModels(modelsData.models);
      if (configData.config) setRoleConfig(configData.config);
    });
  }, []);

  const load = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/actions?projectId=${activeProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  const handleDismiss = async (taskId: string) => {
    setDismissing(taskId);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", taskId }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "dismissed" } : t));
    } finally {
      setDismissing(null);
    }
  };

  const handleRun = async (taskId: string) => {
    setRunning(taskId);
    setRunResult(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", taskId }),
      });
      const data = await res.json();
      setRunResult({ taskId, ok: data.ok, error: data.error });
      if (data.ok) {
        // Refresh task list to show updated lastTriggeredAt
        await load();
      }
    } finally {
      setRunning(null);
    }
  };

  const handleResend = async (taskId: string) => {
    setResending(taskId);
    setRunResult(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", taskId }),
      });
      const data = await res.json();
      setRunResult({ taskId, ok: data.ok, error: data.error, msg: data.ok ? "Email resent." : undefined });
    } finally {
      setResending(null);
    }
  };

  const handleSave = async (taskId: string, updates: Partial<AgentTask>) => {
    const ctx = updates.context as Record<string, unknown> | undefined;
    const title = ctx?.title as string | undefined;
    const triggerIso = (updates as any).triggerAt ? new Date((updates as any).triggerAt).toISOString() : undefined;

    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        taskId,
        title,
        repeatInterval: (updates as any).repeatInterval,
        triggerAt: triggerIso,
        context: ctx,
      }),
    });

    // Optimistically update local state
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        context: ctx ?? t.context,
        repeatInterval: (updates as any).repeatInterval ?? t.repeatInterval,
        triggerAt: triggerIso ?? t.triggerAt,
      };
    }));
  };

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  const filtered = tab === "all" ? tasks : tasks.filter((t) => t.status === tab);
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    triggered: tasks.filter((t) => t.status === "triggered").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    dismissed: tasks.filter((t) => t.status === "dismissed").length,
  };
  const recurring = filtered.filter((t) => t.repeatInterval);
  const oneOff = filtered.filter((t) => !t.repeatInterval);

  return (
    <div className="max-w-4xl mx-auto p-8 overflow-y-auto h-full">
      {editingTask && (
        <EditModal
          task={editingTask}
          projectId={activeProject?.id || ""}
          models={availableModels}
          roleConfig={roleConfig}
          onClose={() => setEditingTask(null)}
          onSave={async (updates) => { await handleSave(editingTask.id, updates); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap size={24} /> Actions
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Scheduled tasks and recurring workflows created by your advisors.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className={`flex items-center justify-between gap-2 px-4 py-2.5 mb-4 rounded-lg border text-xs ${
          runResult.ok
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          <span>
            {runResult.ok
              ? (runResult.msg || "Task triggered — you'll receive an email shortly.")
              : `Failed: ${runResult.error}`}
          </span>
          <button onClick={() => setRunResult(null)}><X size={12} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === key ? "bg-[var(--accent)]/20" : "bg-[var(--bg-tertiary)]"
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">Loading actions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Zap size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No actions {tab !== "all" ? `with status "${tab}"` : "yet"}</p>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Actions are created automatically by your advisors during conversations — try asking the Chief of Staff to set up a daily briefing or recurring status report.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {recurring.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Repeat size={12} /> Recurring
              </h2>
              <div className="space-y-2">
                {recurring.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onDismiss={handleDismiss}
                    onEdit={setEditingTask}
                    onRun={handleRun}
                    onResend={handleResend}
                    dismissing={dismissing}
                    running={running}
                    resending={resending}
                  />
                ))}
              </div>
            </section>
          )}
          {oneOff.length > 0 && (
            <section>
              {recurring.length > 0 && (
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Calendar size={12} /> One-off
                </h2>
              )}
              <div className="space-y-2">
                {oneOff.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onDismiss={handleDismiss}
                    onEdit={setEditingTask}
                    onRun={handleRun}
                    onResend={handleResend}
                    dismissing={dismissing}
                    running={running}
                    resending={resending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task Row ──────────────────────────────────────────────────────────────

function TaskRow({ task, onDismiss, onEdit, onRun, onResend, dismissing, running, resending }: {
  task: AgentTask;
  onDismiss: (id: string) => void;
  onEdit: (task: AgentTask) => void;
  onRun: (id: string) => void;
  onResend: (id: string) => void;
  dismissing: string | null;
  running: string | null;
  resending: string | null;
}) {
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = STATUS_CONFIG[task.status];
  const coachMeta = COACH_META.find((c) => c.key === task.coachKey);
  const ctx = (task.context ?? {}) as Record<string, unknown>;
  const title = (ctx.title as string) || TASK_TYPE_LABELS[task.taskType] || task.taskType;
  const isRunnable = task.taskType === "ea_briefing" || task.taskType === "status_report_collection";
  const isRunning = running === task.id;
  const isResending = resending === task.id;

  return (
    <div className="flex items-start gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/30 transition-colors group">
      <div className="pt-0.5">
        <CoachIcon name={coachMeta?.icon} size={16} className="text-[var(--accent)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-[var(--text)] truncate">{title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)]">
            {TASK_TYPE_LABELS[task.taskType]}
          </span>
          {task.repeatInterval && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] flex items-center gap-0.5">
              <Repeat size={9} /> {formatRepeat(task.repeatInterval)}
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusColor}`}>
            <StatusIcon size={9} /> {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] flex-wrap">
          <span className="flex items-center gap-1">
            <Clock size={10} /> {formatDate(task.triggerAt)}
          </span>
          {task.lastTriggeredAt && (
            <span className="flex items-center gap-1">
              <Zap size={10} /> Last: {formatDate(task.lastTriggeredAt)}
            </span>
          )}
          {coachMeta && <span>{coachMeta.name}</span>}
          {task.conversationId && (
            <a
              href={`/dashboard?conv=${task.conversationId}`}
              className="flex items-center gap-0.5 text-[var(--accent)] hover:underline"
            >
              <MessageSquare size={10} /> View conversation <ChevronRight size={9} />
            </a>
          )}
          {isRunnable && task.latestArtifactId && (
            <a
              href={`/artifacts/${task.latestArtifactId}`}
              className="flex items-center gap-0.5 text-emerald-400 hover:underline"
            >
              <FileText size={10} />
              {task.artifactCount ?? 0} {task.artifactCount === 1 ? "run" : "runs"} <ChevronRight size={9} />
            </a>
          )}
          {isRunnable && !task.latestArtifactId && (
            <span className="flex items-center gap-0.5 text-[var(--text-muted)]">
              <FileText size={10} /> No runs yet
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Edit */}
        <button
          onClick={() => onEdit(task)}
          title="Edit"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] transition-colors opacity-0 group-hover:opacity-100"
        >
          <Pencil size={12} />
        </button>

        {/* Run now — only for ea_briefing and status_report_collection */}
        {isRunnable && task.status !== "dismissed" && (
          <button
            onClick={() => onRun(task.id)}
            disabled={isRunning || isResending}
            title="Run now — generates new content and emails you"
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
          >
            {isRunning ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
            {isRunning ? "Running…" : "Run now"}
          </button>
        )}

        {/* Resend email — only when there's an artifact to link to */}
        {isRunnable && task.latestArtifactId && task.status !== "dismissed" && (
          <button
            onClick={() => onResend(task.id)}
            disabled={isResending || isRunning}
            title="Resend email with link to last run"
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/30 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
          >
            {isResending ? <RefreshCw size={10} className="animate-spin" /> : <Mail size={10} />}
            {isResending ? "Sending…" : "Resend"}
          </button>
        )}

        {/* Dismiss */}
        {task.status === "pending" && (
          <button
            onClick={() => onDismiss(task.id)}
            disabled={dismissing === task.id}
            className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-40"
          >
            {dismissing === task.id ? "..." : "Dismiss"}
          </button>
        )}
      </div>
    </div>
  );
}
