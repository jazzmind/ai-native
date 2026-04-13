"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_default: number;
  created_at: string;
  updated_at: string;
  conversationCount?: number;
  messageCount?: number;
}

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, name: string, description?: string) => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  activeProject: null,
  setActiveProjectId: () => {},
  refreshProjects: async () => {},
  createProject: async () => null,
  deleteProject: async () => {},
  updateProject: async () => {},
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

const STORAGE_KEY = "coach-platform-active-project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const projectList: Project[] = data.projects || [];
      setProjects(projectList);

      if (projectList.length > 0) {
        setActiveProjectIdState((prev) => {
          if (prev && projectList.find((p) => p.id === prev)) return prev;
          const stored = localStorage.getItem(STORAGE_KEY);
          const match = stored && projectList.find((p) => p.id === stored);
          const defaultP = match || projectList.find((p) => p.is_default) || projectList[0];
          localStorage.setItem(STORAGE_KEY, defaultP.id);
          return defaultP.id;
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const createProjectFn = async (name: string, description?: string): Promise<Project | null> => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (data.project) {
      await refreshProjects();
      setActiveProjectId(data.project.id);
      return data.project;
    }
    return null;
  };

  const deleteProjectFn = async (id: string) => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refreshProjects();
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      }
    }
  };

  const updateProjectFn = async (id: string, name: string, description?: string) => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, name, description }),
    });
    await refreshProjects();
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      setActiveProjectId,
      refreshProjects,
      createProject: createProjectFn,
      deleteProject: deleteProjectFn,
      updateProject: updateProjectFn,
      loading,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}
