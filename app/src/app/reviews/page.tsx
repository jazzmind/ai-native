"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react";

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

const STATUS_BADGE: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: "text-yellow-400 bg-yellow-500/20" },
  in_review: { icon: MessageSquare, color: "text-blue-400 bg-blue-500/20" },
  completed: { icon: CheckCircle, color: "text-green-400 bg-green-500/20" },
  expired: { icon: XCircle, color: "text-red-400 bg-red-500/20" },
};

export default function ReviewsPage() {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {});
  }, []);

  if (!session) {
    return <div className="p-8 text-[var(--text-muted)]">Please sign in.</div>;
  }

  const activeReviews = reviews.filter((r) => r.status === "pending" || r.status === "in_review");
  const completedReviews = reviews.filter((r) => r.status === "completed" || r.status === "expired");

  return (
    <div className="max-w-4xl mx-auto p-8 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
        <MessageSquare size={24} /> Expert Reviews
      </h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Track review requests sent to external experts.
      </p>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No review requests yet.</p>
          <p className="text-xs mt-1">
            Request a review from any conversation by clicking the review button on a message.
          </p>
        </div>
      ) : (
        <>
          {activeReviews.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">Active ({activeReviews.length})</h2>
              <div className="space-y-2">
                {activeReviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </div>
          )}

          {completedReviews.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">Past ({completedReviews.length})</h2>
              <div className="space-y-2">
                {completedReviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const badge = STATUS_BADGE[review.status] || STATUS_BADGE.pending;
  const BadgeIcon = badge.icon;
  const reviewUrl = `/review/${review.access_token}`;

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
            <BadgeIcon size={10} />
            {review.status}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{review.expert_email}</span>
        </div>
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
        >
          <ExternalLink size={10} /> View
        </a>
      </div>
      <p className="text-sm mb-1">{review.question}</p>
      <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
        <span>Created: {new Date(review.created_at).toLocaleDateString()}</span>
        <span>Expires: {new Date(review.expires_at).toLocaleDateString()}</span>
        {review.completed_at && (
          <span>Completed: {new Date(review.completed_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
