import Database from "better-sqlite3";
import path from "path";
import type { ProfileProvider, ProfileEntry } from "./profile-provider";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

export class StandaloneProfileProvider implements ProfileProvider {
  readonly type = "standalone";
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL DEFAULT 'legacy-user',
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source_conversation TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, category, key)
      );
    `);
    this.migrate();
  }

  private migrate() {
    const cols = (this.db.prepare("PRAGMA table_info(user_profile)").all() as any[]).map(r => r.name);
    if (!cols.includes("user_id")) {
      this.db.exec("ALTER TABLE user_profile ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy-user'");
      // Recreate unique index to include user_id
      try {
        this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_user_cat_key ON user_profile(user_id, category, key)");
      } catch {
        // Index may conflict with existing UNIQUE constraint; that's OK for migration
      }
    }
  }

  async upsert(userId: string, category: string, key: string, value: string, sourceConversation?: string): Promise<void> {
    // Try the new unique constraint first, fall back to legacy
    try {
      this.db.prepare(
        `INSERT INTO user_profile (user_id, category, key, value, source_conversation)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, category, key) DO UPDATE SET
           value = excluded.value,
           source_conversation = excluded.source_conversation,
           updated_at = datetime('now')`
      ).run(userId, category, key, value, sourceConversation || null);
    } catch {
      // Fallback for tables with old UNIQUE(category, key) constraint
      this.db.prepare(
        `INSERT INTO user_profile (user_id, category, key, value, source_conversation)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(category, key) DO UPDATE SET
           value = excluded.value,
           user_id = excluded.user_id,
           source_conversation = excluded.source_conversation,
           updated_at = datetime('now')`
      ).run(userId, category, key, value, sourceConversation || null);
    }
  }

  async list(userId: string, category?: string): Promise<ProfileEntry[]> {
    if (category) {
      return this.db
        .prepare("SELECT *, CAST(id AS TEXT) as id FROM user_profile WHERE user_id = ? AND category = ? ORDER BY key")
        .all(userId, category)
        .map(mapRow);
    }
    return this.db
      .prepare("SELECT *, CAST(id AS TEXT) as id FROM user_profile WHERE user_id = ? ORDER BY category, key")
      .all(userId)
      .map(mapRow);
  }

  async delete(userId: string, id: string): Promise<void> {
    this.db.prepare("DELETE FROM user_profile WHERE id = ? AND user_id = ?").run(Number(id), userId);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

function mapRow(r: any): ProfileEntry {
  return {
    id: String(r.id),
    category: r.category,
    key: r.key,
    value: r.value,
    source_conversation: r.source_conversation,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
