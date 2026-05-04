"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useProject } from "@/components/ProjectContext";
import { COACH_META } from "@/lib/coaches";
import { AGENT_MODES } from "@/lib/coaches";
import { CoachIcon } from "@/components/CoachIcon";
import Link from "next/link";
import {
  BarChart3, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown,
  Minus, Brain, PieChart, Zap, Clock, ChevronRight, Repeat,
} from "lucide-react";

interface PendingAction {
  id: string;
  taskType: string;
  coachKey: string;
  triggerAt: string;
  repeatInterval: string | null;
  context: { title?: string } | null;
}

interface CoachFeedback {
  coach_key: string;
  mode: string | null;
  up: number;
  down: number;
  total: number;
}

interface TimelineEntry {
  date: string;
  coach_key: string;
  up: number;
  down: number;
}

interface ModeUsage {
  mode: string;
  count: number;
}

interface Revision {
  id: string;
  coach_key: string;
  status: string;
  analysis: string;
  created_at: string;
}

export default function EffectivenessPage() {
  const { data: session } = useSession();
  const { activeProject } = useProject();
  const [byCoach, setByCoach] = useState<CoachFeedback[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [modeUsage, setModeUsage] = useState<ModeUsage[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [days, setDays] = useState(30);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const res = await fetch(`/api/effectiveness?projectId=${activeProject.id}&days=${days}`);
    if (res.ok) {
      const data = await res.json();
      setByCoach(data.byCoach || []);
      setTimeline(data.timeline || []);
      setModeUsage(data.modeUsage || []);
      setRevisions(data.revisions || []);
    }
    const actRes = await fetch(`/api/actions?projectId=${activeProject.id}`);
    if (actRes.ok) {
      const actData = await actRes.json();
      const pending = (actData.tasks || []).filter((t: PendingAction & { status: string }) => t.status === "pending");
      setPendingActions(pending.slice(0, 5));
    }
  }, [activeProject, days]);

  useEffect(() => { load(); }, [load]);

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  // Aggregate by coach
  const coachAggregates = COACH_META.map((coach) => {
    const entries = byCoach.filter((f) => f.coach_key === coach.key);
    const total = entries.reduce((s, e) => s + e.total, 0);
    const up = entries.reduce((s, e) => s + e.up, 0);
    const down = entries.reduce((s, e) => s + e.down, 0);
    const rate = total > 0 ? up / total : 0;
    return { ...coach, total, up, down, rate };
  }).sort((a, b) => b.total - a.total);

  // Mode usage totals
  const totalModeUsage = modeUsage.reduce((s, m) => s + m.count, 0);

  // Overall stats
  const totalFeedback = coachAggregates.reduce((s, c) => s + c.total, 0);
  const totalUp = coachAggregates.reduce((s, c) => s + c.up, 0);
  const totalDown = coachAggregates.reduce((s, c) => s + c.down, 0);

  return (
    <div className="max-w-5xl mx-auto p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} /> Effectiveness
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Track advisor performance across modes and time.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Upcoming Actions widget */}
      {pendingActions.length > 0 && (
        <div className="mb-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Zap size={14} className="text-[var(--accent)]" /> Upcoming Actions
            </h2>
            <Link
              href="/actions"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingActions.map((task) => {
              const coachMeta = COACH_META.find((c) => c.key === task.coachKey);
              const title = task.context?.title || task.taskType.replace(/_/g, " ");
              const triggerDate = new Date(task.triggerAt);
              const now = new Date();
              const diffDays = Math.round((triggerDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const dateLabel = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays < 0 ? "Overdue" : `In ${diffDays}d`;
              return (
                <div key={task.id} className="flex items-center gap-3 text-xs">
                  <CoachIcon name={coachMeta?.icon} size={12} className="text-[var(--accent)] shrink-0" />
                  <span className="flex-1 text-[var(--text)] truncate">{title}</span>
                  {task.repeatInterval && (
                    <Repeat size={10} className="text-[var(--text-muted)] shrink-0" />
                  )}
                  <span className={`shrink-0 flex items-center gap-0.5 ${diffDays < 0 ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                    <Clock size={10} /> {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Total Feedback</div>
          <div className="text-2xl font-bold">{totalFeedback}</div>
          <div className="flex gap-3 mt-1 text-xs">
            <span className="text-green-400 flex items-center gap-0.5">
              <ThumbsUp size={10} /> {totalUp}
            </span>
            <span className="text-red-400 flex items-center gap-0.5">
              <ThumbsDown size={10} /> {totalDown}
            </span>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Satisfaction Rate</div>
          <div className="text-2xl font-bold">
            {totalFeedback > 0 ? `${Math.round((totalUp / totalFeedback) * 100)}%` : "—"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {totalFeedback > 0 ? (
              totalUp / totalFeedback >= 0.7 ? (
                <span className="text-green-400 flex items-center gap-0.5"><TrendingUp size={10} /> Healthy</span>
              ) : (
                <span className="text-yellow-400 flex items-center gap-0.5"><TrendingDown size={10} /> Needs attention</span>
              )
            ) : "No data yet"}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Behavioral Adaptations</div>
          <div className="text-2xl font-bold">{revisions.filter((r) => r.status === "approved").length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {revisions.filter((r) => r.status === "proposed").length} pending review
          </div>
        </div>
      </div>

      {/* Per-advisor breakdown */}
      <h2 className="text-lg font-semibold mb-3">Advisor Performance</h2>
      <div className="space-y-2 mb-8">
        {coachAggregates.map((coach) => {
          const barWidth = coach.total > 0 ? Math.max(coach.rate * 100, 5) : 0;
          return (
            <div
              key={coach.key}
              className="flex items-center gap-3 p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-secondary)]"
            >
              <div className="w-36 flex items-center gap-2">
                <CoachIcon name={coach.icon} size={14} />
                <span className="text-sm font-medium">{coach.name.replace(" Coach", "")}</span>
              </div>
              <div className="flex-1">
                {coach.total > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: coach.rate >= 0.7 ? "#22c55e" : coach.rate >= 0.4 ? "#eab308" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-muted)] w-10 text-right">
                      {Math.round(coach.rate * 100)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Minus size={10} /> No feedback
                  </span>
                )}
              </div>
              <div className="w-24 text-right text-xs text-[var(--text-muted)]">
                {coach.total > 0 && (
                  <span>
                    <span className="text-green-400">{coach.up}</span>
                    {" / "}
                    <span className="text-red-400">{coach.down}</span>
                    {" of "}{coach.total}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mode usage */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <PieChart size={18} /> Mode Usage
      </h2>
      <div className="grid grid-cols-5 gap-3 mb-8">
        {AGENT_MODES.map((mode) => {
          const usage = modeUsage.find((m) => m.mode === mode);
          const count = usage?.count || 0;
          const pct = totalModeUsage > 0 ? Math.round((count / totalModeUsage) * 100) : 0;
          return (
            <div
              key={mode}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 text-center"
            >
              <div className="text-lg font-bold">{pct}%</div>
              <div className="text-xs text-[var(--text-muted)] capitalize">{mode}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{count} messages</div>
            </div>
          );
        })}
      </div>

      {/* Per-coach per-mode breakdown */}
      {byCoach.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Performance by Mode</h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Advisor</th>
                  {AGENT_MODES.map((mode) => (
                    <th key={mode} className="text-center py-2 px-3 text-[var(--text-muted)] font-medium capitalize">{mode}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COACH_META.map((coach) => (
                  <tr key={coach.key} className="border-b border-[var(--border)]">
                    <td className="py-2 px-3 flex items-center gap-1.5">
                      <CoachIcon name={coach.icon} size={12} />
                      {coach.name.replace(" Coach", "")}
                    </td>
                    {AGENT_MODES.map((mode) => {
                      const entry = byCoach.find((f) => f.coach_key === coach.key && f.mode === mode);
                      if (!entry || entry.total === 0) {
                        return <td key={mode} className="text-center py-2 px-3 text-[var(--text-muted)]">—</td>;
                      }
                      const rate = entry.up / entry.total;
                      const color = rate >= 0.7 ? "text-green-400" : rate >= 0.4 ? "text-yellow-400" : "text-red-400";
                      return (
                        <td key={mode} className={`text-center py-2 px-3 ${color}`}>
                          {Math.round(rate * 100)}%
                          <span className="text-[10px] text-[var(--text-muted)] ml-0.5">({entry.total})</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Adaptation log */}
      {revisions.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Brain size={18} /> Adaptation History
          </h2>
          <div className="space-y-2">
            {revisions.map((r) => {
              const coachName = COACH_META.find((c) => c.key === r.coach_key)?.name || r.coach_key;
              const statusColor = r.status === "approved"
                ? "text-green-400 bg-green-500/20"
                : r.status === "rejected"
                  ? "text-red-400 bg-red-500/20"
                  : "text-yellow-400 bg-yellow-500/20";
              return (
                <div key={r.id} className="border border-[var(--border)] rounded-xl p-3 bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{coachName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor}`}>{r.status}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{r.analysis}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {totalFeedback === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No effectiveness data yet.</p>
          <p className="text-xs mt-1">
            Use the thumbs up/down buttons on advisor responses to start tracking performance.
          </p>
        </div>
      )}
    </div>
  );
}
