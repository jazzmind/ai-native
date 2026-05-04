"use client";

import { useState } from "react";
import { useProject } from "@/components/ProjectContext";
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Check,
  Star,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";

export default function ProjectsPage() {
  const {
    projects,
    activeProject,
    setActiveProjectId,
    createProject,
    deleteProject,
    updateProject,
  } = useProject();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject(newName, newDesc);
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateProject(editingId, editName, editDesc);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const isOnlyProject = projects.length <= 1;
    if (isOnlyProject) {
      alert("You must have at least one project.");
      return;
    }
    if (!confirm(`Delete project "${project.name}"? All conversations and knowledge in this project will be permanently deleted.`)) return;
    await deleteProject(id);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderKanban size={24} />
              Projects
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Organize your coaching conversations, knowledge, and memories by project or initiative.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
            <h3 className="text-sm font-semibold mb-3">Create Project</h3>
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Project name"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 text-sm text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {projects.map((project) => {
            const isActive = activeProject?.id === project.id;
            const isEditing = editingId === project.id;

            if (isEditing) {
              return (
                <div
                  key={project.id}
                  className="p-4 bg-[var(--bg-secondary)] border border-[var(--accent)]/40 rounded-xl"
                >
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)]"
                    >
                      <X size={12} /> Cancel
                    </button>
                    <button
                      onClick={handleUpdate}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
                    >
                      <Save size={12} /> Save
                    </button>
                  </div>
                </div>
              );
            }

            const convCount = project.conversationCount || 0;
            const msgCount = project.messageCount || 0;

            return (
              <div
                key={project.id}
                className={`group p-4 bg-[var(--bg-secondary)] border rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? "border-[var(--accent)]/50 ring-1 ring-[var(--accent)]/20"
                    : "border-[var(--border)] hover:border-[var(--accent)]/30"
                }`}
                onClick={() => setActiveProjectId(project.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{project.name}</span>
                      {project.is_default ? (
                        <Star size={12} className="text-yellow-500" />
                      ) : null}
                      {isActive && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <MessagesSquare size={12} />
                        {convCount} conversation{convCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <MessageSquare size={12} />
                        {msgCount} message{msgCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingId(project.id);
                        setEditName(project.name);
                        setEditDesc(project.description);
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] rounded"
                    >
                      <Edit3 size={14} />
                    </button>
                    {projects.length > 1 && (
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No projects yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
