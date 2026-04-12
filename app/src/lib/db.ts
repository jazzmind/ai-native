import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

let _db: Database.Database | null = null;

const LEGACY_USER_ID = "legacy-user";

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");

    // Core tables with user/project scoping
    _db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '${LEGACY_USER_ID}',
        project_id TEXT NOT NULL DEFAULT '',
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
        user_id TEXT NOT NULL DEFAULT '${LEGACY_USER_ID}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (conversation_id, coach_key),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS knowledge_shares (
        id TEXT PRIMARY KEY,
        source_project_id TEXT NOT NULL,
        target_project_id TEXT NOT NULL,
        collection_id TEXT,
        shared_by_user_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS message_feedback (
        id TEXT PRIMARY KEY,
        message_id INTEGER NOT NULL,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        coach_key TEXT,
        mode TEXT,
        rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS agent_behaviors (
        id TEXT PRIMARY KEY,
        coach_key TEXT NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        directive TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        source TEXT DEFAULT 'manual',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS behavior_revisions (
        id TEXT PRIMARY KEY,
        coach_key TEXT NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
        analysis TEXT NOT NULL,
        proposed_directive TEXT NOT NULL,
        source_feedback_ids TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        reviewed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tool_trust (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        tool_pattern TEXT NOT NULL,
        trust_level TEXT NOT NULL CHECK (trust_level IN ('auto', 'confirm', 'blocked')),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, project_id, tool_pattern)
      );

      CREATE TABLE IF NOT EXISTS review_requests (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id INTEGER,
        requester_user_id TEXT NOT NULL,
        expert_email TEXT NOT NULL,
        expert_user_id TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'expired')),
        context_summary TEXT,
        question TEXT,
        access_token TEXT UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS expert_comments (
        id TEXT PRIMARY KEY,
        review_request_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        author_email TEXT NOT NULL,
        author_name TEXT,
        author_user_id TEXT,
        content TEXT NOT NULL,
        parent_message_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (review_request_id) REFERENCES review_requests(id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
    `);

    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database) {
  const tableInfo = (table: string): string[] => {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(r => r.name);
  };

  // Migrate conversations: add user_id and project_id if missing
  const convCols = tableInfo("conversations");
  if (!convCols.includes("user_id")) {
    db.exec(`ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT '${LEGACY_USER_ID}'`);
  }
  if (!convCols.includes("project_id")) {
    db.exec(`ALTER TABLE conversations ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
  }

  // Migrate coach_sessions: add user_id if missing
  const sessCols = tableInfo("coach_sessions");
  if (!sessCols.includes("user_id")) {
    db.exec(`ALTER TABLE coach_sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT '${LEGACY_USER_ID}'`);
  }

  // Migrate messages: add mode column if missing
  const msgCols = tableInfo("messages");
  if (!msgCols.includes("mode")) {
    db.exec("ALTER TABLE messages ADD COLUMN mode TEXT");
  }

  // Create default project for legacy data if conversations exist without a project
  const orphanConvs = db.prepare(
    "SELECT COUNT(*) as cnt FROM conversations WHERE project_id = '' OR project_id IS NULL"
  ).get() as { cnt: number };

  if (orphanConvs.cnt > 0) {
    const defaultProjectId = "default-project";
    const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(defaultProjectId);
    if (!existing) {
      db.prepare(
        "INSERT OR IGNORE INTO projects (id, user_id, name, description, is_default) VALUES (?, ?, ?, ?, 1)"
      ).run(defaultProjectId, LEGACY_USER_ID, "Default Project", "Auto-created for existing data");
    }
    db.exec(`UPDATE conversations SET project_id = '${defaultProjectId}' WHERE project_id = '' OR project_id IS NULL`);
  }
}

// ── Projects ──

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export function createProject(userId: string, name: string, description = ""): Project {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)"
  ).run(id, userId, name, description);
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
}

export function listProjects(userId: string): Project[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY is_default DESC, name")
    .all(userId) as Project[];
}

export function getProject(id: string, userId: string): Project | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, userId) as Project | undefined;
}

export function updateProject(id: string, userId: string, updates: { name?: string; description?: string }): void {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push("description = ?"); params.push(updates.description); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(id, userId);
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...params);
}

export function deleteProject(id: string, userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE project_id = ? AND user_id = ?").run(id, userId);
  db.prepare("DELETE FROM knowledge_shares WHERE source_project_id = ? OR target_project_id = ?").run(id, id);
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
}

