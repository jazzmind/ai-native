"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { LogIn, GitBranch, Globe, KeyRound, Loader2 } from "lucide-react";

const PROVIDERS = [
  { id: "github", name: "GitHub", Icon: GitBranch },
  { id: "google", name: "Google", Icon: Globe },
  { id: "busibox-sso", name: "Busibox SSO", Icon: KeyRound },
] as const;

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleOAuth = async (providerId: string) => {
    setLoading(providerId);
    await signIn(providerId, { callbackUrl: "/" });
  };

  const handleCredentials = async () => {
    if (!email.trim()) return;
    setLoading("credentials");
    await signIn("credentials", { email, name, callbackUrl: "/" });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LogIn size={24} className="text-[var(--accent)]" />
            <h1 className="text-2xl font-bold">Coach Platform</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Sign in to access your AI business coaches
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PROVIDERS.map(({ id, name: label, Icon }) => (
            <button
              key={id}
              onClick={() => handleOAuth(id)}
              disabled={loading !== null}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-colors"
            >
              {loading === id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Icon size={16} />
              )}
              Continue with {label}
            </button>
          ))}
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[var(--bg)] text-[var(--text-muted)]">or use local account</span>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleCredentials}
            disabled={!email.trim() || loading !== null}
            className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading === "credentials" ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              "Sign In"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
