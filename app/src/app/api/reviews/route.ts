import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  createReviewRequest,
  listReviewsForUser,
  getReviewRequest,
  updateReviewStatus,
  getExpertCommentsByReview,
  getMessages,
} from "@/lib/db";
import { generateAccessToken, getExpirationDate } from "@/lib/review-tokens";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get("id");

  if (reviewId) {
    const review = getReviewRequest(reviewId);
    if (!review || review.requester_user_id !== user.id) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }
    const comments = getExpertCommentsByReview(reviewId);
    return Response.json({ review, comments });
  }

  const reviews = listReviewsForUser(user.id);
  return Response.json({ reviews });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "create": {
      const { conversationId, expertEmail, question, messageId, expirationDays } = body;
      if (!conversationId || !expertEmail || !question) {
        return Response.json(
          { error: "conversationId, expertEmail, and question are required" },
          { status: 400 }
        );
      }

      // Auto-generate context summary from recent messages
      const messages = getMessages(conversationId);
      const recentMessages = messages.slice(-10);
      const contextSummary = recentMessages
        .map((m) => `${m.role}: ${m.content.slice(0, 150)}`)
        .join("\n");

      const accessToken = generateAccessToken();
      const expiresAt = getExpirationDate(expirationDays || 7);

      const review = createReviewRequest(
        conversationId,
        user.id,
        expertEmail,
        question,
        contextSummary,
        accessToken,
        expiresAt,
        messageId
      );

      // TODO: Send email notification here when SMTP is configured
      // For now, return the access URL for manual sharing
      const reviewUrl = `/review/${accessToken}`;

      return Response.json({ review, reviewUrl });
    }

    case "update_status": {
      const { id, status } = body;
      if (!id || !status) {
        return Response.json({ error: "id and status are required" }, { status: 400 });
      }
      const review = getReviewRequest(id);
      if (!review || review.requester_user_id !== user.id) {
        return Response.json({ error: "Review not found" }, { status: 404 });
      }
      updateReviewStatus(id, status);
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}
