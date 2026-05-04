"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Key, Shield, CreditCard, Rocket, User, Cpu } from "lucide-react";

const SETTINGS_TABS = [
  { href: "/settings/profile", label: "Profile", Icon: User },
  { href: "/settings/api-keys", label: "API Key", Icon: Key },
  { href: "/settings/deploy", label: "Deploy Agents", Icon: Rocket },
  { href: "/settings/models", label: "Models", Icon: Cpu },
  { href: "/settings/tools", label: "Tools", Icon: Shield },
  { href: "/settings/billing", label: "Billing", Icon: CreditCard },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-[var(--border)] px-6 pt-6 pb-0 bg-[var(--bg)]">
        <h1 className="text-lg font-bold text-[var(--text)] mb-4">Settings</h1>
        <div className="flex gap-1">
          {SETTINGS_TABS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon size={13} /> {label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
