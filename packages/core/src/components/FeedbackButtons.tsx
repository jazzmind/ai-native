"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, X } from "lucide-react";

export interface FeedbackPayload {
  messageId: number;
  conversationId: string;
  rating: "up" | "down";
  coachKey?: string;
  mode?: string;
  comment?: string;
}

interface FeedbackButtonsProps {
  messageId: number;
  conversationId: string;
  coachKey?: string | null;
  mode?: string | null;
  /** Called when the user submits feedback. Apps implement this to call their own API route. */
  onSubmit: (payload: FeedbackPayload) => Promise<void>;
}

export function FeedbackButtons({
  messageId,
  conversationId,
  coachKey,
  mode,
  onSubmit,
}: FeedbackButtonsProps) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async (r: "up" | "down", commentText?: string) => {
    try {
      await onSubmit({
        messageId,
        conversationId,
        rating: r,
        coachKey: coachKey || undefined,
        mode: mode || undefined,
        comment: commentText || undefined,
      });
      setRating(r);
      setSubmitted(true);
      setShowComment(false);
    } catch {
      // silently fail
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
        {rating === "up" ? (
          <ThumbsUp size={10} className="text-green-400" />
        ) : (
          <ThumbsDown size={10} className="text-red-400" />
        )}
        <span>Thanks</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          onClick={() => submit("up")}
          className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-green-400 transition-colors"
          title="Helpful"
        >
          <ThumbsUp size={12} />
        </button>
        <button
          onClick={() => {
            setRating("down");
            setShowComment(true);
          }}
          className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
          title="Not helpful"
        >
          <ThumbsDown size={12} />
        </button>
        {!showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title="Add comment"
          >
            <MessageSquare size={12} />
          </button>
        )}
      </div>

      {showComment && (
        <div className="flex flex-col gap-1 mt-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could be improved?"
            className="text-[11px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5 resize-none focus:outline-none focus:border-[var(--accent)] min-h-[50px]"
            rows={2}
          />
          <div className="flex gap-1">
            <button
              onClick={() => submit(rating || "down", comment)}
              className="text-[10px] px-2 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
            >
              Submit
            </button>
            <button
              onClick={() => {
                setShowComment(false);
                setRating(null);
              }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
