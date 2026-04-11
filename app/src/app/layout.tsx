import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  title: "Coach Platform",
  description: "AI-powered business coaching executive team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col h-screen">
        <AppNav />
        <div className="flex-1 overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
