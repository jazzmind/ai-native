"use client";

import Link from "next/link";
import { Users, TrendingUp, BarChart3, Star } from "lucide-react";

const ADMIN_LINKS = [
  {
    href: "/admin/users",
    label: "User Management",
    description: "View and manage organizations",
    icon: Users,
    color: "bg-blue-600",
  },
  {
    href: "/admin/growth",
    label: "Growth Dashboard",
    description: "Funnels, engagement, churn",
    icon: TrendingUp,
    color: "bg-green-600",
  },
  {
    href: "/admin/analytics",
    label: "Platform Analytics",
    description: "Messages, marketplace, experts",
    icon: BarChart3,
    color: "bg-purple-600",
  },
  {
    href: "/admin/experts",
    label: "Expert Review",
    description: "Approve and manage expert applications",
    icon: Star,
    color: "bg-amber-600",
  },
];

export default function AdminDashboard() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text)]">Platform Admin</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Platform operator tools — user management, analytics, and growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ADMIN_LINKS.map(({ href, label, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text)]">{label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{description}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
