import { NextRequest } from "next/server";
import {
  addExpertComment,
  getReviewRequest,
  getExpertCommentsByReview,
  updateReviewStatus,
} from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = getReviewRequest(id);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const comments = getExpertCommentsByReview(id);
  return Response.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = getReviewRequest(id);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.status === "expired" || review.status === "completed") {
    return Response.json({ error: "Review is no longer active" }, { status: 400 });
  }

  const body = await req.json();
  const { content, authorEmail, authorName, parentMessageId } = body;

  if (!content || !authorEmail) {
    return Response.json({ error: "content and authorEmail are required" }, { status: 400 });
  }

  // Mark review as in_review if it was pending
  if (review.status === "pending") {
    updateReviewStatus(id, "in_review");
  }

  const comment = addExpertComment(
    id,
    review.conversation_id,
    authorEmail,
    content,
    authorName,
    undefined,
    parentMessageId
  );

  return Response.json(comment);
}
