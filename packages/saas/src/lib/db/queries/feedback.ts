import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { messageFeedback, conversations, messages } from '../schema';

export interface MessageFeedback {
  id: string;
  message_id: number;
  conversation_id: string;
  user_id: string;
  coach_key: string | null;
  mode: string | null;
  rating: 'up' | 'down';
  comment: string | null;
  created_at: string;
}

function toFeedback(row: any): MessageFeedback {
  return {
    id: row.id,
    message_id: row.messageId,
    conversation_id: row.conversationId,
    user_id: row.userId,
    coach_key: row.coachKey,
    mode: row.mode,
    rating: row.rating as 'up' | 'down',
    comment: row.comment,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function addFeedback(
  messageId: number,
  conversationId: string,
  userId: string,
  rating: 'up' | 'down',
  coachKey?: string | null,
  mode?: string | null,
  comment?: string | null
): Promise<MessageFeedback> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(messageFeedback).values({
    id,
    messageId,
    conversationId,
    userId,
    coachKey: coachKey || null,
    mode: mode || null,
    rating,
    comment: comment || null,
  });
  const [row] = await db.select().from(messageFeedback).where(eq(messageFeedback.id, id));
  return toFeedback(row);
}

export async function getFeedbackForMessage(messageId: number): Promise<MessageFeedback | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(messageFeedback)
    .where(eq(messageFeedback.messageId, messageId));
  return row ? toFeedback(row) : undefined;
}

export async function getFeedbackStats(
  userId: string,
  projectId?: string,
  coachKey?: string,
  mode?: string,
  days?: number
): Promise<{ up: number; down: number; total: number }> {
  const db = getDb();
  const conditions = [eq(messageFeedback.userId, userId)];

  if (coachKey) conditions.push(eq(messageFeedback.coachKey, coachKey));
  if (mode) conditions.push(eq(messageFeedback.mode, mode));
  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    conditions.push(gte(messageFeedback.createdAt, since));
  }

  const rows = await db
    .select({
      rating: messageFeedback.rating,
    })
    .from(messageFeedback)
    .innerJoin(conversations, eq(messageFeedback.conversationId, conversations.id))
    .where(
      projectId
        ? and(...conditions, eq(conversations.projectId, projectId))
        : and(...conditions)
    );

  let up = 0, down = 0;
  for (const row of rows) {
    if (row.rating === 'up') up++;
    else if (row.rating === 'down') down++;
  }
  return { up, down, total: up + down };
}

export async function getFeedbackByCoach(
  userId: string,
  projectId?: string
): Promise<{ coach_key: string; mode: string | null; up: number; down: number; total: number }[]> {
  const db = getDb();
  const conditions = [
    eq(messageFeedback.userId, userId),
    sql`${messageFeedback.coachKey} IS NOT NULL`,
  ];

  if (projectId) {
    conditions.push(eq(conversations.projectId, projectId));
  }

  const rows = await db
    .select({
      coachKey: messageFeedback.coachKey,
      mode: messageFeedback.mode,
      rating: messageFeedback.rating,
    })
    .from(messageFeedback)
    .innerJoin(conversations, eq(messageFeedback.conversationId, conversations.id))
    .where(and(...conditions));

  const grouped = new Map<string, { coach_key: string; mode: string | null; up: number; down: number; total: number }>();
  for (const row of rows) {
    const key = `${row.coachKey}|${row.mode}`;
    if (!grouped.has(key)) {
      grouped.set(key, { coach_key: row.coachKey!, mode: row.mode, up: 0, down: 0, total: 0 });
    }
    const entry = grouped.get(key)!;
    if (row.rating === 'up') entry.up++;
    else if (row.rating === 'down') entry.down++;
    entry.total++;
  }
  return Array.from(grouped.values());
}

export async function getFeedbackTimeline(
  userId: string,
  projectId?: string,
  days = 30
): Promise<{ date: string; coach_key: string; up: number; down: number }[]> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const conditions = [
    eq(messageFeedback.userId, userId),
    sql`${messageFeedback.coachKey} IS NOT NULL`,
    gte(messageFeedback.createdAt, since),
  ];

  if (projectId) {
    conditions.push(eq(conversations.projectId, projectId));
  }

  const rows = await db
    .select({
      createdAt: messageFeedback.createdAt,
      coachKey: messageFeedback.coachKey,
      rating: messageFeedback.rating,
    })
    .from(messageFeedback)
    .innerJoin(conversations, eq(messageFeedback.conversationId, conversations.id))
    .where(and(...conditions));

  const grouped = new Map<string, { date: string; coach_key: string; up: number; down: number }>();
  for (const row of rows) {
    const date = row.createdAt?.toISOString().split('T')[0] || '';
    const key = `${date}|${row.coachKey}`;
    if (!grouped.has(key)) {
      grouped.set(key, { date, coach_key: row.coachKey!, up: 0, down: 0 });
    }
    const entry = grouped.get(key)!;
    if (row.rating === 'up') entry.up++;
    else entry.down++;
  }
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getModeUsageDistribution(
  userId: string,
  projectId?: string
): Promise<{ mode: string; count: number }[]> {
  const db = getDb();
  const conditions = [
    eq(conversations.userId, userId),
    eq(messages.role, 'assistant'),
    sql`${messages.mode} IS NOT NULL`,
  ];

  if (projectId) {
    conditions.push(eq(conversations.projectId, projectId));
  }

  const rows = await db
    .select({ mode: messages.mode })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(...conditions));

  const grouped = new Map<string, number>();
  for (const row of rows) {
    if (row.mode) {
      grouped.set(row.mode, (grouped.get(row.mode) || 0) + 1);
    }
  }
  return Array.from(grouped.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getRecentNegativeFeedback(
  userId: string,
  coachKey: string,
  projectId: string,
  limit = 20
): Promise<MessageFeedback[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messageFeedback)
    .innerJoin(conversations, eq(messageFeedback.conversationId, conversations.id))
    .where(
      and(
        eq(messageFeedback.userId, userId),
        eq(messageFeedback.coachKey, coachKey),
        eq(conversations.projectId, projectId),
        eq(messageFeedback.rating, 'down')
      )
    )
    .orderBy(desc(messageFeedback.createdAt))
    .limit(limit);

  return rows.map((r) => toFeedback(r.message_feedback));
}
