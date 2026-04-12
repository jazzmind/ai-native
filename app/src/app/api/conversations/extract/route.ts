import { NextRequest } from "next/server";
import { getConversation, getMessages } from "@/lib/db";
import { extractFromThread } from "@/lib/auto-extract";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { conversationId, projectId } = (await req.json()) as {
    conversationId: string;
    projectId: string;
  };

  if (!conversationId || !projectId) {
    return Response.json(
      { error: "conversationId and projectId are required" },
      { status: 400 }
    );
  }

  const conversation = await getConversation(conversationId, user.id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await getMessages(conversationId);
  if (messages.length === 0) {
    return Response.json({ facts: [], knowledge: [] });
  }

  const result = await extractFromThread(
    messages.map((m) => ({
      role: m.role,
      content: m.content,
      coach_key: m.coach_key,
    })),
    user.id,
    projectId,
    conversationId
  );

  return Response.json(result);
}
