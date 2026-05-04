import { eq, and, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { agentTasks } from '../schema';

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
