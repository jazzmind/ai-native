import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider } from "@jazzmind/busibox-app";
import { FetchWrapper } from "@jazzmind/busibox-app";
import { VersionBar } from "@jazzmind/busibox-app";

export const metadata: Metadata = {
  title: "AI Advisory Team",
  description: "Your AI executive advisory board powered by Busibox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const portalUrl =
    process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL ||
    process.env.NEXT_PUBLIC_AI_PORTAL_URL ||
    "";
  const appId = process.env.APP_NAME || "ai-native";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const portalBasePath = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH || "/portal";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <FetchWrapper
          skipAuthUrls={["/api/auth/session", "/api/logout", "/api/health"]}
        />
        <ThemeProvider>
          <SessionProvider appId={appId} portalUrl={portalUrl} basePath={basePath}>
            <CustomizationProvider
              apiEndpoint={`${portalBasePath}/api/portal-customization`}
            >
              {children}
              <VersionBar />
            </CustomizationProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
