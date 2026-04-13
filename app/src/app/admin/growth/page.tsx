"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  MessageSquare,
  AlertTriangle,
  Key,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  UserPlus,
  Zap,
  Target,
} from "lucide-react";

interface GrowthData {
  overview: {
    totalUsers: number;
    signupsLast7Days: number;
    signupsLast30Days: number;
    activeConversationsLast7Days: number;
    activeConversationsLast30Days: number;
    totalConversations: number;
    totalMessages: number;
    messagesLast7Days: number;
    messagesLast30Days: number;
    activeApiKeys: number;
  };
  signupFunnel: Record<string, number>;
  eventBreakdown: Array<{ event: string; count: number }>;
  dailyActivity: Array<{ date: string; messages: number }>;
  churn: {
    atRiskOrgs: number;
    candidates: Array<{ orgId: string; lastActive: string }>;
  };
  engagement: {
    topOrgs: Array<{ orgId: string; totalMessages: number }>;
    distribution: {
      power: number;
      active: number;
      casual: number;
      trial: number;
    };
  };
}

const EVENT_LABELS: Record<string, string> = {
  message_sent: "Messages Sent",
  conversation_created: "Conversations",
  signup_started: "Signup Started",
  signup_email_verified: "Email Verified",
  signup_completed: "Signup Done",
  login: "Logins",
  feedback_given: "Feedback",
  api_key_added: "API Key Added",
  api_key_removed: "API Key Removed",
  project_created: "Projects Created",
  knowledge_extracted: "Knowledge Extracted",
};

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trend.positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--text)]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{title}</p>
      {subtitle && <p className="text-[10px] text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function GrowthDashboardPage() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/growth")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load growth data");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-red-400">{error || "Failed to load"}</p>
      </div>
    );
  }

  const { overview, signupFunnel, eventBreakdown, dailyActivity, churn, engagement } = data;
  const dist = engagement.distribution;
  const totalEngaged = dist.power + dist.active + dist.casual + dist.trial;

  const maxDaily = Math.max(...dailyActivity.map((d) => d.messages), 1);

  return (
    <div className="max-w-6xl mx-auto p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp size={24} className="text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--text)]">Growth Dashboard</h1>
      </div>

      {/* Top-line metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Users"
          value={overview.totalUsers}
          subtitle={`${overview.signupsLast7Days} new this week`}
          icon={Users}
          color="bg-blue-600"
        />
        <MetricCard
          title="Messages (7d)"
          value={overview.messagesLast7Days}
          subtitle={`${overview.messagesLast30Days} in 30d`}
          icon={MessageSquare}
          color="bg-green-600"
        />
        <MetricCard
          title="Active API Keys"
          value={overview.activeApiKeys}
          subtitle="BYO key users"
          icon={Key}
          color="bg-purple-600"
        />
        <MetricCard
          title="Churn Risk"
          value={churn.atRiskOrgs}
          subtitle="Inactive >14d with prior usage"
          icon={AlertTriangle}
          color={churn.atRiskOrgs > 0 ? "bg-amber-600" : "bg-gray-600"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Signup Funnel */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Signup Funnel (30d)</h2>
          </div>
          <div className="space-y-3">
            {[
              { key: "signup_started", label: "Started Signup" },
              { key: "signup_email_verified", label: "Email Verified" },
              { key: "signup_completed", label: "Completed Signup" },
              { key: "login", label: "First Login" },
            ].map((step) => {
              const val = signupFunnel[step.key] || 0;
              const started = signupFunnel.signup_started || 1;
              const pct = started > 0 ? Math.round((val / started) * 100) : 0;
              return (
                <div key={step.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">{step.label}</span>
                    <span className="font-semibold text-[var(--text)]">
                      {val} <span className="text-[var(--text-muted)]">({pct}%)</span>
                    </span>
                  </div>
                  <MiniBar value={val} max={started} color="bg-[var(--accent)]" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Engagement Distribution */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">User Engagement Segments</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: "Power Users", sublabel: "50+ messages", count: dist.power, color: "bg-emerald-500" },
              { label: "Active", sublabel: "10-49 messages", count: dist.active, color: "bg-blue-500" },
              { label: "Casual", sublabel: "3-9 messages", count: dist.casual, color: "bg-amber-500" },
              { label: "Trial", sublabel: "<3 messages", count: dist.trial, color: "bg-red-400" },
            ].map((seg) => (
              <div key={seg.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div>
                    <span className="text-[var(--text)]">{seg.label}</span>
                    <span className="text-[var(--text-muted)] ml-1">({seg.sublabel})</span>
                  </div>
                  <span className="font-semibold text-[var(--text)]">{seg.count}</span>
                </div>
                <MiniBar value={seg.count} max={totalEngaged || 1} color={seg.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Daily Activity Chart (text-based) */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Daily Messages (30d)</h2>
          </div>
          {dailyActivity.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {dailyActivity.slice(-14).map((day) => (
                <div key={day.date} className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] w-16 shrink-0">
                    {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex-1">
                    <MiniBar value={day.messages} max={maxDaily} color="bg-[var(--accent)]" />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] w-8 text-right">{day.messages}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Breakdown */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Event Breakdown (30d)</h2>
          </div>
          {eventBreakdown.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No events tracked yet. Events will appear as users interact with the platform.
            </p>
          ) : (
            <div className="space-y-2">
              {eventBreakdown.slice(0, 12).map((evt) => (
                <div key={evt.event} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">
                    {EVENT_LABELS[evt.event] || evt.event}
                  </span>
                  <span className="font-semibold text-[var(--text)]">{evt.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Churn Risk Details */}
      {churn.atRiskOrgs > 0 && (
        <div className="bg-[var(--bg-secondary)] border border-amber-500/30 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-[var(--text)]">
              Churn Risk — {churn.atRiskOrgs} org{churn.atRiskOrgs !== 1 ? "s" : ""} inactive
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            These organizations had prior usage but haven't sent messages in 14+ days.
          </p>
          <div className="space-y-1">
            {churn.candidates.map((c) => (
              <div key={c.orgId} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text)] font-mono text-xs">{c.orgId.slice(0, 12)}...</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Last active: {new Date(c.lastActive).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
