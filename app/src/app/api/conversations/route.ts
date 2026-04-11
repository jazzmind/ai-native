import { NextRequest } from "next/server";
import { listConversations, getMessages, getConversation } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const conversation = getConversation(id);
    if (!conversation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const messages = getMessages(id);
    return Response.json({ conversation, messages });
  }

  const conversations = listConversations();
  return Response.json({ conversations });
}