export function getOrCreateDefaultProject(userId: string): Project {
  const db = getDb();
  const existing = db.prepare(
    "SELECT * FROM projects WHERE user_id = ? AND is_default = 1"
  ).get(userId) as Project | undefined;
  if (existing) return existing;

  const id = uuidv4();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, description, is_default) VALUES (?, ?, ?, ?, 1)"
  ).run(id, userId, "Default Project", "");
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
}

// ── Knowledge Shares ──

export interface KnowledgeShare {
  id: string;
  source_project_id: string;
  target_project_id: string;
  collection_id: string | null;
  shared_by_user_id: string;
  created_at: string;
}

export function createKnowledgeShare(
  sourceProjectId: string,
  targetProjectId: string,
  userId: string,
  collectionId?: string
): KnowledgeShare {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO knowledge_shares (id, source_project_id, target_project_id, collection_id, shared_by_user_id) VALUES (?, ?, ?, ?, ?)"
  ).run(id, sourceProjectId, targetProjectId, collectionId || null, userId);
  return db.prepare("SELECT * FROM knowledge_shares WHERE id = ?").get(id) as KnowledgeShare;
}

export function listKnowledgeShares(projectId: string): KnowledgeShare[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM knowledge_shares WHERE source_project_id = ? OR target_project_id = ? ORDER BY created_at"
  ).all(projectId, projectId) as KnowledgeShare[];
}

export function deleteKnowledgeShare(id: string, userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM knowledge_shares WHERE id = ? AND shared_by_user_id = ?").run(id, userId);
}

// ── Conversations (user + project scoped) ──

export interface Conversation {
  id: string;
  user_id: string;
  project_id: string;
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
  mode: string | null;
  created_at: string;
}

export function createConversation(id: string, title: string, userId: string, projectId: string): Conversation {
  const db = getDb();
  db.prepare("INSERT INTO conversations (id, title, user_id, project_id) VALUES (?, ?, ?, ?)").run(id, title, userId, projectId);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation;
}

export function listConversations(userId: string, projectId: string): Conversation[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM conversations WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC")
    .all(userId, projectId) as Conversation[];
}

