import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@lib/auth-middleware";
import { getStorageProvider } from "@lib/providers";

function extractUserId(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    return payload.sub as string;
  } catch {
    return "unknown";
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const userId = extractUserId(auth.apiToken);
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const withMessages = searchParams.get("messages") === "1";
  const conversationId = searchParams.get("id");

  const storage = getStorageProvider(auth.apiToken);

  if (conversationId && withMessages) {
    const messages = await storage.listMessages(conversationId);
    return NextResponse.json({ messages });
  }

  // Busibox has no real org concept — the synthesized org id is the user id.
  const conversations = await storage.listConversations(userId, userId, projectId);
  return NextResponse.json({ conversations });
}
