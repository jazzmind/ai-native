"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { Chat } from "@/components/Chat";
import { useProject } from "@/components/ProjectContext";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { activeProject, loading: projectLoading } = useProject();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (!data.complete) {
          router.replace("/onboarding");
        } else {
          setCheckingOnboarding(false);
        }
      })
      .catch(() => setCheckingOnboarding(false));
  }, [router, status]);

  const loadConversations = useCallback(async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/conversations?projectId=${activeProject.id}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      // ignore on initial load
    }
  }, [activeProject]);

  useEffect(() => {
    if (!checkingOnboarding && activeProject) {
      setActiveConversation(null);
      loadConversations();
    }
  }, [loadConversations, checkingOnboarding, activeProject]);

  const handleNewConversation = () => {
    setActiveConversation(null);
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversation(id);
    loadConversations();
  };

  if (status === "loading" || checkingOnboarding || projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-xs font-semibold transition-colors"
        >
          <Plus size={14} />
          New Chat
        </button>
        {activeConversation && (
          <span className="text-xs text-[var(--text-muted)]">
            {conversations.find((c) => c.id === activeConversation)?.title || "Untitled"}
          </span>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeConversation}
          onSelect={(id) => setActiveConversation(id)}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Chat
            conversationId={activeConversation}
            onConversationCreated={handleConversationCreated}
            projectId={activeProject?.id || ""}
          />
        </main>
      </div>
    </div>
  );
}