export function getConversation(id: string, userId?: string): Conversation | undefined {
  const db = getDb();
  if (userId) {
    return db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(id, userId) as Conversation | undefined;
  }
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | undefined;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  coachKey: string | null = null,
  mode: string | null = null
): Message {
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content, coach_key, mode) VALUES (?, ?, ?, ?, ?)"
  ).run(conversationId, role, content, coachKey, mode);
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
  sessionId: string,
  userId?: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO coach_sessions (conversation_id, coach_key, session_id, user_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(conversation_id, coach_key) DO UPDATE SET session_id = excluded.session_id`
  ).run(conversationId, coachKey, sessionId, userId || LEGACY_USER_ID);
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

// ── Message Feedback ──

export interface MessageFeedback {
  id: string;
  message_id: number;
  conversation_id: string;
  user_id: string;
  coach_key: string | null;
  mode: string | null;
  rating: "up" | "down";
  comment: string | null;
  created_at: string;
}

export function addFeedback(
  messageId: number,
  conversationId: string,
  userId: string,
  rating: "up" | "down",
  coachKey?: string | null,
  mode?: string | null,
  comment?: string | null
): MessageFeedback {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO message_feedback (id, message_id, conversation_id, user_id, coach_key, mode, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, messageId, conversationId, userId, coachKey || null, mode || null, rating, comment || null);
  return db.prepare("SELECT * FROM message_feedback WHERE id = ?").get(id) as MessageFeedback;
}

export function getFeedbackForMessage(messageId: number): MessageFeedback | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM message_feedback WHERE message_id = ?").get(messageId) as MessageFeedback | undefined;
}

export function getFeedbackStats(
  userId: string,
  projectId?: string,
  coachKey?: string,
  mode?: string,
  days?: number
): { up: number; down: number; total: number } {
  const db = getDb();
  let query = `
    SELECT 
      SUM(CASE WHEN mf.rating = 'up' THEN 1 ELSE 0 END) as up,
      SUM(CASE WHEN mf.rating = 'down' THEN 1 ELSE 0 END) as down,
      COUNT(*) as total
    FROM message_feedback mf
    JOIN conversations c ON mf.conversation_id = c.id
    WHERE mf.user_id = ?
  `;
  const params: any[] = [userId];

  if (projectId) {
    query += " AND c.project_id = ?";
    params.push(projectId);
  }
  if (coachKey) {
    query += " AND mf.coach_key = ?";
    params.push(coachKey);
  }
  if (mode) {
    query += " AND mf.mode = ?";
    params.push(mode);
  }
  if (days) {
    query += ` AND mf.created_at >= datetime('now', '-${days} days')`;
  }

  const row = db.prepare(query).get(...params) as { up: number; down: number; total: number };
  return { up: row.up || 0, down: row.down || 0, total: row.total || 0 };
}

export function getFeedbackByCoach(
  userId: string,
  projectId?: string
): { coach_key: string; mode: string | null; up: number; down: number; total: number }[] {
  const db = getDb();
  let query = `
    SELECT 
      mf.coach_key,
      mf.mode,
      SUM(CASE WHEN mf.rating = 'up' THEN 1 ELSE 0 END) as up,
      SUM(CASE WHEN mf.rating = 'down' THEN 1 ELSE 0 END) as down,
      COUNT(*) as total
    FROM message_feedback mf
    JOIN conversations c ON mf.conversation_id = c.id
    WHERE mf.user_id = ? AND mf.coach_key IS NOT NULL
  `;
  const params: any[] = [userId];

  if (projectId) {
    query += " AND c.project_id = ?";
    params.push(projectId);
  }

  query += " GROUP BY mf.coach_key, mf.mode ORDER BY mf.coach_key, mf.mode";
  return db.prepare(query).all(...params) as any[];
}

export function getFeedbackTimeline(
  userId: string,
  projectId?: string,
  days = 30
): { date: string; coach_key: string; up: number; down: number }[] {
  const db = getDb();
  let query = `
    SELECT 
      date(mf.created_at) as date,
      mf.coach_key,
      SUM(CASE WHEN mf.rating = 'up' THEN 1 ELSE 0 END) as up,
      SUM(CASE WHEN mf.rating = 'down' THEN 1 ELSE 0 END) as down
    FROM message_feedback mf
    JOIN conversations c ON mf.conversation_id = c.id
    WHERE mf.user_id = ? AND mf.coach_key IS NOT NULL
      AND mf.created_at >= datetime('now', '-${days} days')
  `;
  const params: any[] = [userId];

  if (projectId) {
    query += " AND c.project_id = ?";
    params.push(projectId);
  }

  query += " GROUP BY date(mf.created_at), mf.coach_key ORDER BY date(mf.created_at)";
  return db.prepare(query).all(...params) as any[];
}

export function getModeUsageDistribution(
  userId: string,
  projectId?: string
): { mode: string; count: number }[] {
  const db = getDb();
  let query = `
    SELECT mode, COUNT(*) as count
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = ? AND m.role = 'assistant' AND m.mode IS NOT NULL
  `;
  const params: any[] = [userId];

  if (projectId) {
    query += " AND c.project_id = ?";
    params.push(projectId);
  }

  query += " GROUP BY mode ORDER BY count DESC";
  return db.prepare(query).all(...params) as any[];
}

export function getRecentNegativeFeedback(
  userId: string,
  coachKey: string,
  projectId: string,
  limit = 20
): MessageFeedback[] {
  const db = getDb();
  return db.prepare(`
    SELECT mf.* FROM message_feedback mf
    JOIN conversations c ON mf.conversation_id = c.id
    WHERE mf.user_id = ? AND mf.coach_key = ? AND c.project_id = ? AND mf.rating = 'down'
    ORDER BY mf.created_at DESC LIMIT ?
  `).all(userId, coachKey, projectId, limit) as MessageFeedback[];
}

// ── Agent Behaviors ──

export interface AgentBehavior {
  id: string;
  coach_key: string;
  project_id: string;
  user_id: string;
  directive: string;
  is_active: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export function createBehavior(
  coachKey: string,
  projectId: string,
  userId: string,
  directive: string,
  source = "manual"
): AgentBehavior {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO agent_behaviors (id, coach_key, project_id, user_id, directive, source) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, coachKey, projectId, userId, directive, source);
  return db.prepare("SELECT * FROM agent_behaviors WHERE id = ?").get(id) as AgentBehavior;
}

export function listBehaviors(
  userId: string,
  projectId: string,
  coachKey?: string
): AgentBehavior[] {
  const db = getDb();
  if (coachKey) {
    return db.prepare(
      "SELECT * FROM agent_behaviors WHERE user_id = ? AND project_id = ? AND coach_key = ? ORDER BY created_at"
    ).all(userId, projectId, coachKey) as AgentBehavior[];
  }
  return db.prepare(
    "SELECT * FROM agent_behaviors WHERE user_id = ? AND project_id = ? ORDER BY coach_key, created_at"
  ).all(userId, projectId) as AgentBehavior[];
}

export function getActiveBehaviors(
  userId: string,
  projectId: string,
  coachKey: string
): AgentBehavior[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM agent_behaviors WHERE user_id = ? AND project_id = ? AND coach_key = ? AND is_active = 1 ORDER BY created_at"
  ).all(userId, projectId, coachKey) as AgentBehavior[];
}

export function updateBehavior(
  id: string,
  userId: string,
  updates: { directive?: string; is_active?: number }
): void {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];
  if (updates.directive !== undefined) { sets.push("directive = ?"); params.push(updates.directive); }
  if (updates.is_active !== undefined) { sets.push("is_active = ?"); params.push(updates.is_active); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(id, userId);
  db.prepare(`UPDATE agent_behaviors SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...params);
}

