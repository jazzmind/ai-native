"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Cloud, Server, CheckCircle, XCircle, AlertCircle, Loader2, Rocket } from "lucide-react";

interface Target {
  id: string;
  type: string;
  name: string;
  status: string;
  lastDeployedAt: string | null;
  agentState: Record<string, any>;
}

const STATUS_ICONS: Record<string, any> = {
  deployed: { Icon: CheckCircle, color: "text-emerald-400" },
  deploying: { Icon: Loader2, color: "text-blue-400 animate-spin" },
  error: { Icon: XCircle, color: "text-red-400" },
  configured: { Icon: AlertCircle, color: "text-yellow-400" },
  unconfigured: { Icon: AlertCircle, color: "text-[var(--text-muted)]" },
};

const TYPE_LABELS: Record<string, { label: string; Icon: any }> = {
  cma: { label: "Claude Managed Agents", Icon: Cloud },
  busibox: { label: "Busibox", Icon: Server },
};

export default function AdminDashboard() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/targets")
      .then(r => r.json())
      .then(setTargets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const agentCount = (t: Target) => Object.keys(t.agentState?.agents || {}).length;

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Admin Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage deployment targets and agent configuration</p>
        </div>
        <Link href="/admin/setup"
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors">
          <Plus size={16} /> Add Target
        </Link>
      </div>

      {loading && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin" />
          <div className="text-sm">Loading targets...</div>
        </div>
      )}

      {!loading && targets.length === 0 && (
        <div className="text-center py-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
          <Rocket size={40} className="mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
          <h2 className="text-lg font-semibold text-[var(--text)] mb-2">No deployment targets configured</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4 max-w-md mx-auto">
            Add a deployment target to deploy your coach agents to Claude Managed Agents or Busibox.
          </p>
          <Link href="/admin/setup"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold">
            <Plus size={16} /> Set up your first target
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {targets.map(t => {
          const typeInfo = TYPE_LABELS[t.type] || { label: t.type, Icon: Server };
          const statusInfo = STATUS_ICONS[t.status] || STATUS_ICONS.unconfigured;
          return (
            <Link key={t.id} href={`/admin/targets/${t.id}`}
              className="block bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <typeInfo.Icon size={20} className="text-[var(--text-muted)]" />
                  <div>
                    <div className="text-sm font-bold text-[var(--text)]">{t.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{typeInfo.label}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-muted)]">{agentCount(t)} agents</div>
                    {t.lastDeployedAt && (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Last deployed: {new Date(t.lastDeployedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <statusInfo.Icon size={16} className={statusInfo.color} />
                    <span className={`text-xs font-semibold ${statusInfo.color}`}>{t.status}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
    </div>
  );
}
