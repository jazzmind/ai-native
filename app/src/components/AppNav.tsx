"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Coaches", Icon: MessageSquare },
  { href: "/admin", label: "Admin", Icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");

  return (
    <nav className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
      <span className="text-sm font-bold mr-4 text-[var(--text)]">Coach Platform</span>
      {!isOnboarding &&
        NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
    </nav>
  );
}
