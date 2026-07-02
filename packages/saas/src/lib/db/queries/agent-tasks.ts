import { eq, and, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { agentTasks } from '../schema';
import type { TaskStatus } from '@ai-native/core';

// Local status enum ('pending' | 'triggered' | 'completed' | 'dismissed') vs.
// core TaskStatus ('pending' | 'processing' | 'completed' | 'failed' | 'cancelled').
// These two mappings are lossy in one direction (both 'failed' and 'cancelled'
// collapse to local 'dismissed') since the local schema has no equivalent split.
const CORE_TO_LOCAL_STATUS: Record<TaskStatus, 'pending' | 'triggered' | 'completed' | 'dismissed'> = {
  pending: 'pending',
  processing: 'triggered',
  completed: 'completed',
  failed: 'dismissed',
  cancelled: 'dismissed',
};

export const LOCAL_TO_CORE_STATUS: Record<'pending' | 'triggered' | 'completed' | 'dismissed', TaskStatus> = {
  pending: 'pending',
  triggered: 'processing',
  completed: 'completed',
  dismissed: 'cancelled',
};

export async function createAgentTask(data: {
  orgId: string;
  userId: string;
  projectId: string;
  conversationId: string;
  taskType: 'coaching_followup' | 'reminder' | 'deadline' | 'check_in' | 'status_report_collection' | 'ea_briefing';
  coachKey: string;
  triggerAt: Date;
  repeatInterval: string | null;
  context: Record<string, unknown>;
}) {
  const db = getDb();
  const id = uuidv4();

  const [task] = await db.insert(agentTasks).values({
    id,
    orgId: data.orgId,
    userId: data.userId,
    projectId: data.projectId,
    conversationId: data.conversationId,
    taskType: data.taskType,
    coachKey: data.coachKey,
    triggerAt: data.triggerAt,
    repeatInterval: data.repeatInterval,
    context: data.context,
  }).returning();

  return task;
}

export async function getDueTasks() {
  const db = getDb();
  return db.select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.status, 'pending'),
        lte(agentTasks.triggerAt, new Date()),
      )
    );
}

export async function markTaskTriggered(taskId: string) {
  const db = getDb();
  await db.update(agentTasks)
    .set({
      status: 'triggered',
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentTasks.id, taskId));
}

export async function rescheduleTask(taskId: string, nextTriggerAt: Date) {
  const db = getDb();
  await db.update(agentTasks)
    .set({
      status: 'pending',
      triggerAt: nextTriggerAt,
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentTasks.id, taskId));
}

export async function listAgentTasksForUser(userId: string, projectId: string) {
  const db = getDb();
  return db.select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.userId, userId),
        eq(agentTasks.projectId, projectId),
      )
    )
    .orderBy(sql`${agentTasks.triggerAt} desc`);
}

export async function updateAgentTask(taskId: string, userId: string, updates: {
  title?: string;
  repeatInterval?: string | null;
  triggerAt?: Date;
  context?: Record<string, unknown>;
}) {
  const db = getDb();
  const task = await db.select().from(agentTasks).where(
    and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId))
  ).then((rows) => rows[0]);

  if (!task) throw new Error("Task not found");

  const newContext = updates.context ?? (task.context as Record<string, unknown> | null) ?? {};
  if (updates.title) newContext.title = updates.title;

  await db.update(agentTasks)
    .set({
      ...(updates.repeatInterval !== undefined ? { repeatInterval: updates.repeatInterval } : {}),
      ...(updates.triggerAt ? { triggerAt: updates.triggerAt } : {}),
      context: newContext,
      updatedAt: new Date(),
    })
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId)));
}

export async function getAgentTask(taskId: string, userId: string) {
  const db = getDb();
  const [task] = await db.select().from(agentTasks).where(
    and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId))
  );
  return task;
}

export async function getAgentTaskById(taskId: string) {
  const db = getDb();
  const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId));
  return task;
}

/**
 * Generic status setter for StorageProvider.updateTaskStatus(id, status, result?),
 * whose core TaskStatus enum doesn't map 1:1 onto the local schema's status
 * column (see CORE_TO_LOCAL_STATUS above). `result` — also not a dedicated
 * column locally — is merged into the existing `context` jsonb blob.
 */
export async function updateTaskStatus(id: string, status: TaskStatus, result?: string): Promise<void> {
  const db = getDb();
  const updates: Record<string, unknown> = {
    status: CORE_TO_LOCAL_STATUS[status],
    updatedAt: new Date(),
  };

  if (result !== undefined) {
    const [existing] = await db.select({ context: agentTasks.context }).from(agentTasks).where(eq(agentTasks.id, id));
    updates.context = { ...((existing?.context as Record<string, unknown> | null) ?? {}), result };
  }

  await db.update(agentTasks).set(updates).where(eq(agentTasks.id, id));
}

/**
 * Lists a user's pending tasks across all projects, optionally only those
 * due before a given time. Added for StorageProvider.listPendingTasks(userId,
 * before?) — distinct from getDueTasks() (global, cron-job specific) and
 * listAgentTasksForUser() (project-scoped, all statuses) above.
 */
export async function listPendingTasksForUser(userId: string, before?: Date) {
  const db = getDb();
  const conditions = [eq(agentTasks.userId, userId), eq(agentTasks.status, 'pending')];
  if (before) conditions.push(lte(agentTasks.triggerAt, before));
  return db
    .select()
    .from(agentTasks)
    .where(and(...conditions))
    .orderBy(sql`${agentTasks.triggerAt} asc`);
}

export async function dismissTask(taskId: string, userId: string) {
  const db = getDb();
  await db.update(agentTasks)
    .set({
      status: 'dismissed',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentTasks.id, taskId),
        eq(agentTasks.userId, userId),
      )
    );
}
