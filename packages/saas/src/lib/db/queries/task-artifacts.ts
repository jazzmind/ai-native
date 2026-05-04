import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { taskArtifacts } from '../schema';

export interface TaskArtifact {
  id: string;
  taskId: string;
  orgId: string;
  userId: string;
  title: string;
  content: string;
  artifactType: string;
  runNumber: number;
  createdAt: Date | null;
}

export async function createArtifact(data: {
  taskId: string;
  orgId: string;
  userId: string;
  title: string;
  content: string;
  artifactType: string;
}): Promise<TaskArtifact> {
  const db = getDb();
  const id = uuidv4();

  // Get next run number for this task
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskArtifacts)
    .where(eq(taskArtifacts.taskId, data.taskId));

  const runNumber = Number(countRow?.count ?? 0) + 1;

  const [artifact] = await db.insert(taskArtifacts).values({
    id,
    taskId: data.taskId,
    orgId: data.orgId,
    userId: data.userId,
    title: data.title,
    content: data.content,
    artifactType: data.artifactType,
    runNumber,
  }).returning();

  return artifact as TaskArtifact;
}

export async function listArtifactsForTask(taskId: string): Promise<TaskArtifact[]> {
  const db = getDb();
  return db.select()
    .from(taskArtifacts)
    .where(eq(taskArtifacts.taskId, taskId))
    .orderBy(desc(taskArtifacts.createdAt)) as Promise<TaskArtifact[]>;
}

export async function getArtifact(id: string): Promise<TaskArtifact | undefined> {
  const db = getDb();
  const [artifact] = await db.select()
    .from(taskArtifacts)
    .where(eq(taskArtifacts.id, id));
  return artifact as TaskArtifact | undefined;
}

export async function getArtifactForUser(id: string, userId: string): Promise<TaskArtifact | undefined> {
  const db = getDb();
  const [artifact] = await db.select()
    .from(taskArtifacts)
    .where(and(eq(taskArtifacts.id, id), eq(taskArtifacts.userId, userId)));
  return artifact as TaskArtifact | undefined;
}

export async function countArtifactsForTask(taskId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskArtifacts)
    .where(eq(taskArtifacts.taskId, taskId));
  return Number(row?.count ?? 0);
}

export async function getLatestArtifactForTask(taskId: string): Promise<TaskArtifact | undefined> {
  const db = getDb();
  const [artifact] = await db.select()
    .from(taskArtifacts)
    .where(eq(taskArtifacts.taskId, taskId))
    .orderBy(desc(taskArtifacts.createdAt))
    .limit(1);
  return artifact as TaskArtifact | undefined;
}
