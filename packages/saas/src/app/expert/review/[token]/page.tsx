"use client";

import { useState, useEffect, use } from "react";
import { Clock, Send, AlertCircle } from "lucide-react";

export default function ExpertReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    whatWentRight: "",
    whatToReconsider: "",
    recommendation: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/review-access/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRequest(data);
        }
      })
      .catch(() => setError("Failed to load review"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/marketplace/deliver/${request.review.id}?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit review");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Error</h1>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <Send className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Review Submitted!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your review has been delivered. Payment will be processed shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Expert Review</h1>
        <h2 className="text-lg text-gray-600 dark:text-gray-400">{request?.review?.question}</h2>
      </div>

      {request?.review?.context_summary && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Context Summary</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {request.review.context_summary}
          </p>
        </div>
      )}

      {request?.messages?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Conversation (last {Math.min(request.messages.length, 20)} messages)
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            {request.messages.slice(-20).map((msg: any) => (
              <div key={msg.id} className="text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {msg.role === "user" ? "User" : msg.coach_key || "AI"}:
                </span>{" "}
                <span className="text-gray-600 dark:text-gray-400">
                  {msg.content.slice(0, 500)}
                  {msg.content.length > 500 && "..."}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What the AI advisors got right
          </label>
          <textarea
            required
            rows={4}
            value={form.whatWentRight}
            onChange={(e) => setForm({ ...form, whatWentRight: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What to reconsider or correct
          </label>
          <textarea
            required
            rows={4}
            value={form.whatToReconsider}
            onChange={(e) => setForm({ ...form, whatToReconsider: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            My recommendation
          </label>
          <textarea
            required
            rows={4}
            value={form.recommendation}
            onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
}
