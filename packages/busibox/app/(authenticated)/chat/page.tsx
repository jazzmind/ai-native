"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Chat } from "@components/Chat";
import { Plus, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialAdvisor = searchParams.get("advisor") ?? undefined;

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => {
        setConversations(d.conversations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConversationCreated = (id: string) => {
    setActiveConvId(id);
    // Add to list if new
    setConversations((prev) => {
      if (prev.some((c) => c.id === id)) return prev;
      return [{ id, title: "New conversation", updatedAt: new Date().toISOString() }, ...prev];
    });
  };

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveConvId(null)}
            className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus size={14} />
            New Conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-2 text-xs text-[var(--text-muted)]">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-2 text-xs text-[var(--text-muted)]">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                  activeConvId === conv.id
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <MessageSquare size={12} className="mt-0.5 flex-shrink-0" />
                <span className="truncate">{conv.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Chat
          conversationId={activeConvId}
          onConversationCreated={handleConversationCreated}
          projectId="default"
          initialAdvisorKey={initialAdvisor}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
