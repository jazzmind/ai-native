import Link from "next/link";
import { Check, Clock, Star, Users } from "lucide-react";

export default function PricingSection() {
  return (
    <section id="pricing" className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
          Simple, transparent pricing
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Start free with your own API key. Pro plan coming soon.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Plan */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Free</h3>
            <div className="mt-2 mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
              <span className="text-gray-500 dark:text-gray-400"> while in beta</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "100 messages/month",
                "3 projects",
                "All 7 AI advisors",
                "Multi-advisor synthesis",
                "BYO API key required",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full py-2.5 text-sm font-medium text-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Get started free
            </Link>
          </div>

          {/* Pro Plan — Coming Soon */}
          <div className="rounded-xl border border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 p-6 bg-white dark:bg-gray-800 relative opacity-75">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              Coming soon
            </span>

            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pro</h3>
              <Star className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$49</span>
              <span className="text-gray-500 dark:text-gray-400">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "Unlimited messages",
                "10 projects",
                "Managed API key included",
                "1 expert review credit/month",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <span className="block w-full py-2.5 text-sm font-medium text-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed">
              Coming soon
            </span>
          </div>

          {/* Expert Review */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expert Review</h3>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$10</span>
              <span className="text-gray-500 dark:text-gray-400">/review</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "On-demand human expert review",
                "Vetted professionals in your domain",
                "Average ~4 hour turnaround",
                "Pay per review, no commitment",
                "Available on any plan",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full py-2.5 text-sm font-medium text-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Sign up to request reviews
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
