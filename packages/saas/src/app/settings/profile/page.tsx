"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User, Mail, Building2, LogOut, Save, RefreshCw, CheckCircle, ShieldCheck, Key,
} from "lucide-react";

interface OrgInfo {
  id: string;
  name: string;
  plan: string;
  slug: string;
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.org) {
          setOrg(data.org);
          setOrgName(data.org.name || "");
        }
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName }),
      });
      if (!res.ok) throw new Error("Save failed");
      setOrg((prev) => prev ? { ...prev, name: orgName } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const user = session?.user;
  const email = user?.email || "";
  const name = user?.name || email;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Avatar + identity */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center text-lg font-bold text-[var(--accent)]">
            {loading ? "…" : initials || <User size={22} />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">{name}</h2>
            <p className="text-xs text-[var(--text-muted)]">{email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Email — read-only (it's the account identifier) */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Email
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
              <Mail size={13} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-sm text-[var(--text-muted)]">{email}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                verified
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Email is your account identifier and cannot be changed.
            </p>
          </div>

          {/* Workspace name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Workspace Name
            </label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="My Team"
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !orgName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity"
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
              Save
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle size={12} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plan */}
      {org && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-0.5">Plan</h3>
              <p className="text-xs text-[var(--text-muted)]">Your current subscription</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 capitalize">
              {org.plan}
            </span>
          </div>
          {org.plan === "free" && (
            <p className="text-xs text-[var(--text-muted)] mt-3">
              <a href="/settings/billing" className="text-[var(--accent)] hover:underline">Pro is coming soon</a> — get access to longer context, priority response, and more.
            </p>
          )}
        </div>
      )}

      {/* Authentication & Security */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Security</h3>
        <div className="space-y-3">
          {/* Sign-in method */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
            <Mail size={14} className="text-[var(--text-muted)] shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[var(--text)]">Email verification code</p>
              <p className="text-[10px] text-[var(--text-muted)]">Active</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              active
            </span>
          </div>

          {/* Passkeys */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
            <Key size={14} className="text-[var(--text-muted)] shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[var(--text)]">Passkeys</p>
              <p className="text-[10px] text-[var(--text-muted)]">Biometric / hardware key sign-in — coming soon</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)]">
              soon
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Session</h3>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>

    </div>
  );
}
