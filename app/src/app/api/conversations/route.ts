import { NextRequest } from "next/server";
import { listConversations, getMessages, getConversation, getExpertComments } from "@/lib/db";
import { getActivityProvider } from "@/lib/activity";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const id = req.nextUrl.searchParams.get("id");
    const projectId = req.nextUrl.searchParams.get("projectId");

    if (id) {
      const conversation = getConversation(id, user.id);
      if (!conversation) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      const messages = getMessages(id);
      const activityProvider = getActivityProvider();
      const activity = await activityProvider.listByConversation(user.id, id);
      const expertComments = getExpertComments(id);
      return Response.json({ conversation, messages, activity, expertComments });
    }

    if (!projectId) {
      return Response.json({ error: "projectId required" }, { status: 400 });
    }
    const conversations = listConversations(user.id, projectId);
    return Response.json({ conversations });
  } catch (err) {
    return handleAuthError(err);
  }
}
