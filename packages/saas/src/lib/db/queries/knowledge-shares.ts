import { eq, or, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { knowledgeShares } from '../schema';

export interface KnowledgeShare {
  id: string;
  source_project_id: string;
  target_project_id: string;
  collection_id: string | null;
  shared_by_user_id: string;
  created_at: string;
}

function toKnowledgeShare(row: any): KnowledgeShare {
  return {
    id: row.id,
    source_project_id: row.sourceProjectId,
    target_project_id: row.targetProjectId,
    collection_id: row.collectionId,
    shared_by_user_id: row.sharedByUserId,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createKnowledgeShare(
  sourceProjectId: string,
  targetProjectId: string,
  userId: string,
  collectionId?: string
): Promise<KnowledgeShare> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(knowledgeShares).values({
    id,
    sourceProjectId,
    targetProjectId,
    collectionId: collectionId || null,
    sharedByUserId: userId,
  });
  const [row] = await db.select().from(knowledgeShares).where(eq(knowledgeShares.id, id));
  return toKnowledgeShare(row);
}

export async function listKnowledgeShares(projectId: string): Promise<KnowledgeShare[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeShares)
    .where(
      or(
        eq(knowledgeShares.sourceProjectId, projectId),
        eq(knowledgeShares.targetProjectId, projectId)
      )
    );
  return rows.map(toKnowledgeShare);
}

export async function deleteKnowledgeShare(id: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(knowledgeShares)
    .where(and(eq(knowledgeShares.id, id), eq(knowledgeShares.sharedByUserId, userId)));
}
