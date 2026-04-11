import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        coach_key TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS coach_sessions (
        conversation_id TEXT NOT NULL,
        coach_key TEXT NOT NULL,
        session_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (conversation_id, coach_key),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
    `);
  }
  return _db;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  coach_key: string | null;
  created_at: string;
}

export function createConversation(id: string, title: string): Conversation {
  const db = getDb();
  db.prepare("INSERT INTO conversations (id, title) VALUES (?, ?)").run(id, title);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation;
}

export function listConversations(): Conversation[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
    .all() as Conversation[];
}

export function getConversation(id: string): Conversation | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | Conversation
    | undefined;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  coachKey: string | null = null
): Message {
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content, coach_key) VALUES (?, ?, ?, ?)"
  ).run(conversationId, role, content, coachKey);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(
    conversationId
  );
  return db.prepare("SELECT * FROM messages WHERE rowid = last_insert_rowid()").get() as Message;
}

export function getMessages(conversationId: string): Message[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId) as Message[];
}

export function setCoachSession(
  conversationId: string,
  coachKey: string,
  sessionId: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO coach_sessions (conversation_id, coach_key, session_id)
     VALUES (?, ?, ?)
     ON CONFLICT(conversation_id, coach_key) DO UPDATE SET session_id = excluded.session_id`
  ).run(conversationId, coachKey, sessionId);
}

export function getCoachSession(
  conversationId: string,
  coachKey: string
): string | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT session_id FROM coach_sessions WHERE conversation_id = ? AND coach_key = ?")
    .get(conversationId, coachKey) as { session_id: string } | undefined;
  return row?.session_id;
}
