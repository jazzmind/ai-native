"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Star, Clock, DollarSign, CheckCircle, AlertCircle } from "lucide-react";

export default function ExpertDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/expert/requests")
        .then((r) => r.json())
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  async function handleAccept(requestId: string) {
    const res = await fetch(`/api/marketplace/bids/${requestId}/accept`, { method: "POST" });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    }
  }

  async function handleDecline(requestId: string) {
    await fetch(`/api/marketplace/bids/${requestId}/decline`, { method: "POST" });
    window.location.reload();
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Expert Access Required</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{data.error}</p>
        <a href="/expert/apply" className="text-blue-600 hover:underline">Apply to become an expert</a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Expert Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Star className="w-4 h-4" /> Rating
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.expert.averageRating?.toFixed(1) || "N/A"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <CheckCircle className="w-4 h-4" /> Reviews
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.expert.totalReviews || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4" /> Active
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.active?.length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <DollarSign className="w-4 h-4" /> Available
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.available?.length || 0}
          </p>
        </div>
      </div>

      {data.available?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Available Requests</h2>
          <div className="space-y-3">
            {data.available.map((req: any) => (
              <div
                key={req.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{req.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{req.question}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">
                        {req.domain}
                      </span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        ${(req.budgetCents / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleDecline(req.id)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.active?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Active Reviews</h2>
          <div className="space-y-3">
            {data.active.map((req: any) => (
              <div
                key={req.id}
                className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">{req.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Deadline: {req.deliveryDeadline ? new Date(req.deliveryDeadline).toLocaleString() : "N/A"}
                </p>
                {req.accessToken && (
                  <a
                    href={`/expert/review/${req.accessToken}`}
                    className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Submit Review
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.completed?.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Completed</h2>
          <div className="space-y-2">
            {data.completed.map((req: any) => (
              <div
                key={req.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{req.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ${(req.expertPayoutCents / 100).toFixed(0)} earned
                    {req.expertRating && ` • ${req.expertRating}/5 stars`}
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
