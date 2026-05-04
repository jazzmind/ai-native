"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Hash, FileText, ExternalLink } from "lucide-react";

interface Artifact {
  id: string;
  taskId: string;
  title: string;
  content: string;
  artifactType: string;
  runNumber: number;
  createdAt: string;
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown renderer: headers, bold, lists, paragraphs
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold text-[var(--text)] mt-5 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-semibold text-[var(--text)] mt-6 mb-2 border-b border-[var(--border)] pb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-[var(--text)] mt-6 mb-3">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="text-sm text-[var(--text-muted)] ml-4 list-disc leading-relaxed">{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} className="text-sm text-[var(--text-muted)] ml-4 list-decimal leading-relaxed">{renderInline(line.replace(/^\d+\. /, ""))}</li>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-[var(--border)] my-4" />);
    } else {
      elements.push(<p key={i} className="text-sm text-[var(--text-muted)] leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-[var(--text)]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="bg-[var(--bg-tertiary)] px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function ArtifactPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/artifacts/${id}`)}`);
      return;
    }
    if (status !== "authenticated") return;

    async function load() {
      try {
        const res = await fetch(`/api/artifacts/${id}`);
        if (res.status === 404) {
          setError("Artifact not found");
          return;
        }
        if (!res.ok) throw new Error("Failed to load artifact");
        setArtifact(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-[var(--text-muted)] text-sm">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] text-sm mb-4">{error}</p>
          <Link href="/actions" className="text-[var(--accent)] text-sm hover:underline">← Back to Actions</Link>
        </div>
      </div>
    );
  }

  if (!artifact) return null;

  const createdAt = new Date(artifact.createdAt);
  const dateStr = createdAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const typeLabel = artifact.artifactType === "briefing" ? "Briefing" : "Status Report";

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/actions"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Actions
        </Link>

        {/* Header card */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                  {typeLabel}
                </span>
              </div>
              <h1 className="text-xl font-bold text-[var(--text)] mb-3">{artifact.title}</h1>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {dateStr} at {timeStr}
                </span>
                <span className="flex items-center gap-1">
                  <Hash size={12} />
                  Run #{artifact.runNumber}
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={12} />
                  {artifact.content.length.toLocaleString()} chars
                </span>
              </div>
            </div>
            <Link
              href="/actions"
              className="flex-shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <ExternalLink size={12} />
              All actions
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
          <MarkdownContent content={artifact.content} />
        </div>
      </div>
    </div>
  );
}
