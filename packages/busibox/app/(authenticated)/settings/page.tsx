"use client";

import { useState } from "react";
import { Settings, RefreshCw, CheckCircle, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/settings/sync", { method: "POST" });
      const data = await res.json() as { synced?: number; failed?: number; error?: string };
      if (res.ok) {
        setSyncResult({
          ok: true,
          message: `Synced ${data.synced ?? 0} advisors${data.failed ? `, ${data.failed} failed` : ""}.`,
        });
      } else {
        setSyncResult({ ok: false, message: data.error ?? "Sync failed" });
      }
    } catch (err) {
      setSyncResult({ ok: false, message: String(err) });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <Settings size={20} className="text-[var(--accent)]" />
          Settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage advisor configurations and system settings.
        </p>
      </div>

      {/* Advisor sync */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
        <h2 className="font-medium text-[var(--text)] mb-1">Advisor Definitions</h2>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Sync advisor instructions to the agent-api. Run this after updating INSTRUCTIONS.md files.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync Advisors"}
        </button>

        {syncResult && (
          <div
            className={`flex items-center gap-1.5 mt-3 text-sm ${
              syncResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {syncResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {syncResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
