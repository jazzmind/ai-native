import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { eaMemory } from '../schema';

export type EaMemoryType = 'template' | 'recurring_task' | 'contact' | 'preference' | 'context';

export interface EaMemoryEntry {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  memoryType: EaMemoryType;
  key: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export async function upsertEaMemory(data: {
  orgId: string;
  userId: string;
  projectId: string;
  memoryType: EaMemoryType;
  key: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<EaMemoryEntry> {
  const db = getDb();
  const id = uuidv4();
  const [entry] = await db
    .insert(eaMemory)
    .values({
      id,
      orgId: data.orgId,
      userId: data.userId,
      projectId: data.projectId,
      memoryType: data.memoryType,
      key: data.key,
      title: data.title,
      content: data.content,
      metadata: data.metadata ?? null,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [eaMemory.userId, eaMemory.projectId, eaMemory.key],
      set: {
        title: data.title,
        content: data.content,
        metadata: data.metadata ?? null,
        memoryType: data.memoryType,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();
  return entry as EaMemoryEntry;
}

export async function getEaMemory(userId: string, projectId: string, key: string): Promise<EaMemoryEntry | null> {
  const db = getDb();
  const [entry] = await db
    .select()
    .from(eaMemory)
    .where(and(eq(eaMemory.userId, userId), eq(eaMemory.projectId, projectId), eq(eaMemory.key, key), eq(eaMemory.isActive, true)));
  return (entry as EaMemoryEntry) ?? null;
}

export async function listEaMemory(userId: string, projectId: string, memoryType?: EaMemoryType): Promise<EaMemoryEntry[]> {
  const db = getDb();
  const conditions = [eq(eaMemory.userId, userId), eq(eaMemory.projectId, projectId), eq(eaMemory.isActive, true)];
  if (memoryType) conditions.push(eq(eaMemory.memoryType, memoryType));
  return db.select().from(eaMemory).where(and(...conditions)) as Promise<EaMemoryEntry[]>;
}

export async function deleteEaMemory(userId: string, projectId: string, key: string): Promise<void> {
  const db = getDb();
  await db
    .update(eaMemory)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(eaMemory.userId, userId), eq(eaMemory.projectId, projectId), eq(eaMemory.key, key)));
}

export function formatEaMemoryForPrompt(entries: EaMemoryEntry[]): string {
  if (entries.length === 0) return '';
  const grouped: Record<string, EaMemoryEntry[]> = {};
  for (const e of entries) {
    (grouped[e.memoryType] ??= []).push(e);
  }
  const sections: string[] = [];
  const typeLabels: Record<string, string> = {
    template: 'Saved Templates',
    recurring_task: 'Recurring Workflows',
    contact: 'Known Contacts',
    preference: 'User Preferences',
    context: 'Standing Context',
  };
  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] ?? type;
    sections.push(`### ${label}\n` + items.map((e) => `**${e.title}** (key: ${e.key})\n${e.content}`).join('\n\n'));
  }
  return sections.join('\n\n');
}
