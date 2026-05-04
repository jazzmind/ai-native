import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { userProfileEntries } from "@/lib/db/schema";
import type { ProfileProvider, ProfileEntry } from "./profile-provider";

export class PostgresProfileProvider implements ProfileProvider {
  readonly type = "postgres";

  async upsert(
    userId: string,
    category: string,
    key: string,
    value: string,
    sourceConversation?: string,
    orgId = "unknown"
  ): Promise<void> {
    const db = getDb();
    await db
      .insert(userProfileEntries)
      .values({ orgId, userId, category, key, value, sourceConversation: sourceConversation ?? null })
      .onConflictDoUpdate({
        target: [userProfileEntries.userId, userProfileEntries.category, userProfileEntries.key],
        set: {
          value,
          sourceConversation: sourceConversation ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async list(userId: string, category?: string): Promise<ProfileEntry[]> {
    const db = getDb();
    const condition = category
      ? and(eq(userProfileEntries.userId, userId), eq(userProfileEntries.category, category))
      : eq(userProfileEntries.userId, userId);

    const rows = await db
      .select()
      .from(userProfileEntries)
      .where(condition)
      .orderBy(asc(userProfileEntries.category), asc(userProfileEntries.key));

    return rows.map(r => ({
      id: String(r.id),
      category: r.category,
      key: r.key,
      value: r.value,
      source_conversation: r.sourceConversation,
      created_at: r.createdAt?.toISOString() ?? new Date().toISOString(),
      updated_at: r.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  async delete(userId: string, id: string): Promise<void> {
    const db = getDb();
    await db
      .delete(userProfileEntries)
      .where(and(eq(userProfileEntries.id, Number(id)), eq(userProfileEntries.userId, userId)));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
