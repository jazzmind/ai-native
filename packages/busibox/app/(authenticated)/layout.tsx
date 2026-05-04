"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header, Footer } from "@jazzmind/busibox-app";
import { useSession } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { Brain, MessageSquare, FolderOpen, Settings } from "lucide-react";

const portalBaseUrl = (
  process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL ||
  process.env.NEXT_PUBLIC_AI_PORTAL_URL ||
  ""
).replace(/\/+$/, "");

const portalUrl = portalBaseUrl
  ? portalBaseUrl.endsWith("/portal")
    ? portalBaseUrl
    : `${portalBaseUrl}/portal`
  : "/portal";

const navItems = [
  { href: "/", label: "Dashboard", icon: Brain },
  { href: "/chat", label: "Advisors", icon: MessageSquare },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useSession();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <Header
        session={{ user, isAuthenticated }}
        onLogout={handleLogout}
        postLogoutRedirectTo={`${portalUrl}/login`}
        appsLink={`${portalUrl}/home`}
        accountLink={`${portalUrl}/account`}
      />
      <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
      <Footer />
    </div>
  );
}
