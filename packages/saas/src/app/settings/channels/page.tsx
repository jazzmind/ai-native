"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  MessageSquare, Link2, Unlink, RefreshCw, CheckCircle2, Clock, Copy, Check,
  Webhook, AlertTriangle, Globe, Trash2,
} from "lucide-react";

// Admin email exposed via env var for client-side panel visibility check
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_USER || "").toLowerCase();

interface ChannelBindingStatus {
  channelType: "telegram" | "whatsapp" | "signal";
  externalId: string | null;
  displayName: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  isActive: boolean;
}

interface LinkCodeState {
  code: string;
  expiresAt: string;
  expiresInSeconds: number;
  channelType: "telegram" | "whatsapp" | "signal";
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
}

const BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "your Telegram bot";

const CHANNEL_CONFIG = {
  telegram: {
    label: "Telegram",
    icon: "✈️",
    description: "Chat with your advisors and receive task notifications via Telegram.",
    comingSoon: false,
  },
  whatsapp: {
    label: "WhatsApp",
    icon: "💬",
    description: "Chat with your advisors via WhatsApp.",
    comingSoon: true,
  },
  signal: {
    label: "Signal",
    icon: "🔒",
    description: "Receive notifications via Signal.",
    comingSoon: true,
  },
};

// ── Webhook Setup Panel (admin only) ────────────────────────────────────────