export function deleteBehavior(id: string, userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM agent_behaviors WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── Behavior Revisions ──

export interface BehaviorRevision {
  id: string;
  coach_key: string;
  project_id: string;
  user_id: string;
  status: "proposed" | "approved" | "rejected";
  analysis: string;
  proposed_directive: string;
  source_feedback_ids: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function createRevision(
  coachKey: string,
  projectId: string,
  userId: string,
  analysis: string,
  proposedDirective: string,
  sourceFeedbackIds: string[]
): BehaviorRevision {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO behavior_revisions (id, coach_key, project_id, user_id, analysis, proposed_directive, source_feedback_ids) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, coachKey, projectId, userId, analysis, proposedDirective, JSON.stringify(sourceFeedbackIds));
  return db.prepare("SELECT * FROM behavior_revisions WHERE id = ?").get(id) as BehaviorRevision;
}

export function listRevisions(
  userId: string,
  projectId: string,
  status?: string
): BehaviorRevision[] {
  const db = getDb();
  if (status) {
    return db.prepare(
      "SELECT * FROM behavior_revisions WHERE user_id = ? AND project_id = ? AND status = ? ORDER BY created_at DESC"
    ).all(userId, projectId, status) as BehaviorRevision[];
  }
  return db.prepare(
    "SELECT * FROM behavior_revisions WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC"
  ).all(userId, projectId) as BehaviorRevision[];
}

export function updateRevisionStatus(
  id: string,
  userId: string,
  status: "approved" | "rejected"
): void {
  const db = getDb();
  db.prepare(
    "UPDATE behavior_revisions SET status = ?, reviewed_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(status, id, userId);
}

// ── Tool Trust ──

export interface ToolTrust {
  id: string;
  user_id: string;
  project_id: string;
  tool_pattern: string;
  trust_level: "auto" | "confirm" | "blocked";
  created_at: string;
}

export function getToolTrust(
  userId: string,
  projectId: string,
  toolName: string
): "auto" | "confirm" | "blocked" {
  const db = getDb();
  // Check exact match first, then prefix patterns
  const exact = db.prepare(
    "SELECT trust_level FROM tool_trust WHERE user_id = ? AND project_id = ? AND tool_pattern = ?"
  ).get(userId, projectId, toolName) as { trust_level: string } | undefined;
  if (exact) return exact.trust_level as "auto" | "confirm" | "blocked";

  // Check prefix patterns (e.g., "mcp:slack:*")
  const patterns = db.prepare(
    "SELECT tool_pattern, trust_level FROM tool_trust WHERE user_id = ? AND project_id = ? AND tool_pattern LIKE '%*'"
  ).all(userId, projectId) as { tool_pattern: string; trust_level: string }[];

  for (const p of patterns) {
    const prefix = p.tool_pattern.replace(/\*$/, "");
    if (toolName.startsWith(prefix)) {
      return p.trust_level as "auto" | "confirm" | "blocked";
    }
  }

  return getDefaultToolTrust(toolName);
}

function getDefaultToolTrust(toolName: string): "auto" | "confirm" | "blocked" {
  const autoPatterns = ["web_search", "search", "read", "get", "list", "fetch", "query"];
  const lower = toolName.toLowerCase();
  if (autoPatterns.some((p) => lower.includes(p))) return "auto";
  return "confirm";
}

export function setToolTrust(
  userId: string,
  projectId: string,
  toolPattern: string,
  trustLevel: "auto" | "confirm" | "blocked"
): void {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO tool_trust (id, user_id, project_id, tool_pattern, trust_level) 
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, project_id, tool_pattern) DO UPDATE SET trust_level = excluded.trust_level`
  ).run(id, userId, projectId, toolPattern, trustLevel);
}

export function listToolTrust(userId: string, projectId: string): ToolTrust[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM tool_trust WHERE user_id = ? AND project_id = ? ORDER BY tool_pattern"
  ).all(userId, projectId) as ToolTrust[];
}

export function deleteToolTrust(id: string, userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tool_trust WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── Review Requests ──

export interface ReviewRequest {
  id: string;
  conversation_id: string;
  message_id: number | null;
  requester_user_id: string;
  expert_email: string;
  expert_user_id: string | null;
  status: "pending" | "in_review" | "completed" | "expired";
  context_summary: string | null;
  question: string | null;
  access_token: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

export function createReviewRequest(
  conversationId: string,
  requesterId: string,
  expertEmail: string,
  question: string,
  contextSummary: string,
  accessToken: string,
  expiresAt: string,
  messageId?: number
): ReviewRequest {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO review_requests (id, conversation_id, message_id, requester_user_id, expert_email, question, context_summary, access_token, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, messageId || null, requesterId, expertEmail, question, contextSummary, accessToken, expiresAt);
  return db.prepare("SELECT * FROM review_requests WHERE id = ?").get(id) as ReviewRequest;
}

export function getReviewRequest(id: string): ReviewRequest | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM review_requests WHERE id = ?").get(id) as ReviewRequest | undefined;
}

export function getReviewByToken(token: string): ReviewRequest | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM review_requests WHERE access_token = ? AND expires_at > datetime('now')"
  ).get(token) as ReviewRequest | undefined;
}

export function listReviewRequests(userId: string): ReviewRequest[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM review_requests WHERE requester_user_id = ? OR expert_email IN (
      SELECT email FROM json_each(?) 
    ) ORDER BY created_at DESC`
  ).all(userId, JSON.stringify([userId])) as ReviewRequest[];
}

