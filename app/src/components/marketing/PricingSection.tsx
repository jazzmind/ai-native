import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "100 messages/month",
      "3 projects",
      "All 7 AI advisors",
      "Multi-advisor synthesis",
      "BYO API key required",
    ],
    cta: "Get started",
    ctaLink: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    features: [
      "Unlimited messages",
      "10 projects",
      "Managed API key included",
      "1 expert review credit/month",
      "Priority support",
    ],
    cta: "Start Pro",
    ctaLink: "/login",
    highlight: true,
  },
  {
    name: "Team",
    price: "$149",
    period: "/month",
    features: [
      "Everything in Pro",
      "50 projects",
      "5 team seats",
      "3 expert review credits/month",
      "Team collaboration",
    ],
    cta: "Start Team",
    ctaLink: "/login",
    highlight: false,
  },
];

export default function PricingSection() {
  return (
    <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
          Simple, transparent pricing
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Start free. Upgrade when you need more.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 bg-white dark:bg-gray-800 relative ${
                plan.highlight
                  ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
              <div className="mt-2 mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaLink}
                className={`block w-full py-2.5 text-sm font-medium text-center rounded-lg ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
