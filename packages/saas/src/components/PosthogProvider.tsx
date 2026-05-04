"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key) return;

    posthog.init(key, {
      api_host: host || "https://app.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

export function PosthogIdentifier() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      posthog.identify(session.user.email, {
        name: session.user.name,
        orgId: (session as any).orgId,
        plan: (session as any).orgPlan,
      });
    }
  }, [session]);

  return null;
}
