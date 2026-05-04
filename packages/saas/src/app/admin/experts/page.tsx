"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Check, X, Star } from "lucide-react";

export default function AdminExpertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [experts, setExperts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    // Fetch all expert profiles (admin endpoint needed)
    fetch("/api/expert/requests")
      .then(() => {
        // For admin, we need a separate endpoint - let's use a simple approach
        // TODO: Create dedicated admin experts API
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, router]);

  async function handleApprove(id: string, isFoundingExpert: boolean = false) {
    await fetch(`/api/admin/experts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true, isFoundingExpert }),
    });
    window.location.reload();
  }

  async function handleReject(id: string) {
    await fetch(`/api/admin/experts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    });
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-purple-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expert Applications</h1>
      </div>

      {experts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No expert applications yet.
        </div>
      ) : (
        <div className="space-y-4">
          {experts.map((expert) => (
            <div
              key={expert.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{expert.displayName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{expert.email}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{expert.bio?.slice(0, 200)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                      {expert.domains}
                    </span>
                    <span className="text-xs text-gray-500">
                      ${expert.rateMinCents / 100} – ${expert.rateMaxCents / 100}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(expert.id)}
                    className="p-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApprove(expert.id, false)}
                    className="p-2 text-green-600 border border-green-200 rounded-lg hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApprove(expert.id, true)}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
                  >
                    <Star className="w-4 h-4" />
                    Founding
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
