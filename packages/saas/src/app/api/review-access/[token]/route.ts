import { NextRequest } from "next/server";
import {
  getReviewByToken,
  getMessages,
  getExpertCommentsByReview,
} from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const review = await getReviewByToken(token);

  if (!review) {
    return Response.json({ error: "Invalid or expired review link" }, { status: 404 });
  }

  const messages = await getMessages(review.conversation_id);
  const comments = await getExpertCommentsByReview(review.id);

  return Response.json({
    review: {
      id: review.id,
      question: review.question,
      context_summary: review.context_summary,
      status: review.status,
      expert_email: review.expert_email,
      expires_at: review.expires_at,
      message_id: review.message_id,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      coach_key: m.coach_key,
      mode: m.mode,
      created_at: m.created_at,
    })),
    comments,
  });
}
