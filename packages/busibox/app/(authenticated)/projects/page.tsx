"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Plus } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => {
        setConversations(d.conversations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <FolderOpen size={20} className="text-[var(--accent)]" />
          Projects & Conversations
        </h1>
        <a
          href="/chat"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={14} />
          New Conversation
        </a>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-muted)] p-4">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] p-4">
          No conversations yet. Start a new one with your advisors.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {conversations.map((conv) => (
            <a
              key={conv.id}
              href={`/chat?conversation=${conv.id}`}
              className="flex items-center gap-3 py-3 hover:text-[var(--accent)] transition-colors"
            >
              <FolderOpen size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              <span className="flex-1 text-sm text-[var(--text)]">{conv.title}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(conv.updatedAt).toLocaleDateString()}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
