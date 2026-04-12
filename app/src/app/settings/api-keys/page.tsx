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
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Key className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Provider Key</h1>
      </div>

      {orgPlan === 'free' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Free plan requires your own API key
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
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
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Anthropic API Key
        </h2>

        {keyInfo.hasKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current key</p>
                <p className="font-mono text-gray-900 dark:text-white">
                  sk-ant-...****{keyInfo.hint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Active</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Removing..." : "Remove key"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter your Anthropic API key. It will be encrypted and stored securely.
            </p>

            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="flex items-center justify-between">
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Get an API key from Anthropic
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={handleSave}
                disabled={saving || !newKey.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save key"}
              </button>
            </div>
          </div>
        )}
      </div>

      {orgPlan !== 'free' && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          As a {orgPlan} plan user, chat works with our managed key even without a personal key.
          Adding your own key is optional.
        </p>
      )}
    </div>
  );
}
