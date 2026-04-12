"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Check, Crown, Users, Zap, Loader2 } from "lucide-react";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "100 messages/month",
      "3 projects",
      "1 seat",
      "BYO API key required",
    ],
    cta: "Current plan",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$49",
    period: "/month",
    features: [
      "Unlimited messages",
      "10 projects",
      "1 seat",
      "Managed API key included",
      "1 expert review credit/month",
    ],
    cta: "Upgrade to Pro",
    recommended: true,
  },
  {
    key: "team",
    name: "Team",
    price: "$149",
    period: "/month",
    features: [
      "Unlimited messages",
      "50 projects",
      "5 seats",
      "Managed API key included",
      "3 expert review credits/month",
      "Team collaboration",
    ],
    cta: "Upgrade to Team",
  },
];

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const orgPlan = (session?.user as any)?.orgPlan || "free";
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function handleUpgrade(plan: string) {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgrading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // handle error
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <p className="text-green-800 dark:text-green-200 font-medium">
            Subscription activated! Your plan has been upgraded.
          </p>
        </div>
      )}
      {canceled && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-200">
            Checkout was canceled. No changes were made.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current plan</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white capitalize flex items-center gap-2">
              {orgPlan === "team" && <Users className="w-5 h-5 text-purple-500" />}
              {orgPlan === "pro" && <Crown className="w-5 h-5 text-amber-500" />}
              {orgPlan === "free" && <Zap className="w-5 h-5 text-gray-400" />}
              {orgPlan}
            </p>
          </div>
          {orgPlan !== "free" && (
            <button
              onClick={handleManageSubscription}
              className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Manage subscription
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`rounded-lg border p-6 ${
              plan.recommended
                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                : "border-gray-200 dark:border-gray-700"
            } bg-white dark:bg-gray-800 relative`}
          >
            {plan.recommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                Recommended
              </span>
            )}

            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
              <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
            </div>

            <ul className="space-y-2 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {plan.key === orgPlan ? (
              <button
                disabled
                className="w-full py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-default"
              >
                Current plan
              </button>
            ) : plan.key === "free" ? null : (
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={upgrading === plan.key}
                className={`w-full py-2 text-sm font-medium rounded-lg ${
                  plan.recommended
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                } disabled:opacity-50`}
              >
                {upgrading === plan.key ? "Redirecting..." : plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
