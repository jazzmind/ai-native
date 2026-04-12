import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AI Executive Team",
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
        <Providers>
          <AppNav />
          <div className="flex-1 overflow-hidden">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
