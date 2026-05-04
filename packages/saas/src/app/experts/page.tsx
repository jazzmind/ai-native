"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Users, MessageSquare, Clock, CheckCircle, XCircle, ExternalLink,
  ChevronDown, ChevronRight,
} from "lucide-react";

interface Review {
  id: string;
  conversation_id: string;
  expert_email: string;
  status: string;
  question: string;
  access_token: string;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

interface ExpertSummary {
  email: string;
  total: number;
  completed: number;
  active: number;
  expired: number;
  lastContact: string;
  reviews: Review[];
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", label: "Pending" },
  in_review: { icon: MessageSquare, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "In Review" },
  completed: { icon: CheckCircle, color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Completed" },
  expired: { icon: XCircle, color: "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border)]", label: "Expired" },
};

function groupByExpert(reviews: Review[]): ExpertSummary[] {
  const map = new Map<string, ExpertSummary>();
  for (const r of reviews) {
    const existing = map.get(r.expert_email);
    if (!existing) {
      map.set(r.expert_email, {
        email: r.expert_email,
        total: 1,
        completed: r.status === "completed" ? 1 : 0,
        active: (r.status === "pending" || r.status === "in_review") ? 1 : 0,
        expired: r.status === "expired" ? 1 : 0,
        lastContact: r.created_at,
        reviews: [r],
      });
    } else {
      existing.total++;
      if (r.status === "completed") existing.completed++;
      if (r.status === "pending" || r.status === "in_review") existing.active++;
      if (r.status === "expired") existing.expired++;
      if (new Date(r.created_at) > new Date(existing.lastContact)) {
        existing.lastContact = r.created_at;
      }
      existing.reviews.push(r);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
  );
}

export default function ExpertsPage() {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  const experts = groupByExpert(reviews);
  const activeReviews = reviews.filter((r) => r.status === "pending" || r.status === "in_review");

  const toggleExpand = (email: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-8 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={24} /> Experts
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Human experts in your network and their review history.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Experts in Network</div>
          <div className="text-2xl font-bold">{experts.length}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Total Reviews Sent</div>
          <div className="text-2xl font-bold">{reviews.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {reviews.filter((r) => r.status === "completed").length} completed
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Awaiting Response</div>
          <div className="text-2xl font-bold">{activeReviews.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {activeReviews.filter((r) => r.status === "in_review").length} in review
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">Loading...</div>
      ) : experts.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No experts yet</p>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Request a review from any conversation to add experts to your network. Your advisors can also suggest when expert input would add value.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {experts.map((expert) => {
            const isExpanded = expanded.has(expert.email);
            const completionRate = expert.total > 0 ? Math.round((expert.completed / expert.total) * 100) : 0;

            return (
              <div
                key={expert.email}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(expert.email)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[var(--accent)]">
                      {expert.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">{expert.email}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--text-muted)]">
                      <span>{expert.total} {expert.total === 1 ? "request" : "requests"}</span>
                      {expert.active > 0 && (
                        <span className="text-yellow-400">{expert.active} active</span>
                      )}
                      <span>Last: {new Date(expert.lastContact).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--text)]">{completionRate}%</div>
                      <div className="text-[10px] text-[var(--text-muted)]">completion</div>
                    </div>
                    <div className="flex gap-1.5">
                      {expert.completed > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                          {expert.completed} done
                        </span>
                      )}
                      {expert.active > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                          {expert.active} pending
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight size={14} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
                    {expert.reviews
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((r) => {
                        const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        return (
                          <div key={r.id} className="flex items-start gap-3 py-2">
                            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${cfg.color}`}>
                              <StatusIcon size={9} /> {cfg.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--text)] line-clamp-2">{r.question}</p>
                              <div className="flex gap-3 mt-1 text-[10px] text-[var(--text-muted)]">
                                <span>{new Date(r.created_at).toLocaleDateString()}</span>
                                {r.completed_at && (
                                  <span>Completed: {new Date(r.completed_at).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <a
                              href={`/review/${r.access_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[var(--accent)] hover:underline text-[10px] flex items-center gap-0.5"
                            >
                              <ExternalLink size={10} /> View
                            </a>
                          </div>
                        );
                      })}
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
