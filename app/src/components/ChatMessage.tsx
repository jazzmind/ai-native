"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { CoachIcon } from "./CoachIcon";
import { ActivityLog } from "./ActivityLog";
import { FeedbackButtons } from "./FeedbackButtons";
import { CopyButtons } from "./CopyButtons";
import { RequestReviewDialog } from "./RequestReviewDialog";
import type { CoachIconName } from "@/lib/coaches";
import type { ActivityItem } from "./Chat";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-[var(--text-muted)]">{children}</em>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-[#0d0d0d] rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[#1a1a2e] px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 text-[var(--text-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-[var(--border)] my-3" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 underline hover:text-blue-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-[var(--border)]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-2 py-1.5 font-semibold text-[var(--text-muted)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border-b border-[var(--border)]">{children}</td>
  ),
};

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  coachKey?: string | null;
  coachName?: string;
  coachIcon?: CoachIconName | string;
  isLead?: boolean;
  isSynthesis?: boolean;
  isStreaming?: boolean;
  activity?: ActivityItem[];
  messageId?: number;
  conversationId?: string;
  mode?: string | null;
}

export function ChatMessage({
  role,
  content,
  coachKey,
  coachName,
  coachIcon,
  isLead,
  isSynthesis,
  isStreaming,
  activity,
  messageId,
  conversationId,
  mode,
}: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-[var(--accent)] text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  if (role === "system") {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-red-900/20 border border-red-800/30 rounded-2xl px-4 py-3 text-sm text-red-300">
          {content}
        </div>
      </div>
    );
  }

  const borderClass = isSynthesis
    ? "border-yellow-500/40"
    : isLead
      ? "border-[var(--accent)]/40"
      : "border-[var(--border)]";

  const bgClass = isSynthesis ? "bg-yellow-950/20" : "bg-[var(--bg-tertiary)]";

  return (
    <div className="flex justify-start mb-4 group">
      <div className="max-w-[80%]">
        {coachName && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1 ml-1">
            <CoachIcon name={coachIcon} size={12} />
            <span>{coachName}</span>
            {isLead && !isSynthesis && (
              <span className="text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full font-medium">
                lead
              </span>
            )}
            {isSynthesis && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
                synthesis
              </span>
            )}
            {mode && (
              <span className="text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
                {mode}
              </span>
            )}
          </div>
        )}
        <div
          className={`${bgClass} border ${borderClass} rounded-2xl rounded-bl-sm px-4 py-3 text-sm`}
        >
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <span
              className="inline-block text-[var(--text-muted)]"
              style={{ animation: "pulse-dot 1.5s infinite" }}
            >
              ●●●
            </span>
          ) : null}

          {activity && activity.length > 0 && (
            <ActivityLog activity={activity} />
          )}

          {!isStreaming && content && messageId && conversationId && (
            <MessageActions
              messageId={messageId}
              conversationId={conversationId}
              coachKey={coachKey}
              mode={mode}
              content={content}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageActions({ messageId, conversationId, coachKey, mode, content }: {
  messageId: number;
  conversationId: string;
  coachKey?: string | null;
  mode?: string | null;
  content: string;
}) {
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  return (
    <>
      <div className="mt-2 pt-1.5 border-t border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between">
        <div className="flex items-center gap-1">
          <FeedbackButtons
            messageId={messageId}
            conversationId={conversationId}
            coachKey={coachKey}
            mode={mode}
          />
          <CopyButtons content={content} />
        </div>
        <button
          onClick={() => setShowReviewDialog(true)}
          className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-purple-400 transition-colors"
          title="Request expert review"
        >
          <UserPlus size={12} />
        </button>
      </div>
      {showReviewDialog && (
        <RequestReviewDialog
          conversationId={conversationId}
          messageId={messageId}
          onClose={() => setShowReviewDialog(false)}
        />
      )}
    </>
  );
}
