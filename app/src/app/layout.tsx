import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";
import { PosthogProvider, PosthogIdentifier } from "@/components/PosthogProvider";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "AIdvisory — AI Advisory Board",
  description: "AI-native advisory team with configurable autonomy modes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col h-screen">
        <PosthogProvider>
          <Providers>
            <PosthogIdentifier />
            <AppNav />
            <div className="flex-1 overflow-hidden">{children}</div>
          </Providers>
        </PosthogProvider>
        <Analytics />
      </body>
    </html>
  );
}
