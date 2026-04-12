"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  MessageSquare,
  Building,
  Star,
  ShoppingBag,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface AnalyticsData {
  organizations: {
    total: number;
    byPlan: Record<string, number>;
  };
  conversations: { total: number };
  messages: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  marketplace: {
    totalRequests: number;
    completedRequests: number;
  };
  experts: {
    total: number;
    active: number;
  };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-[var(--text)] mt-1">{value}</p>
          {subtitle && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load analytics");
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
        <p className="text-sm text-red-400">{error || "Failed to load data"}</p>
      </div>
    );
  }

  const completionRate =
    data.marketplace.totalRequests > 0
      ? Math.round((data.marketplace.completedRequests / data.marketplace.totalRequests) * 100)
      : 0;

  return (
    <div className="max-w-5xl mx-auto p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 size={24} className="text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--text)]">Platform Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Organizations"
          value={data.organizations.total}
          subtitle={Object.entries(data.organizations.byPlan).map(([plan, count]) => `${plan}: ${count}`).join(", ")}
          icon={Building}
          color="bg-blue-600"
        />
        <StatCard
          title="Messages (30d)"
          value={data.messages.last30Days.toLocaleString()}
          subtitle={`${data.messages.last7Days.toLocaleString()} in last 7 days`}
          icon={MessageSquare}
          color="bg-green-600"
        />
        <StatCard
          title="Marketplace Reviews"
          value={data.marketplace.totalRequests}
          subtitle={`${completionRate}% completion rate`}
          icon={ShoppingBag}
          color="bg-purple-600"
        />
        <StatCard
          title="Experts"
          value={data.experts.active}
          subtitle={`${data.experts.total} total, ${data.experts.active} active`}
          icon={Star}
          color="bg-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Usage Overview</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total Conversations</span>
              <span className="font-semibold text-[var(--text)]">{data.conversations.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total Messages</span>
              <span className="font-semibold text-[var(--text)]">{data.messages.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Avg Messages/Day (7d)</span>
              <span className="font-semibold text-[var(--text)]">
                {Math.round(data.messages.last7Days / 7).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Plans Breakdown</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data.organizations.byPlan).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)] capitalize">{plan}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full"
                      style={{
                        width: `${data.organizations.total > 0 ? (count / data.organizations.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="font-semibold text-[var(--text)] w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
