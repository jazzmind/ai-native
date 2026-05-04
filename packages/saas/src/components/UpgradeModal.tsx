"use client";

import { useState } from "react";
import { X, Crown, MessageCircle, FolderOpen, Key } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'message_limit' | 'project_limit' | 'byo_key_required';
  requiredPlan: 'pro' | 'team';
}

const REASON_CONFIG = {
  message_limit: {
    icon: MessageCircle,
    title: "Message limit reached",
    description: "You've used all your free messages this month. Upgrade to Pro for unlimited messages.",
  },
  project_limit: {
    icon: FolderOpen,
    title: "Project limit reached",
    description: "You've reached the maximum number of projects on your current plan.",
  },
  byo_key_required: {
    icon: Key,
    title: "API key required",
    description: "The free plan requires your own Anthropic API key. Upgrade to Pro to use our managed key, or add your own key.",
  },
};

export default function UpgradeModal({ isOpen, onClose, reason, requiredPlan }: UpgradeModalProps) {
  const [upgrading, setUpgrading] = useState(false);
  const config = REASON_CONFIG[reason];
  const Icon = config.icon;

  if (!isOpen) return null;

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: requiredPlan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgrading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-amber-600" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {config.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {config.description}
          </p>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 w-full mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-gray-900 dark:text-white capitalize">
                {requiredPlan} Plan
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {requiredPlan === 'pro'
                ? "Unlimited messages, managed API key, 10 projects, 1 expert review credit/month — $49/mo"
                : "Everything in Pro + 5 seats, 50 projects, 3 expert review credits/month — $149/mo"}
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {reason === 'byo_key_required' ? 'Add my key instead' : 'Maybe later'}
            </button>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {upgrading ? "Redirecting..." : `Upgrade to ${requiredPlan}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
