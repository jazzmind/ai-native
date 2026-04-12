"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  FolderOpen,
  FileText,
  User,
  ChevronRight,
  Globe,
  FolderKanban,
} from "lucide-react";
import { useProject } from "@/components/ProjectContext";

interface KnowledgeDocument {
  id: string;
  collection_id: string;
  title: string;
  content: string;
  source: string;
}

interface Collection {
  id: string;
  name: string;
  documentCount: number;
  description: string;
}

interface ProfileEntry {
  id: number;
  category: string;
  key: string;
  value: string;
  source_conversation: string | null;
  updated_at: string;
}

type Tab = "knowledge" | "profile";
type KnowledgeScope = "project" | "common";

export default function KnowledgePage() {
  const { activeProject } = useProject();
  const [tab, setTab] = useState<Tab>("knowledge");
  const [knowledgeScope, setKnowledgeScope] = useState<KnowledgeScope>("project");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [showIngest, setShowIngest] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestSource, setIngestSource] = useState("");
  const [ingestCollection, setIngestCollection] = useState("default");

  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const [profileEntries, setProfileEntries] = useState<ProfileEntry[]>([]);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newCategory, setNewCategory] = useState("business");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const getProjectParam = () => knowledgeScope === "project" && activeProject ? activeProject.id : "";

  const loadCollections = useCallback(async () => {
    const projectId = knowledgeScope === "project" && activeProject ? activeProject.id : "";
    const res = await fetch(`/api/knowledge?action=collections&projectId=${projectId}`);
    const data = await res.json();
    setCollections(data.collections || []);
  }, [knowledgeScope, activeProject]);

  const loadDocuments = useCallback(async (collection?: string) => {
    const projectId = getProjectParam();
    let url = `/api/knowledge?action=documents&projectId=${projectId}`;
    if (collection) url += `&collection=${collection}`;
    const res = await fetch(url);
    const data = await res.json();
    setDocuments(data.documents || []);
  }, [knowledgeScope, activeProject]);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    const data = await res.json();
    setProfileEntries(data.entries || []);
  }, []);

  useEffect(() => {
    loadCollections();
    loadProfile();
  }, [loadCollections, loadProfile]);

  useEffect(() => {
    loadDocuments(selectedCollection || undefined);
  }, [selectedCollection, loadDocuments]);

  useEffect(() => {
    setSelectedCollection(null);
  }, [knowledgeScope, activeProject]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const projectId = getProjectParam();
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", query: searchQuery, limit: 20, projectId }),
    });
    const data = await res.json();
    setSearchResults(data.results || []);
    setSearching(false);
  };

  const handleIngest = async () => {
    if (!ingestContent.trim()) return;
    const projectId = getProjectParam();
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ingest",
        title: ingestTitle,
        content: ingestContent,
        source: ingestSource,
        collection: ingestCollection,
        projectId,
      }),
    });
    setIngestTitle("");
    setIngestContent("");
    setIngestSource("");
    setShowIngest(false);
    loadCollections();
    loadDocuments(selectedCollection || undefined);
  };

  const handleDelete = async (id: string) => {
    const projectId = getProjectParam();
    await fetch(`/api/knowledge?id=${id}&projectId=${projectId}`, { method: "DELETE" });
    loadDocuments(selectedCollection || undefined);
    loadCollections();
  };

  const handleUpdate = async () => {
    if (!editingDoc) return;
    const projectId = getProjectParam();
    await fetch("/api/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingDoc.id,
        title: editTitle,
        content: editContent,
        projectId,
      }),
    });
    setEditingDoc(null);
    loadDocuments(selectedCollection || undefined);
  };

  const handleAddProfile = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory, key: newKey, value: newValue }),
    });
    setNewKey("");
    setNewValue("");
    setShowAddProfile(false);
    loadProfile();
  };

  const handleDeleteProfile = async (id: number) => {
    await fetch(`/api/profile?id=${id}`, { method: "DELETE" });
    loadProfile();
  };

  const profileCategories = ["business", "preferences", "goals", "decisions"];
  const groupedProfile: Record<string, ProfileEntry[]> = {};
  for (const entry of profileEntries) {
    if (!groupedProfile[entry.category]) groupedProfile[entry.category] = [];
    groupedProfile[entry.category].push(entry);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Knowledge & Memory</h1>

        <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("knowledge")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "knowledge"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <FileText size={14} />
            Knowledge Base
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "profile"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <User size={14} />
            User Profile
          </button>
        </div>

        {tab === "knowledge" && (
          <>
            {/* Scope toggle */}
            <div className="flex gap-1 mb-4 bg-[var(--bg-tertiary)] rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setKnowledgeScope("project")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  knowledgeScope === "project"
                    ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <FolderKanban size={12} />
                {activeProject?.name || "Project"}
              </button>
              <button
                onClick={() => setKnowledgeScope("common")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  knowledgeScope === "common"
                    ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Globe size={12} />
                Common
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <div className="flex-1 relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search knowledge base..."
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
              <button
                onClick={() => setShowIngest(!showIngest)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--bg-secondary)]"
              >
                <Plus size={14} />
                Add Document
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                  Search Results ({searchResults.length})
                </h3>
                <div className="space-y-2">
                  {searchResults.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {r.title || "Untitled"}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          Score: {r.score?.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showIngest && (
              <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
                <h3 className="text-sm font-semibold mb-3">
                  Add Document to {knowledgeScope === "common" ? "Common" : activeProject?.name || "Project"} Knowledge
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={ingestTitle}
                      onChange={(e) => setIngestTitle(e.target.value)}
                      placeholder="Title"
                      className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                    <select
                      value={ingestCollection}
                      onChange={(e) => setIngestCollection(e.target.value)}
                      className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="default">Default</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    placeholder="Content..."
                    rows={5}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="text"
                    value={ingestSource}
                    onChange={(e) => setIngestSource(e.target.value)}
                    placeholder="Source (optional)"
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowIngest(false)}
                      className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleIngest}
                      disabled={!ingestContent.trim()}
                      className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-6">
              <div className="w-48 shrink-0">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Collections
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCollection(null)}
                    className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                      !selectedCollection
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <FolderOpen size={14} />
                    All Documents
                  </button>
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCollection(c.id)}
                      className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                        selectedCollection === c.id
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <FolderOpen size={14} />
                        {c.name}
                      </span>
                      <span className="text-[10px]">{c.documentCount}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Documents ({documents.length})
                </h3>
                {documents.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-8 text-center">
                    No documents yet. Add some to build your knowledge base.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) =>
                      editingDoc?.id === doc.id ? (
                        <div
                          key={doc.id}
                          className="p-3 bg-[var(--bg-secondary)] border border-[var(--accent)]/40 rounded-lg"
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-[var(--accent)]"
                          />
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={4}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1 text-sm resize-none mb-2 focus:outline-none focus:border-[var(--accent)]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingDoc(null)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              <X size={12} /> Cancel
                            </button>
                            <button
                              onClick={handleUpdate}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
                            >
                              <Save size={12} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={doc.id}
                          className="group p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/30 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <FileText
                                  size={12}
                                  className="text-[var(--text-muted)] shrink-0"
                                />
                                <span className="text-sm font-medium truncate">
                                  {doc.title || "Untitled"}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                                {doc.content}
                              </p>
                              {doc.source && (
                                <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                                  {doc.source}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                              <button
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setEditTitle(doc.title);
                                  setEditContent(doc.content);
                                }}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(doc.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-red-400"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "profile" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[var(--text-muted)]">
                Facts and preferences your coaches use to personalize their advice.
                These are shared across all projects.
              </p>
              <button
                onClick={() => setShowAddProfile(!showAddProfile)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] shrink-0 ml-4"
              >
                <Plus size={14} />
                Add Fact
              </button>
            </div>

            {showAddProfile && (
              <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
                <h3 className="text-sm font-semibold mb-3">Add Profile Fact</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      {profileCategories.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Fact name (e.g. company_name)"
                      className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <textarea
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Value (e.g. Acme Corp - a B2B SaaS startup)"
                    rows={2}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowAddProfile(false)}
                      className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddProfile}
                      disabled={!newKey.trim() || !newValue.trim()}
                      className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profileEntries.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <User size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  No profile data yet. Add facts about yourself and your business,
                  or they&apos;ll be learned automatically from your conversations.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {profileCategories.map((category) => {
                  const entries = groupedProfile[category];
                  if (!entries || entries.length === 0) return null;
                  return (
                    <div key={category}>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ChevronRight size={12} />
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="group flex items-start justify-between px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/30 transition-colors"
                          >
                            <div>
                              <span className="text-sm font-medium">
                                {entry.key}
                              </span>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                {entry.value}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteProfile(entry.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
