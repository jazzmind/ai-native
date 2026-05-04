import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/db/queries/notifications";

export async function GET() {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const notifications = await getUnreadNotifications(user.id);
    return Response.json({ notifications });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const { notificationId, markAllRead } = await req.json();

    if (markAllRead) {
      await markAllNotificationsRead(user.id);
    } else if (notificationId) {
      await markNotificationRead(notificationId, user.id);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Failed to update notifications:", err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
