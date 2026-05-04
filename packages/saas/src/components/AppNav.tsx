"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  MessageSquare, Settings, BookOpen, FolderKanban, ChevronDown, LogOut,
  Plus, User, BarChart3, Users, Zap, Shield,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useProject } from "./ProjectContext";
import { NotificationBell } from "./NotificationBell";

const NAV_ITEMS = [
  { href: "/effectiveness", label: "Dashboard", Icon: BarChart3, adminOnly: false },
  { href: "/dashboard", label: "Team", Icon: MessageSquare, adminOnly: false },
  { href: "/actions", label: "Actions", Icon: Zap, adminOnly: false },
  { href: "/knowledge", label: "Knowledge", Icon: BookOpen, adminOnly: false },
  { href: "/experts", label: "Experts", Icon: Users, adminOnly: false },
  { href: "/settings/api-keys", label: "Settings", Icon: Settings, adminOnly: false, activePrefix: "/settings" },
  { href: "/admin", label: "Admin", Icon: Settings, adminOnly: true },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");
  const isLogin = pathname.startsWith("/login");
  const isSignup = pathname.startsWith("/signup");
  const isMarketing = pathname === "/";
  const { data: session } = useSession();
  const { projects, activeProject, setActiveProjectId, createProject } = useProject();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const projectRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
        setShowNewProject(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLogin || isSignup || isMarketing) return null;

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName);
    setNewProjectName("");
    setShowNewProject(false);
    setShowProjectMenu(false);
  };

  return (
    <nav className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
      <span className="text-sm font-bold mr-4 text-[var(--text)]">Executive Team</span>

      {!isOnboarding && session && (
        <>
          {NAV_ITEMS.filter(item => {
            if ('adminOnly' in item && item.adminOnly) {
              return (session.user as any)?.isAdmin === true;
            }
            return true;
          }).map(({ href, label, Icon, ...rest }) => {
            const activePrefix = (rest as any).activePrefix;
            const active = pathname.startsWith(activePrefix || href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <Icon size={14} /> {label}
              </Link>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />

            {/* Project Switcher */}
            <div ref={projectRef} className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <FolderKanban size={12} className="text-[var(--accent)]" />
                <span className="max-w-[120px] truncate">{activeProject?.name || "Select Project"}</span>
                <ChevronDown size={12} />
              </button>
              {showProjectMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setShowProjectMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors ${
                        activeProject?.id === p.id ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"
                      }`}
                    >
                      <div className="truncate">{p.name}</div>
                      {p.description && (
                        <div className="text-[10px] text-[var(--text-muted)] truncate">{p.description}</div>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-[var(--border)] mt-1 pt-1">
                    {showNewProject ? (
                      <div className="px-3 py-2">
                        <input
                          autoFocus
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                          placeholder="Project name"
                          className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
                        />
                        <div className="flex gap-1 mt-1 justify-end">
                          <button
                            onClick={() => setShowNewProject(false)}
                            className="px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateProject}
                            className="px-2 py-0.5 text-[10px] bg-[var(--accent)] text-white rounded"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewProject(true)}
                        className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] flex items-center gap-1.5"
                      >
                        <Plus size={12} /> New Project
                      </button>
                    )}
                    <Link
                      href="/projects"
                      onClick={() => setShowProjectMenu(false)}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] flex items-center gap-1.5"
                    >
                      <FolderKanban size={12} /> Manage Projects
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div ref={userRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <User size={14} className="text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-muted)] max-w-[80px] truncate">
                  {session.user?.name || session.user?.email || "User"}
                </span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-[var(--border)]">
                    <div className="text-xs font-medium truncate">{session.user?.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{session.user?.email}</div>
                  </div>
                  <Link
                    href="/settings/tools"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] flex items-center gap-1.5"
                  >
                    <Shield size={12} /> Tools
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] flex items-center gap-1.5"
                  >
                    <LogOut size={12} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
