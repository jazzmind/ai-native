"use client";

import { useState } from "react";
import { X, Send, Copy, Check } from "lucide-react";

interface RequestReviewDialogProps {
  conversationId: string;
  messageId?: number;
  onClose: () => void;
}

export function RequestReviewDialog({ conversationId, messageId, onClose }: RequestReviewDialogProps) {
  const [expertEmail, setExpertEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!expertEmail.trim() || !question.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          conversationId,
          expertEmail,
          question,
          messageId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviewUrl(window.location.origin + data.reviewUrl);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (reviewUrl) {
      navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Request Expert Review</h2>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {!reviewUrl ? (
            <>
              <div className="mb-4">
                <label className="text-xs text-[var(--text-muted)] block mb-1">Expert Email</label>
                <input
                  value={expertEmail}
                  onChange={(e) => setExpertEmail(e.target.value)}
                  placeholder="expert@example.com"
                  type="email"
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs text-[var(--text-muted)] block mb-1">What do you need reviewed?</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Please review the tax analysis and confirm the R&D credit calculations..."
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                  rows={3}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !expertEmail.trim() || !question.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                <Send size={14} /> {submitting ? "Creating..." : "Send Review Request"}
              </button>
              <p className="text-[10px] text-[var(--text-muted)] mt-2">
                The expert will receive a link to view this conversation and add inline comments.
                Access expires after 7 days.
              </p>
            </>
          ) : (
            <div>
              <p className="text-sm mb-3">Review request created. Share this link with the expert:</p>
              <div className="flex gap-2">
                <input
                  value={reviewUrl}
                  readOnly
                  className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-2">
                Once SMTP is configured, an email notification will also be sent automatically.
              </p>
              <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
