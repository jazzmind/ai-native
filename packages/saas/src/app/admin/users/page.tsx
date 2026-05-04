"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Building,
  Loader2,
  ChevronDown,
  ChevronRight,
  Key,
  MessageSquare,
  Clock,
  Shield,
  AlertTriangle,
} from "lucide-react";

interface OrgMember {
  userId: string;
  role: string;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string | null;
  monthlyMessageCount: number;
  createdAt: string | null;
  members: OrgMember[];
  totalMessages: number;
  messagesLast7Days: number;
  lastActiveAt: string | null;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string | null;
  monthlyMessageCount: number;
  createdAt: string | null;
  members: Array<{ userId: string; role: string }>;
  stats: {
    hasApiKey: boolean;
    conversationCount: number;
    messageCount: number;
    messagesLast30Days: number;
    lastActiveAt: string | null;
  };
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-600",
  pro: "bg-blue-600",
  team: "bg-purple-600",
};

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function AdminUsersPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load users");
        return r.json();
      })
      .then((data) => setOrgs(data.organizations || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(orgId: string) {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      setOrgDetail(null);
      return;
    }
    setExpandedOrg(orgId);
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/admin/users?orgId=${orgId}`);
      if (!r.ok) throw new Error("Failed to load details");
      const data = await r.json();
      setOrgDetail(data);
    } catch {
      setOrgDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function updatePlan(orgId: string, plan: string) {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, plan }),
      });
      if (!r.ok) throw new Error("Failed to update");
      setOrgs((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, plan } : o))
      );
      setEditingPlan(null);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-6">
        <Users size={24} className="text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--text)]">User Management</h1>
        <span className="ml-auto text-sm text-[var(--text-muted)]">
          {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
          <Building size={40} className="mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-muted)]">No organizations yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => {
            const isExpanded = expandedOrg === org.id;
            const daysInactive = org.lastActiveAt
              ? Math.floor((Date.now() - new Date(org.lastActiveAt).getTime()) / 86400000)
              : null;
            const isChurnRisk = daysInactive !== null && daysInactive > 14 && org.totalMessages > 0;

            return (
              <div key={org.id} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(org.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text)] truncate">
                        {org.name}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${PLAN_COLORS[org.plan] || "bg-gray-600"} text-white`}>
                        {org.plan}
                      </span>
                      {isChurnRisk && (
                        <span aria-label="Churn risk"><AlertTriangle size={14} className="text-amber-400" /></span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {org.members.map((m) => m.userId).join(", ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <MessageSquare size={12} />
                        <span>{org.totalMessages}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {org.messagesLast7Days} last 7d
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Clock size={12} />
                        <span>{timeSince(org.lastActiveAt)}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Joined {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-5 py-4">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
                      </div>
                    ) : orgDetail ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <StatMini label="Conversations" value={orgDetail.stats.conversationCount} />
                          <StatMini label="Messages (total)" value={orgDetail.stats.messageCount} />
                          <StatMini label="Messages (30d)" value={orgDetail.stats.messagesLast30Days} />
                          <StatMini
                            label="API Key"
                            value={orgDetail.stats.hasApiKey ? "Active" : "None"}
                            valueColor={orgDetail.stats.hasApiKey ? "text-emerald-400" : "text-[var(--text-muted)]"}
                            icon={<Key size={12} />}
                          />
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                            Members
                          </div>
                          <div className="space-y-1">
                            {orgDetail.members.map((m) => (
                              <div key={m.userId} className="flex items-center gap-2 text-sm">
                                <span className="text-[var(--text)]">{m.userId}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                                  {m.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                          <span className="text-xs text-[var(--text-muted)]">Plan:</span>
                          {editingPlan === org.id ? (
                            <div className="flex items-center gap-2">
                              {["free", "pro", "team"].map((p) => (
                                <button
                                  key={p}
                                  disabled={saving}
                                  onClick={() => updatePlan(org.id, p)}
                                  className={`text-xs px-2 py-1 rounded font-semibold transition-colors ${
                                    p === org.plan
                                      ? "bg-[var(--accent)] text-white"
                                      : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                              <button
                                onClick={() => setEditingPlan(null)}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] ml-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingPlan(org.id)}
                              className="text-xs text-[var(--accent)] hover:underline"
                            >
                              Change plan
                            </button>
                          )}
                          <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                            ID: {org.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-400">Failed to load details</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: number | string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1 mt-1">
        {icon}
        <p className={`text-lg font-bold ${valueColor || "text-[var(--text)]"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
