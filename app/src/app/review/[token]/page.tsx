"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, Send, CheckCircle, Clock, AlertCircle, User } from "lucide-react";

interface ReviewMessage {
  id: number;
  role: string;
  content: string;
  coach_key: string | null;
  mode: string | null;
  created_at: string;
}

interface ReviewComment {
  id: string;
  author_email: string;
  author_name: string | null;
  content: string;
  parent_message_id: number | null;
  created_at: string;
}

interface ReviewData {
  review: {
    id: string;
    question: string;
    context_summary: string;
    status: string;
    expert_email: string;
    expires_at: string;
    message_id: number | null;
  };
  messages: ReviewMessage[];
  comments: ReviewComment[];
}

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/review-access/${token}`);
    if (!res.ok) {
      setError("Invalid or expired review link.");
      return;
    }
    const d = await res.json();
    setData(d);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const submitComment = async () => {
    if (!commentText.trim() || !data) return;
    setSubmitting(true);
    try {
      await fetch(`/api/reviews/${data.review.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentText,
          authorEmail: data.review.expert_email,
          authorName: authorName || undefined,
          parentMessageId: replyTo || undefined,
        }),
      });
      setCommentText("");
      setReplyTo(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async () => {
    if (!data) return;
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", id: data.review.id, status: "completed" }),
    });
    load();
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg)] flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold mb-2">Review Not Available</h1>
          <p className="text-[var(--text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg)] flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading review...</div>
      </div>
    );
  }

  const isExpired = new Date(data.review.expires_at) < new Date();
  const isCompleted = data.review.status === "completed";
  const isActive = !isExpired && !isCompleted;

  const commentsForMessage = (msgId: number) =>
    data.comments.filter((c) => c.parent_message_id === msgId);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare size={20} /> Expert Review
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {isCompleted && <span className="text-green-400">Completed</span>}
                {isExpired && !isCompleted && <span className="text-red-400">Expired</span>}
                {isActive && <span className="text-yellow-400">Active</span>}
                {" | Expires: "}{new Date(data.review.expires_at).toLocaleDateString()}
              </p>
            </div>
            {isActive && (
              <button
                onClick={markComplete}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                <CheckCircle size={14} /> Mark Complete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* Review question */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--accent)]/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-medium">Review Question</span>
          </div>
          <p className="text-sm">{data.review.question}</p>
        </div>

        {/* Author name (first time) */}
        {!authorName && isActive && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 mb-6">
            <label className="text-xs text-[var(--text-muted)] block mb-1">Your name (for attribution)</label>
            <div className="flex gap-2">
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => setAuthorName(authorName || "Anonymous Expert")}
                className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm"
              >
                Set
              </button>
            </div>
          </div>
        )}

        {/* Conversation thread */}
        <div className="space-y-4">
          {data.messages.map((msg) => {
            const isHighlighted = msg.id === data.review.message_id;
            const msgComments = commentsForMessage(msg.id);

            return (
              <div key={msg.id}>
                <div
                  className={`rounded-xl p-4 ${
                    msg.role === "user"
                      ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20"
                      : isHighlighted
                        ? "bg-yellow-950/30 border-2 border-yellow-500/50"
                        : "bg-[var(--bg-secondary)] border border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-xs text-[var(--text-muted)]">
                    <User size={10} />
                    <span>{msg.role === "user" ? "User" : msg.coach_key || "Assistant"}</span>
                    {msg.mode && <span className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-full">{msg.mode}</span>}
                    {isHighlighted && <span className="text-yellow-400 font-medium">Review requested</span>}
                  </div>
                  <div className="text-sm prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Reply button */}
                  {isActive && authorName && (
                    <button
                      onClick={() => setReplyTo(replyTo === msg.id ? null : msg.id)}
                      className="mt-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      + Add comment on this message
                    </button>
                  )}

                  {replyTo === msg.id && isActive && (
                    <div className="mt-2 flex gap-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Your expert feedback..."
                        className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                        rows={2}
                      />
                      <button
                        onClick={submitComment}
                        disabled={submitting || !commentText.trim()}
                        className="self-end p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expert comments on this message */}
                {msgComments.map((c) => (
                  <div key={c.id} className="ml-6 mt-2 bg-purple-950/20 border border-purple-500/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className="text-purple-400 font-medium">
                        {c.author_name || c.author_email}
                      </span>
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
                        Expert
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* General comment (not linked to specific message) */}
        {isActive && authorName && !replyTo && (
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-medium mb-2">General Comment</h3>
            <div className="flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a general comment on the conversation..."
                className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                rows={3}
              />
              <button
                onClick={submitComment}
                disabled={submitting || !commentText.trim()}
                className="self-end p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