function WebhookSetupPanel() {
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadWebhookInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/bridge/telegram/setup");
      const data = await res.json();
      if (data.webhookInfo) setWebhookInfo(data.webhookInfo);
    } catch {
      // non-critical
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => { loadWebhookInfo(); }, [loadWebhookInfo]);

  async function handleRegister() {
    setRegistering(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      if (customUrl.trim()) body.url = customUrl.trim();

      const res = await fetch("/api/bridge/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Registration failed");
      setWebhookInfo(data.info);
      setCustomUrl("");
      setMessage({ type: "success", text: `Webhook registered: ${data.webhookUrl}` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Registration failed" });
    } finally {
      setRegistering(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/bridge/telegram/setup", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Removal failed");
      setWebhookInfo({ url: "", has_custom_certificate: false, pending_update_count: 0 });
      setMessage({ type: "success", text: "Webhook removed." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Removal failed" });
    } finally {
      setRemoving(false);
    }
  }

  const isRegistered = !!webhookInfo?.url;
  const hasError = !!webhookInfo?.last_error_message;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Webhook size={14} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text)]">Webhook Setup</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">admin</span>
      </div>

      {/* Current status */}
      {loadingInfo ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <RefreshCw size={11} className="animate-spin" /> Checking webhook status…
        </div>
      ) : (
        <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs ${
          isRegistered && !hasError
            ? "bg-green-500/5 border-green-500/20 text-green-400"
            : "bg-amber-500/5 border-amber-500/20 text-amber-400"
        }`}>
          {isRegistered && !hasError
            ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          }
          <div className="space-y-0.5">
            {isRegistered
              ? <p className="font-medium">Webhook active</p>
              : <p className="font-medium">No webhook registered — bot won&apos;t receive messages</p>
            }
            {isRegistered && (
              <p className="text-[10px] opacity-70 font-mono break-all">{webhookInfo?.url}</p>
            )}
            {hasError && (
              <p className="text-[10px] text-red-400 mt-1">
                Last error: {webhookInfo?.last_error_message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Register / update */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-muted)]">
          Webhook base URL
          <span className="ml-1 font-normal opacity-60">(leave blank to use NEXT_PUBLIC_APP_URL)</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              placeholder="https://your-tunnel.trycloudflare.com"
              className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={registering}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            {registering ? <RefreshCw size={11} className="animate-spin" /> : <Webhook size={11} />}
            {isRegistered ? "Update" : "Register"}
          </button>
          {isRegistered && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            >
              {removing ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          For local dev, start a tunnel first:{" "}
          <code className="bg-[var(--bg-tertiary)] px-1 rounded">npx cloudflared tunnel --url http://localhost:3007</code>
          {" "}then paste the tunnel URL above.
        </p>
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-lg text-xs ${
          message.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [bindings, setBindings] = useState<ChannelBindingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState<LinkCodeState | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [unlinkingFor, setUnlinkingFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const userEmail = (session?.user?.email || "").toLowerCase();
  const isAdmin = !!ADMIN_EMAIL && userEmail === ADMIN_EMAIL;

  const loadBindings = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge/link");
      const data = await res.json();
      setBindings(data.bindings || []);
    } catch {
      setError("Failed to load channel status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBindings(); }, [loadBindings]);

  // Countdown timer for link code expiry
  useEffect(() => {
    if (!linkCode) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(linkCode.expiresAt).getTime() - Date.now()) / 1000)
      );
      setLinkCode((prev) => (prev ? { ...prev, expiresInSeconds: remaining } : null));
      if (remaining <= 0) { setLinkCode(null); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [linkCode?.expiresAt]);

  async function generateLinkCode(channelType: "telegram" | "whatsapp" | "signal") {
    setGeneratingFor(channelType);
    setLinkCode(null);
    setError("");
    try {
      const res = await fetch("/api/bridge/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      const expiresAt = new Date(data.expiresAt);
      setLinkCode({
        code: data.linkCode,
        expiresAt: data.expiresAt,
        expiresInSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        channelType,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate link code.");
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleUnlink(channelType: string) {
    setUnlinkingFor(channelType);
    setError("");
    try {
      const res = await fetch(`/api/bridge/link?channelType=${channelType}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unlink failed");
      setLinkCode(null);
      await loadBindings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unlink.");
    } finally {
      setUnlinkingFor(null);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getBinding(channelType: string) {
    return bindings.find((b) => b.channelType === channelType);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <MessageSquare size={20} className="text-[var(--accent)]" />
        <h1 className="text-lg font-bold text-[var(--text)]">Messaging Channels</h1>
      </div>
      <p className="text-xs text-[var(--text-muted)] -mt-2">
        Link your account to a messaging app to chat with advisors and receive task notifications from anywhere.
      </p>

      {/* Admin: webhook setup */}
      {isAdmin && <WebhookSetupPanel />}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Channel cards */}
      {(["telegram", "whatsapp", "signal"] as const).map((channelType) => {
        const config = CHANNEL_CONFIG[channelType];
        const binding = getBinding(channelType);
        const isLinked = binding?.isVerified && binding?.isActive;
        const isShowingCode = linkCode && generatingFor === null && linkCode.channelType === channelType;

        return (
          <div
            key={channelType}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{config.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{config.label}</h3>
                    {config.comingSoon && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)]">
                        coming soon
                      </span>
                    )}
                    {isLinked && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle2 size={9} /> linked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{config.description}</p>
                  {isLinked && binding.displayName && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Connected as <span className="text-[var(--text)]">{binding.displayName}</span>
                    </p>
                  )}
                </div>
              </div>

              {!config.comingSoon && (
                <div className="flex-shrink-0">
                  {isLinked ? (
                    <button
                      onClick={() => handleUnlink(channelType)}
                      disabled={unlinkingFor === channelType}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                    >
                      {unlinkingFor === channelType
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <Unlink size={11} />}
                      Unlink
                    </button>
                  ) : (
                    <button
                      onClick={() => generateLinkCode(channelType)}
                      disabled={generatingFor === channelType}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity"
                    >
                      {generatingFor === channelType
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <Link2 size={11} />}
                      Link {config.label}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Link code panel */}
            {isShowingCode && linkCode && !isLinked && (
              <div className="mt-4 bg-[var(--bg)] border border-[var(--accent)]/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-[var(--text)]">
                  Send this command to{" "}
                  <span className="font-mono text-[var(--accent)]">@{BOT_NAME}</span> on Telegram:
                </p>

                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] tracking-widest">
                    /link {linkCode.code}
                  </code>
                  <button
                    onClick={() => copyCode(linkCode.code)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <Clock size={10} />
                  Expires in {Math.floor(linkCode.expiresInSeconds / 60)}:
                  {String(linkCode.expiresInSeconds % 60).padStart(2, "0")}
                  {" · "}
                  <button
                    onClick={() => generateLinkCode(linkCode.channelType)}
                    className="underline hover:text-[var(--text)]"
                  >
                    Regenerate
                  </button>
                  {" · "}
                  <button
                    onClick={() => { setLinkCode(null); loadBindings(); }}
                    className="underline hover:text-[var(--text)]"
                  >
                    I&apos;ve linked it
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-2">How it works</h3>
        <ol className="space-y-1.5 text-xs text-[var(--text-muted)] list-decimal list-inside">
          <li>Click <strong className="text-[var(--text)]">Link Telegram</strong> to get a one-time code (valid for 10 minutes).</li>
          <li>Open Telegram and find <span className="font-mono text-[var(--text)]">@{BOT_NAME}</span>.</li>
          <li>Send <code className="bg-[var(--bg-tertiary)] px-1 rounded">/link YOUR_CODE</code> to the bot.</li>
          <li>Once linked, send any message to the bot to chat with your advisors, or receive task reminders automatically.</li>
        </ol>
      </div>
    </div>
  );
}
