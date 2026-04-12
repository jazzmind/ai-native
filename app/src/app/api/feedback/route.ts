import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  addFeedback,
  getFeedbackForMessage,
  getFeedbackStats,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const coachKey = searchParams.get("coachKey");
  const mode = searchParams.get("mode");
  const days = searchParams.get("days");

  const stats = getFeedbackStats(
    user.id,
    projectId || undefined,
    coachKey || undefined,
    mode || undefined,
    days ? parseInt(days) : undefined
  );

  return Response.json(stats);
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { messageId, conversationId, rating, coachKey, mode, comment } = body as {
    messageId: number;
    conversationId: string;
    rating: "up" | "down";
    coachKey?: string;
    mode?: string;
    comment?: string;
  };

  if (!messageId || !conversationId || !rating) {
    return Response.json({ error: "messageId, conversationId, and rating are required" }, { status: 400 });
  }

  if (rating !== "up" && rating !== "down") {
    return Response.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const existing = getFeedbackForMessage(messageId);
  if (existing) {
    return Response.json({ error: "Feedback already exists for this message" }, { status: 409 });
  }

  const feedback = addFeedback(
    messageId,
    conversationId,
    user.id,
    rating,
    coachKey,
    mode,
    comment
  );

  return Response.json(feedback);
}
