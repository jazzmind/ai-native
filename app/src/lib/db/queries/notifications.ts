import { eq, and, isNull, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { notifications } from '../schema';

export async function createNotification(data: {
  orgId: string;
  userId: string;
  type: 'agent_message' | 'review_complete' | 'task_due';
  title: string;
  body?: string;
  conversationId?: string;
}) {
  const db = getDb();
  const id = uuidv4();

  const [notification] = await db.insert(notifications).values({
    id,
    orgId: data.orgId,
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body || null,
    conversationId: data.conversationId || null,
  }).returning();

  return notification;
}

export async function getUnreadNotifications(userId: string) {
  const db = getDb();
  return db.select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(20);
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const db = getDb();
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      )
    );
}

export async function markAllNotificationsRead(userId: string) {
  const db = getDb();
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      )
    );
}
