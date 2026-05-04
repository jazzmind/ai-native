import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@lib/auth-middleware";
import { ensureDataDocuments, addFeedback } from "@lib/data-api-client";

function extractUserId(token: string): { userId: string; orgId: string } {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    return { userId: payload.sub as string, orgId: (payload.org_id as string) || "" };
  } catch {
    return { userId: "unknown", orgId: "unknown" };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const { userId, orgId } = extractUserId(auth.apiToken);
  const body = await request.json() as {
    messageId: string | number;
    conversationId: string;
    rating: "up" | "down";
    coachKey?: string;
    mode?: string;
    comment?: string;
  };

  const documentIds = await ensureDataDocuments(auth.apiToken);

  await addFeedback(auth.apiToken, documentIds.feedback, {
    messageId: String(body.messageId),
    conversationId: body.conversationId,
    userId,
    orgId,
    coachKey: body.coachKey ?? null,
    value: body.rating,
    comment: body.comment ?? null,
  });

  return NextResponse.json({ ok: true });
}
