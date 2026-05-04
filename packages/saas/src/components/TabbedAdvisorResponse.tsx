"use client";

import { useState } from "react";
import {
  TabbedAdvisorResponse as CoreTabbedAdvisorResponse,
  type AdvisorTab,
} from "@ai-native/core/components";
import type { FeedbackPayload } from "@ai-native/core/components";
import type { CoachIconName } from "@ai-native/core";
import { RequestReviewDialog } from "./RequestReviewDialog";

export type { AdvisorTab };

interface TabbedAdvisorResponseProps {
  advisorTabs: AdvisorTab[];
  synthesis: {
    content: string;
    leadKey: string;
    leadName: string;
    leadIcon?: CoachIconName | string;
    isStreaming: boolean;
    messageId?: number;
  } | null;
  conversationId?: string;
  mode?: string | null;
}

async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      rating: payload.rating,
      coachKey: payload.coachKey,
      mode: payload.mode,
      comment: payload.comment,
    }),
  });
}

export function TabbedAdvisorResponse(props: TabbedAdvisorResponseProps) {
  const [reviewTarget, setReviewTarget] = useState<{ conversationId: string; messageId: number } | null>(null);

  return (
    <>
      <CoreTabbedAdvisorResponse
        {...props}
        onFeedback={submitFeedback}
        onRequestReview={
          props.conversationId
            ? (convId, msgId) => setReviewTarget({ conversationId: convId, messageId: msgId })
            : undefined
        }
      />
      {reviewTarget && (
        <RequestReviewDialog
          conversationId={reviewTarget.conversationId}
          messageId={reviewTarget.messageId}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </>
  );
}
