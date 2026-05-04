import { eq, and, like } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { toolTrust } from '../schema';

export interface ToolTrust {
  id: string;
  user_id: string;
  project_id: string;
  tool_pattern: string;
  trust_level: 'auto' | 'confirm' | 'blocked';
  created_at: string;
}

function toToolTrust(row: any): ToolTrust {
  return {
    id: row.id,
    user_id: row.userId,
    project_id: row.projectId,
    tool_pattern: row.toolPattern,
    trust_level: row.trustLevel as 'auto' | 'confirm' | 'blocked',
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

function getDefaultToolTrust(toolName: string): 'auto' | 'confirm' | 'blocked' {
  const autoPatterns = ['web_search', 'search', 'read', 'get', 'list', 'fetch', 'query'];
  const lower = toolName.toLowerCase();
  if (autoPatterns.some((p) => lower.includes(p))) return 'auto';
  return 'confirm';
}

export async function getToolTrust(
  userId: string,
  projectId: string,
  toolName: string
): Promise<'auto' | 'confirm' | 'blocked'> {
  const db = getDb();

  const [exact] = await db
    .select({ trustLevel: toolTrust.trustLevel })
    .from(toolTrust)
    .where(
      and(
        eq(toolTrust.userId, userId),
        eq(toolTrust.projectId, projectId),
        eq(toolTrust.toolPattern, toolName)
      )
    );
  if (exact) return exact.trustLevel as 'auto' | 'confirm' | 'blocked';

  const patterns = await db
    .select({ toolPattern: toolTrust.toolPattern, trustLevel: toolTrust.trustLevel })
    .from(toolTrust)
    .where(
      and(
        eq(toolTrust.userId, userId),
        eq(toolTrust.projectId, projectId),
        like(toolTrust.toolPattern, '%*')
      )
    );

  for (const p of patterns) {
    const prefix = p.toolPattern.replace(/\*$/, '');
    if (toolName.startsWith(prefix)) {
      return p.trustLevel as 'auto' | 'confirm' | 'blocked';
    }
  }

  return getDefaultToolTrust(toolName);
}

export async function setToolTrust(
  userId: string,
  projectId: string,
  toolPattern: string,
  trustLevel: 'auto' | 'confirm' | 'blocked'
): Promise<void> {
  const db = getDb();
  const id = uuidv4();
  await db
    .insert(toolTrust)
    .values({ id, userId, projectId, toolPattern, trustLevel, orgId: '' })
    .onConflictDoUpdate({
      target: [toolTrust.userId, toolTrust.projectId, toolTrust.toolPattern],
      set: { trustLevel },
    });
}

export async function listToolTrust(userId: string, projectId: string): Promise<ToolTrust[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(toolTrust)
    .where(and(eq(toolTrust.userId, userId), eq(toolTrust.projectId, projectId)));
  return rows.map(toToolTrust);
}

export async function deleteToolTrust(id: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(toolTrust)
    .where(and(eq(toolTrust.id, id), eq(toolTrust.userId, userId)));
}
