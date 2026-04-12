"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Brain, Download, FileText, FileCode, FileType } from "lucide-react";
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
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

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

  const handleExtractKnowledge = async () => {
    if (!activeConversation || !activeProject || extracting) return;
    setExtracting(true);
    setExtractionResult(null);
    try {
      const res = await fetch("/api/conversations/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation,
          projectId: activeProject.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractionResult(`Error: ${data.error || "Extraction failed"}`);
      } else {
        const factCount = data.facts?.length || 0;
        const knowledgeCount = data.knowledge?.length || 0;
        if (factCount === 0 && knowledgeCount === 0) {
          setExtractionResult("No new knowledge found in this thread");
        } else {
          const parts: string[] = [];
          if (factCount > 0) parts.push(`${factCount} profile fact${factCount !== 1 ? "s" : ""}`);
          if (knowledgeCount > 0) parts.push(`${knowledgeCount} knowledge item${knowledgeCount !== 1 ? "s" : ""}`);
          setExtractionResult(`Learned ${parts.join(", ")}`);
        }
      }
    } catch {
      setExtractionResult("Error: extraction failed");
    } finally {
      setExtracting(false);
      setTimeout(() => setExtractionResult(null), 5000);
    }
  };

  const handleExport = async (format: "markdown" | "html" | "docx") => {
    if (!activeConversation || exporting) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const res = await fetch("/api/conversations/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversation, format }),
      });
      if (!res.ok) {
        console.error("Export failed:", await res.text());
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `conversation.${format === "docx" ? "docx" : format === "html" ? "html" : "md"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
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
          <>
            <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
              {conversations.find((c) => c.id === activeConversation)?.title || "Untitled"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExtractKnowledge}
                disabled={extracting}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-purple-400 disabled:opacity-50 transition-colors"
                title="Extract knowledge and profile facts from this thread"
              >
                {extracting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Brain size={12} />
                )}
                {extracting ? "Extracting..." : "Extract Knowledge"}
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-blue-400 disabled:opacity-50 transition-colors"
                  title="Export this thread"
                >
                  {exporting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[140px]">
                    <button
                      onClick={() => handleExport("docx")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors rounded-t-lg"
                    >
                      <FileType size={12} />
                      Word (.docx)
                    </button>
                    <button
                      onClick={() => handleExport("markdown")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <FileText size={12} />
                      Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExport("html")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors rounded-b-lg"
                    >
                      <FileCode size={12} />
                      HTML (.html)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {extractionResult && (
              <span className={`text-[11px] px-2 py-1 rounded-full ${
                extractionResult.startsWith("Error")
                  ? "bg-red-900/20 text-red-400"
                  : extractionResult.startsWith("No new")
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                    : "bg-purple-900/20 text-purple-400"
              }`}>
                {extractionResult}
              </span>
            )}
          </>
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
