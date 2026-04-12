import Database from "better-sqlite3";
import path from "path";
import type { ActivityProvider, ActivityEntry } from "./activity-provider";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

export class StandaloneActivityProvider implements ActivityProvider {
  readonly type = "standalone";
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL DEFAULT 'legacy-user',
        conversation_id TEXT NOT NULL,
        coach_key TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.migrate();
  }

  private migrate() {
    const cols = (this.db.prepare("PRAGMA table_info(agent_activity)").all() as any[]).map(r => r.name);
    if (!cols.includes("user_id")) {
      this.db.exec("ALTER TABLE agent_activity ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy-user'");
    }
  }

  async add(userId: string, conversationId: string, coachKey: string, eventType: string, eventData: Record<string, unknown> = {}): Promise<void> {
    this.db.prepare(
      "INSERT INTO agent_activity (user_id, conversation_id, coach_key, event_type, event_data) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, conversationId, coachKey, eventType, JSON.stringify(eventData));
  }

  async listByConversation(userId: string, conversationId: string): Promise<ActivityEntry[]> {
    return this.db
      .prepare("SELECT *, CAST(id AS TEXT) as id FROM agent_activity WHERE user_id = ? AND conversation_id = ? ORDER BY created_at ASC")
      .all(userId, conversationId)
      .map(mapRow);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

function mapRow(r: any): ActivityEntry {
  return {
    id: String(r.id),
    conversation_id: r.conversation_id,
    coach_key: r.coach_key,
    event_type: r.event_type,
    event_data: r.event_data,
    created_at: r.created_at,
  };
}
