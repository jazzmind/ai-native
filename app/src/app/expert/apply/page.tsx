"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserCheck, Send } from "lucide-react";

const DOMAIN_OPTIONS = [
  { value: "founder", label: "Founder Coaching" },
  { value: "strategy", label: "Business Strategy" },
  { value: "funding", label: "Fundraising" },
  { value: "finance", label: "Finance & Tax" },
  { value: "legal", label: "Legal" },
  { value: "growth", label: "Growth & GTM" },
  { value: "technology", label: "Technology" },
];

export default function ExpertApplyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    domains: [] as string[],
    rateMin: 25,
    rateMax: 100,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggleDomain(domain: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter((d) => d !== domain)
        : [...prev.domains, domain],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/expert/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          bio: form.bio,
          domains: form.domains,
          rateMinCents: form.rateMin * 100,
          rateMaxCents: form.rateMax * 100,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit application");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Application Submitted!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Thanks! We'll review your application and reach out within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Join the Expert Network
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Share your expertise with founders and earn by reviewing AI-generated advice.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            placeholder="How experts see your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio <span className="text-gray-400">(min 200 characters)</span>
          </label>
          <textarea
            required
            minLength={200}
            rows={5}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            placeholder="Tell us about your expertise, experience, and what kind of reviews you'd like to do..."
          />
          <p className="text-xs text-gray-400 mt-1">{form.bio.length}/200 minimum</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Domains of Expertise
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DOMAIN_OPTIONS.map((domain) => (
              <label
                key={domain.value}
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                  form.domains.includes(domain.value)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.domains.includes(domain.value)}
                  onChange={() => toggleDomain(domain.value)}
                  className="rounded"
                />
                <span className="text-sm text-gray-900 dark:text-white">{domain.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Rate
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input
                type="number"
                min={25}
                max={500}
                step={25}
                value={form.rateMin}
                onChange={(e) => setForm({ ...form, rateMin: parseInt(e.target.value) })}
                className="w-full pl-7 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum Rate
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input
                type="number"
                min={25}
                max={500}
                step={25}
                value={form.rateMax}
                onChange={(e) => setForm({ ...form, rateMax: parseInt(e.target.value) })}
                className="w-full pl-7 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || form.domains.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
