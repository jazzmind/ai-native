import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { agentActivity } from "@/lib/db/schema";
import type { ActivityProvider, ActivityEntry } from "./activity-provider";

export class PostgresActivityProvider implements ActivityProvider {
  readonly type = "postgres";

  async add(
    userId: string,
    conversationId: string,
    coachKey: string,
    eventType: string,
    eventData: Record<string, unknown> = {},
    orgId = "unknown"
  ): Promise<void> {
    const db = getDb();
    await db.insert(agentActivity).values({
      orgId,
      userId,
      conversationId,
      coachKey,
      eventType,
      eventData,
    });
  }

  async listByConversation(userId: string, conversationId: string): Promise<ActivityEntry[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(agentActivity)
      .where(and(eq(agentActivity.userId, userId), eq(agentActivity.conversationId, conversationId)))
      .orderBy(asc(agentActivity.createdAt));

    return rows.map(r => ({
      id: String(r.id),
      conversation_id: r.conversationId,
      coach_key: r.coachKey,
      event_type: r.eventType,
      event_data: JSON.stringify(r.eventData ?? {}),
      created_at: r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
