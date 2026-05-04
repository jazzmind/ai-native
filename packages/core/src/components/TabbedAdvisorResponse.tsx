"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { UserPlus } from "lucide-react";
import { CoachIcon } from "./CoachIcon";
import { ActivityLog, type ActivityItem } from "./ActivityLog";
import { FeedbackButtons, type FeedbackPayload } from "./FeedbackButtons";
import { CopyButtons } from "./CopyButtons";
import type { CoachIconName } from "../coaches/index";

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--text-muted)]">{children}</em>,
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
    <th className="text-left px-2 py-1.5 font-semibold text-[var(--text-muted)]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border-b border-[var(--border)]">{children}</td>
  ),
};

export interface AdvisorTab {
  coachKey: string;
  coachName: string;
  coachIcon?: CoachIconName | string;
  content: string;
  isLead?: boolean;
  isStreaming?: boolean;
  activity?: ActivityItem[];
  messageId?: number;
}

interface TabbedAdvisorResponseProps {
  advisorTabs: AdvisorTab[];
  synthesis: {
    content: string;
    leadKey: string;
    leadName: string;
    leadIcon?: CoachIconName | string;
    isStreaming: boolean;
    messageId?: number;
  } | null;
  conversationId?: string;
  mode?: string | null;
  /** Called when user clicks thumbs up/down. Apps provide their own implementation. */
  onFeedback?: (payload: FeedbackPayload) => Promise<void>;
  /** Optional slot for requesting expert review (SaaS-specific feature). */
  onRequestReview?: (conversationId: string, messageId: number) => void;
}

export function TabbedAdvisorResponse({
  advisorTabs,
  synthesis,
  conversationId,
  mode,
  onFeedback,
  onRequestReview,
}: TabbedAdvisorResponseProps) {
  const [activeTab, setActiveTab] = useState<string>("synthesis");

  const showSynthesis = activeTab === "synthesis" && synthesis;
  const activeAdvisor = advisorTabs.find((t) => t.coachKey === activeTab);

  const wordCount = (text: string) => {
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  };

  const displayContent = showSynthesis ? synthesis.content : activeAdvisor?.content || "";
  const displayStreaming = showSynthesis ? synthesis.isStreaming : activeAdvisor?.isStreaming || false;
  const displayActivity = activeAdvisor?.activity;
  const displayMessageId = showSynthesis ? synthesis.messageId : activeAdvisor?.messageId;
  const displayCoachKey = showSynthesis ? "synthesis" : activeAdvisor?.coachKey;

  return (
    <div className="flex justify-start mb-4 group">
      <div className="max-w-[85%] w-full">
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 mb-0.5 ml-1 overflow-x-auto scrollbar-none">
          {synthesis && (
            <button
              onClick={() => setActiveTab("synthesis")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors whitespace-nowrap ${
                activeTab === "synthesis"
                  ? "bg-yellow-950/20 border-yellow-500/40 text-yellow-300"
                  : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <CoachIcon name={synthesis.leadIcon} size={12} />
              <span>Synthesis</span>
              {synthesis.isStreaming && (
                <span
                  className="text-yellow-400"
                  style={{ animation: "pulse-dot 1.5s infinite" }}
                >
                  ●
                </span>
              )}
            </button>
          )}

          {advisorTabs.map((tab) => (
            <button
              key={tab.coachKey}
              onClick={() => setActiveTab(tab.coachKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors whitespace-nowrap ${
                activeTab === tab.coachKey
                  ? tab.isLead
                    ? "bg-[var(--bg-tertiary)] border-[var(--accent)]/40 text-[var(--accent)]"
                    : "bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text)]"
                  : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <CoachIcon name={tab.coachIcon} size={12} />
              <span>{tab.coachName?.replace(/ (Coach|Advisor)$/, "")}</span>
              {tab.isLead && (
                <span className="text-[9px] bg-[var(--accent)]/20 text-[var(--accent)] px-1 rounded-full">
                  lead
                </span>
              )}
              {tab.isStreaming ? (
                <span
                  className="text-[var(--accent)]"
                  style={{ animation: "pulse-dot 1.5s infinite" }}
                >
                  ●
                </span>
              ) : tab.content ? (
                <span className="text-[10px] text-[var(--text-muted)]">{wordCount(tab.content)}w</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div
          className={`rounded-2xl rounded-tl-none px-4 py-3 text-sm border ${
            showSynthesis
              ? "bg-yellow-950/20 border-yellow-500/40"
              : "bg-[var(--bg-tertiary)] border-[var(--border)]"
          }`}
        >
          {mode && (
            <div className="mb-2">
              <span className="text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
                {mode}
              </span>
            </div>
          )}

          {displayContent ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {displayContent}
            </ReactMarkdown>
          ) : displayStreaming ? (
            <span
              className="inline-block text-[var(--text-muted)]"
              style={{ animation: "pulse-dot 1.5s infinite" }}
            >
              ●●●
            </span>
          ) : null}

          {displayActivity && displayActivity.length > 0 && (
            <ActivityLog activity={displayActivity} />
          )}

          {!displayStreaming && displayContent && displayMessageId && conversationId && (
            <div className="mt-2 pt-1.5 border-t border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between">
              <div className="flex items-center gap-1">
                {onFeedback && (
                  <FeedbackButtons
                    messageId={displayMessageId}
                    conversationId={conversationId}
                    coachKey={displayCoachKey}
                    mode={mode}
                    onSubmit={onFeedback}
                  />
                )}
                <CopyButtons content={displayContent} />
              </div>
              {onRequestReview && (
                <button
                  onClick={() => onRequestReview(conversationId, displayMessageId)}
                  className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-purple-400 transition-colors"
                  title="Request expert review"
                >
                  <UserPlus size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
