import { NextRequest } from "next/server";
import {
  addExpertComment,
  getReviewRequest,
  getExpertCommentsByReview,
  updateReviewStatus,
} from "@/lib/db";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: { id: string; email: string };
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  // Only the requester or the invited expert can read comments
  const isRequester = review.requester_user_id === user.id;
  const isExpert = review.expert_email.toLowerCase() === user.email.toLowerCase();
  if (!isRequester && !isExpert) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await getExpertCommentsByReview(id);
  return Response.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: { id: string; email: string };
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.status === "expired" || review.status === "completed") {
    return Response.json({ error: "Review is no longer active" }, { status: 400 });
  }

  // Only the invited expert can post comments; enforce their identity
  const isExpert = review.expert_email.toLowerCase() === user.email.toLowerCase();
  if (!isExpert) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { content, authorName, parentMessageId } = body;

  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  if (review.status === "pending") {
    await updateReviewStatus(id, "in_review");
  }

  const comment = await addExpertComment(
    id,
    review.conversation_id,
    user.email,
    content,
    authorName,
    undefined,
    parentMessageId
  );

  return Response.json(comment);
}
