"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, UserPlus, X } from "lucide-react";
import { RequestReviewDialog } from "./RequestReviewDialog";

interface ReviewSuggestionBannerProps {
  reason: string;
  domain: string;
  urgency: 'low' | 'medium' | 'high';
  conversationId: string;
  onDismiss: () => void;
}

const URGENCY_STYLES = {
  low: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: ShieldCheck,
    iconColor: "text-blue-400",
    text: "text-blue-300",
  },
  medium: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    text: "text-amber-300",
  },
  high: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: AlertTriangle,
    iconColor: "text-red-400",
    text: "text-red-300",
  },
};

const DOMAIN_LABELS: Record<string, string> = {
  legal: "Legal Expert",
  tax: "Tax Professional",
  finance: "Financial Advisor",
  compliance: "Compliance Specialist",
  health: "Health Professional",
  ip: "IP Attorney",
  employment: "Employment Lawyer",
  insurance: "Insurance Specialist",
  general: "Expert",
};

export function ReviewSuggestionBanner({
  reason,
  domain,
  urgency,
  conversationId,
  onDismiss,
}: ReviewSuggestionBannerProps) {
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const style = URGENCY_STYLES[urgency];
  const Icon = style.icon;
  const expertLabel = DOMAIN_LABELS[domain] || "Expert";

  return (
    <>
      <div className={`mx-1 mb-4 ${style.bg} border ${style.border} rounded-xl p-4`}>
        <div className="flex items-start gap-3">
          <Icon size={18} className={`${style.iconColor} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${style.text} mb-1`}>
              {urgency === 'high' ? 'Human review recommended' : 'Consider an expert review'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{reason}</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowReviewDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                <UserPlus size={12} /> Request {expertLabel} Review
              </button>
              <button
                onClick={onDismiss}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {showReviewDialog && (
        <RequestReviewDialog
          conversationId={conversationId}
          onClose={() => setShowReviewDialog(false)}
        />
      )}
    </>
  );
}