export function listReviewsForUser(userId: string): ReviewRequest[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM review_requests WHERE requester_user_id = ? ORDER BY created_at DESC"
  ).all(userId) as ReviewRequest[];
}

export function listReviewsForExpert(expertEmail: string): ReviewRequest[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM review_requests WHERE expert_email = ? ORDER BY created_at DESC"
  ).all(expertEmail) as ReviewRequest[];
}

export function updateReviewStatus(
  id: string,
  status: "pending" | "in_review" | "completed" | "expired"
): void {
  const db = getDb();
  const completedAt = status === "completed" ? "datetime('now')" : "NULL";
  db.prepare(
    `UPDATE review_requests SET status = ?, completed_at = ${completedAt} WHERE id = ?`
  ).run(status, id);
}

// ── Expert Comments ──

export interface ExpertComment {
  id: string;
  review_request_id: string;
  conversation_id: string;
  author_email: string;
  author_name: string | null;
  author_user_id: string | null;
  content: string;
  parent_message_id: number | null;
  created_at: string;
}

export function addExpertComment(
  reviewRequestId: string,
  conversationId: string,
  authorEmail: string,
  content: string,
  authorName?: string,
  authorUserId?: string,
  parentMessageId?: number
): ExpertComment {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO expert_comments (id, review_request_id, conversation_id, author_email, author_name, author_user_id, content, parent_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, reviewRequestId, conversationId, authorEmail, authorName || null, authorUserId || null, content, parentMessageId || null);
  return db.prepare("SELECT * FROM expert_comments WHERE id = ?").get(id) as ExpertComment;
}

export function getExpertComments(conversationId: string): ExpertComment[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM expert_comments WHERE conversation_id = ? ORDER BY created_at ASC"
  ).all(conversationId) as ExpertComment[];
}

export function getExpertCommentsByReview(reviewRequestId: string): ExpertComment[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM expert_comments WHERE review_request_id = ? ORDER BY created_at ASC"
  ).all(reviewRequestId) as ExpertComment[];
}
