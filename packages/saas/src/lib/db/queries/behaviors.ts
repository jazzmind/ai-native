import { eq, and, asc, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { agentBehaviors, behaviorRevisions } from '../schema';

export interface AgentBehavior {
  id: string;
  coach_key: string;
  project_id: string;
  user_id: string;
  directive: string;
  is_active: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface BehaviorRevision {
  id: string;
  coach_key: string;
  project_id: string;
  user_id: string;
  status: 'proposed' | 'approved' | 'rejected';
  analysis: string;
  proposed_directive: string;
  source_feedback_ids: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function toBehavior(row: any): AgentBehavior {
  return {
    id: row.id,
    coach_key: row.coachKey,
    project_id: row.projectId,
    user_id: row.userId,
    directive: row.directive,
    is_active: row.isActive ? 1 : 0,
    source: row.source || 'manual',
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function toRevision(row: any): BehaviorRevision {
  return {
    id: row.id,
    coach_key: row.coachKey,
    project_id: row.projectId,
    user_id: row.userId,
    status: row.status as 'proposed' | 'approved' | 'rejected',
    analysis: row.analysis,
    proposed_directive: row.proposedDirective,
    source_feedback_ids: row.sourceFeedbackIds,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
    reviewed_at: row.reviewedAt?.toISOString() || null,
  };
}

export async function createBehavior(
  coachKey: string,
  projectId: string,
  userId: string,
  directive: string,
  source = 'manual',
  orgId: string
): Promise<AgentBehavior> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(agentBehaviors).values({
    id,
    orgId,
    coachKey,
    projectId,
    userId,
    directive,
    source,
  });
  const [row] = await db.select().from(agentBehaviors).where(eq(agentBehaviors.id, id));
  return toBehavior(row);
}

export async function listBehaviors(
  userId: string,
  projectId: string,
  coachKey?: string
): Promise<AgentBehavior[]> {
  const db = getDb();
  const conditions = [eq(agentBehaviors.userId, userId), eq(agentBehaviors.projectId, projectId)];
  if (coachKey) conditions.push(eq(agentBehaviors.coachKey, coachKey));

  const rows = await db
    .select()
    .from(agentBehaviors)
    .where(and(...conditions))
    .orderBy(asc(agentBehaviors.coachKey), asc(agentBehaviors.createdAt));
  return rows.map(toBehavior);
}

export async function getActiveBehaviors(
  userId: string,
  projectId: string,
  coachKey: string
): Promise<AgentBehavior[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(agentBehaviors)
    .where(
      and(
        eq(agentBehaviors.userId, userId),
        eq(agentBehaviors.projectId, projectId),
        eq(agentBehaviors.coachKey, coachKey),
        eq(agentBehaviors.isActive, true)
      )
    )
    .orderBy(asc(agentBehaviors.createdAt));
  return rows.map(toBehavior);
}

export async function updateBehavior(
  id: string,
  userId: string,
  updates: { directive?: string; is_active?: number }
): Promise<void> {
  const db = getDb();
  const setValues: Record<string, any> = { updatedAt: new Date() };
  if (updates.directive !== undefined) setValues.directive = updates.directive;
  if (updates.is_active !== undefined) setValues.isActive = updates.is_active === 1;
  await db
    .update(agentBehaviors)
    .set(setValues)
    .where(and(eq(agentBehaviors.id, id), eq(agentBehaviors.userId, userId)));
}

export async function deleteBehavior(id: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(agentBehaviors)
    .where(and(eq(agentBehaviors.id, id), eq(agentBehaviors.userId, userId)));
}

// ── Org-scoped variants for StorageProvider ─────────────────────────────────
// The shared (core) StorageProvider interface scopes behaviors by orgId, not
// projectId (the local schema's actual scoping column, NOT NULL). These
// helpers bridge that gap without changing the project-scoped functions above.

export async function listActiveBehaviorsForOrg(
  orgId: string,
  userId: string,
  coachKey?: string
): Promise<AgentBehavior[]> {
  const db = getDb();
  const conditions = [eq(agentBehaviors.orgId, orgId), eq(agentBehaviors.userId, userId), eq(agentBehaviors.isActive, true)];
  if (coachKey) conditions.push(eq(agentBehaviors.coachKey, coachKey));

  const rows = await db
    .select()
    .from(agentBehaviors)
    .where(and(...conditions))
    .orderBy(asc(agentBehaviors.createdAt));
  return rows.map(toBehavior);
}

/**
 * Creates a behavior with no specific project (project_id stored as '').
 * The core AddBehavior input has no projectId field, unlike createBehavior()
 * above which requires one.
 */
export async function createBehaviorForOrg(
  orgId: string,
  userId: string,
  coachKey: string,
  directive: string,
  source = 'manual'
): Promise<AgentBehavior> {
  return createBehavior(coachKey, '', userId, directive, source, orgId);
}

export async function deactivateBehaviorById(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(agentBehaviors)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(agentBehaviors.id, id));
}

export async function createRevision(
  coachKey: string,
  projectId: string,
  userId: string,
  analysis: string,
  proposedDirective: string,
  sourceFeedbackIds: string[],
  orgId: string
): Promise<BehaviorRevision> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(behaviorRevisions).values({
    id,
    orgId,
    coachKey,
    projectId,
    userId,
    analysis,
    proposedDirective,
    sourceFeedbackIds: JSON.stringify(sourceFeedbackIds),
  });
  const [row] = await db.select().from(behaviorRevisions).where(eq(behaviorRevisions.id, id));
  return toRevision(row);
}

export async function listRevisions(
  userId: string,
  projectId: string,
  status?: string
): Promise<BehaviorRevision[]> {
  const db = getDb();
  const conditions = [eq(behaviorRevisions.userId, userId), eq(behaviorRevisions.projectId, projectId)];
  if (status) conditions.push(eq(behaviorRevisions.status, status));

  const rows = await db
    .select()
    .from(behaviorRevisions)
    .where(and(...conditions))
    .orderBy(desc(behaviorRevisions.createdAt));
  return rows.map(toRevision);
}

export async function updateRevisionStatus(
  id: string,
  userId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const db = getDb();
  await db
    .update(behaviorRevisions)
    .set({ status, reviewedAt: new Date() })
    .where(and(eq(behaviorRevisions.id, id), eq(behaviorRevisions.userId, userId)));
}
