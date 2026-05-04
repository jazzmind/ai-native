"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Key, ExternalLink, Trash2, Check, AlertCircle } from "lucide-react";

export default function ApiKeysPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [keyInfo, setKeyInfo] = useState<{ hasKey: boolean; hint: string | null; provider: string } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const orgPlan = (session?.user as any)?.orgPlan || 'free';

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetch("/api/settings/api-key")
      .then((r) => r.json())
      .then(setKeyInfo)
      .catch(() => setKeyInfo({ hasKey: false, hint: null, provider: 'anthropic' }));
  }, [status, router]);

  async function handleSave() {
    if (!newKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, provider: "anthropic" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save key' });
        return;
      }
      setKeyInfo({ hasKey: true, hint: data.hint, provider: 'anthropic' });
      setNewKey("");
      setMessage({ type: 'success', text: 'API key saved successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save key' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setMessage(null);
    try {
      await fetch("/api/settings/api-key", { method: "DELETE" });
      setKeyInfo({ hasKey: false, hint: null, provider: 'anthropic' });
      setMessage({ type: 'success', text: 'API key removed' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove key' });
    } finally {
      setDeleting(false);
    }
  }

  if (status === "loading" || !keyInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Key className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text)]">AI Provider Key</h1>
      </div>

      {orgPlan === 'free' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-400 font-medium">
                Free plan requires your own API key
              </p>
              <p className="text-sm text-amber-400/80 mt-1">
                Add your Anthropic API key to use the chat feature.{" "}
                <a href="/settings/billing" className="underline font-medium">
                  Upgrade to Pro
                </a>{" "}
                to use our managed key.
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg p-3 mb-4 text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          Anthropic API Key
        </h2>

        {keyInfo.hasKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Current key</p>
                <p className="font-mono text-[var(--text)]">
                  sk-ant-...****{keyInfo.hint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">Active</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Removing..." : "Remove key"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              Enter your Anthropic API key. It will be encrypted and stored securely.
            </p>

            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-tertiary)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />

            <div className="flex items-center justify-between">
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
              >
                Get an API key from Anthropic
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={handleSave}
                disabled={saving || !newKey.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {saving ? "Saving..." : "Save key"}
              </button>
            </div>
          </div>
        )}
      </div>

      {orgPlan !== 'free' && (
        <p className="text-sm text-[var(--text-muted)] mt-4">
          As a {orgPlan} plan user, chat works with our managed key even without a personal key.
          Adding your own key is optional.
        </p>
      )}
    </div>
  );
}
