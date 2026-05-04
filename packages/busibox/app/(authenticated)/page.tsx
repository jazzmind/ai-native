import Link from "next/link";
import { Brain, MessageSquare, FolderOpen, ArrowRight } from "lucide-react";
import { COACH_META } from "@ai-native/core";

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
          <Brain size={24} className="text-[var(--accent)]" />
          AI Advisory Team
        </h1>
        <p className="text-[var(--text-muted)] mt-1">
          Your AI executive advisory board powered by local LLM infrastructure
        </p>
      </div>

      {/* Quick start */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/chat"
          className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition-colors group"
        >
          <MessageSquare size={20} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              Start Conversation
            </div>
            <div className="text-sm text-[var(--text-muted)] mt-0.5">
              Talk to your advisors — auto-routed or pick specific experts
            </div>
          </div>
          <ArrowRight size={16} className="text-[var(--accent)] ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          href="/projects"
          className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors group"
        >
          <FolderOpen size={20} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-[var(--text)]">Projects</div>
            <div className="text-sm text-[var(--text-muted)] mt-0.5">
              Organize conversations by project or context
            </div>
          </div>
          <ArrowRight size={16} className="text-[var(--text-muted)] ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      {/* Advisor team overview */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Your Advisory Team
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {COACH_META.map((coach) => (
            <Link
              key={coach.key}
              href={`/chat?advisor=${coach.key}`}
              className="flex flex-col gap-1 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent)]/40 transition-colors group"
            >
              <div className="text-xs font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {coach.name.replace(/ (Advisor)$/, "")}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                {coach.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
