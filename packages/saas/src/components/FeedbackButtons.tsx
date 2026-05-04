"use client";

import { FeedbackButtons as CoreFeedbackButtons, type FeedbackPayload } from "@ai-native/core/components";

interface FeedbackButtonsProps {
  messageId: number;
  conversationId: string;
  coachKey?: string | null;
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

export function FeedbackButtons(props: FeedbackButtonsProps) {
  return <CoreFeedbackButtons {...props} onSubmit={submitFeedback} />;
}
