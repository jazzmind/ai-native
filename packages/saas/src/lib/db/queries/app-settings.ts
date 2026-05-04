import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index';
import { appSettings } from '../schema';

export async function getAppSetting<T = unknown>(orgId: string, key: string): Promise<T | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.orgId, orgId), eq(appSettings.key, key)));
  if (!row) return null;
  return row.value as T;
}

export async function setAppSetting<T = unknown>(orgId: string, key: string, value: T): Promise<void> {
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ id: uuidv4(), orgId, key, value: value as any, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [appSettings.orgId, appSettings.key],
      set: { value: value as any, updatedAt: new Date() },
    });
}
