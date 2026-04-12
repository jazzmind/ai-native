"use client";

import { SessionProvider } from "next-auth/react";
import { ProjectProvider } from "@/components/ProjectContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProjectProvider>{children}</ProjectProvider>
    </SessionProvider>
  );
}
