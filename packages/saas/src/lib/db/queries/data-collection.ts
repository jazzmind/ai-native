import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { dataCollectionSessions } from '../schema';

export interface DataCollectionSession {
  id: string;
  token: string;
  taskId: string;
  userId: string;
  orgId: string;
  status: string;
  collectedData: string | null;
  expiresAt: Date;
  createdAt: Date | null;
  completedAt: Date | null;
}

export interface CollectedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function createDataCollectionSession(data: {
  taskId: string;
  userId: string;
  orgId: string;
  expiresAt: Date;
}): Promise<DataCollectionSession> {
  const db = getDb();
  const id = uuidv4();
  const token = uuidv4();

  const [session] = await db.insert(dataCollectionSessions).values({
    id,
    token,
    taskId: data.taskId,
    userId: data.userId,
    orgId: data.orgId,
    status: 'open',
    expiresAt: data.expiresAt,
  }).returning();

  return session as DataCollectionSession;
}

export async function getSessionByToken(token: string): Promise<DataCollectionSession | undefined> {
  const db = getDb();
  const [session] = await db.select()
    .from(dataCollectionSessions)
    .where(eq(dataCollectionSessions.token, token));
  return session as DataCollectionSession | undefined;
}

export async function updateSessionData(token: string, messages: CollectedMessage[]): Promise<void> {
  const db = getDb();
  await db.update(dataCollectionSessions)
    .set({ collectedData: JSON.stringify(messages) })
    .where(eq(dataCollectionSessions.token, token));
}

export async function completeSession(token: string): Promise<void> {
  const db = getDb();
  await db.update(dataCollectionSessions)
    .set({ status: 'complete', completedAt: new Date() })
    .where(eq(dataCollectionSessions.token, token));
}
