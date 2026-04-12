import { eq, and, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { projects, conversations, knowledgeShares } from '../schema';

export interface Project {
  id: string;
  user_id: string;
  org_id?: string;
  name: string;
  description: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function toProject(row: any): Project {
  return {
    id: row.id,
    user_id: row.userId,
    org_id: row.orgId,
    name: row.name,
    description: row.description || '',
    is_default: row.isDefault ? 1 : 0,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createProject(userId: string, name: string, description = '', orgId = ''): Promise<Project> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(projects).values({
    id,
    orgId,
    userId,
    name,
    description,
  });
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return toProject(row);
}

export async function listProjects(userId: string, orgId?: string): Promise<Project[]> {
  const db = getDb();
  const condition = orgId
    ? and(eq(projects.orgId, orgId))
    : eq(projects.userId, userId);
  const rows = await db
    .select()
    .from(projects)
    .where(condition)
    .orderBy(desc(projects.isDefault), asc(projects.name));
  return rows.map(toProject);
}

export async function getProject(id: string, userId: string): Promise<Project | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return row ? toProject(row) : undefined;
}

export async function updateProject(
  id: string,
  userId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const db = getDb();
  const setValues: Record<string, any> = { updatedAt: new Date() };
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.description !== undefined) setValues.description = updates.description;
  await db
    .update(projects)
    .set(setValues)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(conversations)
    .where(and(eq(conversations.projectId, id), eq(conversations.userId, userId)));
  await db.delete(knowledgeShares).where(eq(knowledgeShares.sourceProjectId, id));
  await db.delete(knowledgeShares).where(eq(knowledgeShares.targetProjectId, id));
  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function getOrCreateDefaultProject(userId: string, orgId = ''): Promise<Project> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.isDefault, true)));

  if (existing) return toProject(existing);

  const id = uuidv4();
  await db.insert(projects).values({
    id,
    orgId,
    userId,
    name: 'Default Project',
    description: '',
    isDefault: true,
  });
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return toProject(row);
}

export async function countProjects(orgId: string): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.orgId, orgId));
  return rows.length;
}
