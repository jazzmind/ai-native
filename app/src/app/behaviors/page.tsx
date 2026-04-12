"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useProject } from "@/components/ProjectContext";
import { COACH_META } from "@/lib/coaches";
import {
  Plus, Trash2, Check, X, Edit2, ToggleLeft, ToggleRight,
  Brain, AlertTriangle, CheckCircle, XCircle,
} from "lucide-react";
import { CoachIcon } from "@/components/CoachIcon";

interface Behavior {
  id: string;
  coach_key: string;
  directive: string;
  is_active: number;
  source: string;
  created_at: string;
}

interface Revision {
  id: string;
  coach_key: string;
  status: string;
  analysis: string;
  proposed_directive: string;
  created_at: string;
}

export default function BehaviorsPage() {
  const { data: session } = useSession();
  const { activeProject } = useProject();
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string | "all">("all");
  const [newDirective, setNewDirective] = useState("");
  const [newCoachKey, setNewCoachKey] = useState(COACH_META[0]?.key || "");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    if (!activeProject) return;
    const coachParam = selectedCoach !== "all" ? `&coachKey=${selectedCoach}` : "";

    const [bRes, rRes] = await Promise.all([
      fetch(`/api/behaviors?projectId=${activeProject.id}${coachParam}`),
      fetch(`/api/behaviors?projectId=${activeProject.id}&type=revisions&status=proposed`),
    ]);

    if (bRes.ok) {
      const data = await bRes.json();
      setBehaviors(data.behaviors || []);
    }
    if (rRes.ok) {
      const data = await rRes.json();
      setRevisions(data.revisions || []);
    }
  }, [activeProject, selectedCoach]);

  useEffect(() => { load(); }, [load]);

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  const handleCreate = async () => {
    if (!newDirective.trim() || !activeProject) return;
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        coachKey: newCoachKey,
        projectId: activeProject.id,
        directive: newDirective,
      }),
    });
    setNewDirective("");
    setShowAdd(false);
    load();
  };

  const handleToggle = async (b: Behavior) => {
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: b.id, is_active: b.is_active ? 0 : 1 }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  };

  const handleSaveEdit = async (id: string) => {
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, directive: editText }),
    });
    setEditingId(null);
    load();
  };

  const handleApproveRevision = async (r: Revision) => {
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve_revision",
        revisionId: r.id,
        projectId: activeProject?.id,
        coachKey: r.coach_key,
        directive: r.proposed_directive,
      }),
    });
    load();
  };

  const handleRejectRevision = async (r: Revision) => {
    await fetch("/api/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_revision", revisionId: r.id }),
    });
    load();
  };

  const getCoachName = (key: string) => COACH_META.find((c) => c.key === key)?.name || key;
  const getCoachIcon = (key: string) => COACH_META.find((c) => c.key === key)?.icon;

  return (
    <div className="max-w-4xl mx-auto p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain size={24} /> Behavioral Directives
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Customize how each advisor behaves in this project. Directives are injected into every conversation.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={14} /> Add Directive
        </button>
      </div>

      {/* Coach filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCoach("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedCoach === "all"
              ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
              : "text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
          }`}
        >
          All Advisors
        </button>
        {COACH_META.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCoach(c.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCoach === c.key
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                : "text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            <CoachIcon name={c.icon} size={12} />
            {c.name.replace(" Coach", "")}
          </button>
        ))}
      </div>

      {/* Pending revisions */}
      {revisions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-400" />
            Proposed Changes ({revisions.length})
          </h2>
          <div className="space-y-3">
            {revisions.map((r) => (
              <div key={r.id} className="border border-yellow-500/30 bg-yellow-950/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CoachIcon name={getCoachIcon(r.coach_key)} size={14} />
                  <span className="text-sm font-medium">{getCoachName(r.coach_key)}</span>
                  <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                    AI proposed
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">{r.analysis}</p>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm mb-3">
                  {r.proposed_directive}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRevision(r)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button
                    onClick={() => handleRejectRevision(r)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition-colors"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add directive form */}
      {showAdd && (
        <div className="border border-[var(--border)] rounded-xl p-4 mb-6 bg-[var(--bg-secondary)]">
          <div className="flex gap-3 mb-3">
            <select
              value={newCoachKey}
              onChange={(e) => setNewCoachKey(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              {COACH_META.map((c) => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
          </div>
          <textarea
            value={newDirective}
            onChange={(e) => setNewDirective(e.target.value)}
            placeholder="e.g., Always include cost estimates in Australian dollars..."
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)] min-h-[60px] mb-3"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newDirective.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              <Check size={14} /> Save
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewDirective(""); }}
              className="flex items-center gap-1 px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active directives */}
      {behaviors.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No behavioral directives yet.</p>
          <p className="text-xs mt-1">Add directives to customize how advisors respond in this project.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {behaviors.map((b) => (
            <div
              key={b.id}
              className={`border rounded-xl p-3 transition-colors ${
                b.is_active
                  ? "border-[var(--border)] bg-[var(--bg-secondary)]"
                  : "border-[var(--border)] bg-[var(--bg-secondary)] opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <CoachIcon name={getCoachIcon(b.coach_key)} size={14} />
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {getCoachName(b.coach_key)}
                  </span>
                  {b.source !== "manual" && (
                    <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">
                      {b.source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(b)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    title={b.is_active ? "Disable" : "Enable"}
                  >
                    {b.is_active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingId(b.id); setEditText(b.directive); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {editingId === b.id ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                    rows={2}
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => handleSaveEdit(b.id)}
                      className="text-xs px-2 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-1 text-[var(--text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm mt-1.5">{b.directive}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
