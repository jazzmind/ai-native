import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { conversations, messages, coachSessions } from '../schema';

export interface Conversation {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  coach_key: string | null;
  mode: string | null;
  created_at: string;
}

function toConversation(row: any): Conversation {
  return {
    id: row.id,
    user_id: row.userId,
    project_id: row.projectId,
    title: row.title,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function toMessage(row: any): Message {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content,
    coach_key: row.coachKey,
    mode: row.mode,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createConversation(
  id: string,
  title: string,
  userId: string,
  projectId: string,
  orgId: string
): Promise<Conversation> {
  const db = getDb();
  await db.insert(conversations).values({
    id,
    orgId,
    userId,
    projectId,
    title,
  });
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id));
  return toConversation(row);
}

export async function listConversations(userId: string, projectId: string, orgId?: string): Promise<Conversation[]> {
  const db = getDb();
  const condition = orgId
    ? and(eq(conversations.orgId, orgId), eq(conversations.projectId, projectId))
    : and(eq(conversations.userId, userId), eq(conversations.projectId, projectId));
  const rows = await db
    .select()
    .from(conversations)
    .where(condition)
    .orderBy(desc(conversations.updatedAt));
  return rows.map(toConversation);
}

export async function getConversation(id: string, userId?: string): Promise<Conversation | undefined> {
  const db = getDb();
  const condition = userId
    ? and(eq(conversations.id, id), eq(conversations.userId, userId))
    : eq(conversations.id, id);
  const [row] = await db.select().from(conversations).where(condition);
  return row ? toConversation(row) : undefined;
}

/**
 * Looks up a conversation by id, including org_id — needed by
 * StorageProvider.getConversation(id), whose shared (core) interface returns
 * an object with orgId, which the local `Conversation` shape above omits to
 * avoid changing existing JSON response payloads that spread it directly.
 */
export async function getConversationById(id: string): Promise<(Conversation & { org_id: string }) | undefined> {
  const db = getDb();
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id));
  return row ? { ...toConversation(row), org_id: row.orgId } : undefined;
}

/**
 * Lists conversations scoped to an org (and optionally a project), returning
 * org_id per row. Added for StorageProvider.listConversations(orgId, userId,
 * projectId?), where projectId is optional — unlike listConversations() above.
 */
export async function listConversationsByOrg(
  orgId: string,
  userId: string,
  projectId?: string
): Promise<(Conversation & { org_id: string })[]> {
  const db = getDb();
  const conditions = [eq(conversations.orgId, orgId), eq(conversations.userId, userId)];
  if (projectId) conditions.push(eq(conversations.projectId, projectId));
  const rows = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt));
  return rows.map((row) => ({ ...toConversation(row), org_id: row.orgId }));
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

// Deletes a conversation and its messages. Mirrors the scope of the existing
// deleteProject() cascade above (does not also clean up feedback/activity/
// attachment rows referencing this conversation's messages).
export async function deleteConversationById(id: string): Promise<void> {
  const db = getDb();
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  coachKey: string | null = null,
  mode: string | null = null
): Promise<Message> {
  const db = getDb();
  const [inserted] = await db.insert(messages).values({
    conversationId,
    role,
    content,
    coachKey,
    mode,
  }).returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return toMessage(inserted);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  return rows.map(toMessage);
}

export async function setCoachSession(
  conversationId: string,
  coachKey: string,
  sessionId: string,
  userId?: string
): Promise<void> {
  const db = getDb();
  await db
    .insert(coachSessions)
    .values({
      conversationId,
      coachKey,
      sessionId,
      userId: userId || 'legacy-user',
    })
    .onConflictDoUpdate({
      target: [coachSessions.conversationId, coachSessions.coachKey],
      set: { sessionId },
    });
}

export async function getCoachSession(
  conversationId: string,
  coachKey: string
): Promise<string | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ sessionId: coachSessions.sessionId })
    .from(coachSessions)
    .where(
      and(
        eq(coachSessions.conversationId, conversationId),
        eq(coachSessions.coachKey, coachKey)
      )
    );
  return row?.sessionId;
}
