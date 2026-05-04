"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Check, Zap, Crown, Clock, Loader2 } from "lucide-react";

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" /></div>}>
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [upgrading, setUpgrading] = useState(false);

  const orgPlan = (session?.user as any)?.orgPlan || "free";
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function handleManageSubscription() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text)]">Billing</h1>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <p className="text-green-400 font-medium">Subscription activated! Your plan has been upgraded.</p>
        </div>
      )}
      {canceled && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <p className="text-amber-400">Checkout was canceled. No changes were made.</p>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Current plan</p>
          <p className="text-xl font-bold text-[var(--text)] capitalize flex items-center gap-2">
            {orgPlan === "pro" ? <Crown className="w-5 h-5 text-amber-400" /> : <Zap className="w-5 h-5 text-[var(--text-muted)]" />}
            {orgPlan}
          </p>
        </div>
        {orgPlan !== "free" && (
          <button
            onClick={handleManageSubscription}
            className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 transition-colors"
          >
            Manage subscription
          </button>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-2 gap-6">

        {/* Free */}
        <div className={`rounded-xl border p-6 ${orgPlan === "free" ? "border-[var(--accent)]/40 bg-[var(--bg-secondary)]" : "border-[var(--border)] bg-[var(--bg-secondary)]"}`}>
          <h3 className="text-lg font-bold text-[var(--text)]">Free</h3>
          <div className="mt-2 mb-5">
            <span className="text-3xl font-bold text-[var(--text)]">$0</span>
            <span className="text-[var(--text-muted)] text-sm ml-1">forever</span>
          </div>
          <ul className="space-y-2 mb-6">
            {[
              "100 messages/month",
              "3 projects",
              "1 seat",
              "BYO API key required",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="w-full py-2 text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-lg cursor-default"
          >
            {orgPlan === "free" ? "Current plan" : "Free"}
          </button>
        </div>

        {/* Pro — coming soon */}
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-secondary)] p-6 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Clock size={10} /> Coming Soon
          </span>
          <h3 className="text-lg font-bold text-[var(--text)]">Pro</h3>
          <div className="mt-2 mb-5">
            <span className="text-3xl font-bold text-[var(--text)]">$49</span>
            <span className="text-[var(--text-muted)] text-sm ml-1">/month</span>
          </div>
          <ul className="space-y-2 mb-6">
            {[
              "Unlimited messages",
              "10 projects",
              "1 seat",
              "Managed API key included",
              "1 expert review credit/month",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="w-full py-2 text-sm font-medium bg-[var(--accent)]/20 text-[var(--accent)] rounded-lg cursor-default opacity-60"
          >
            Coming soon
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-6 text-center">
        Pro plan is in development. You'll be notified when it's available.
      </p>
    </div>
  );
}
