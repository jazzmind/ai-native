import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'legacy-user',
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (key, user_id)
      );

      CREATE TABLE IF NOT EXISTS deploy_targets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'legacy-user',
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'unconfigured',
        last_deployed_at TEXT,
        agent_state_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS mcp_connections (
        id TEXT PRIMARY KEY,
        target_id TEXT NOT NULL,
        mcp_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'disconnected',
        vault_id TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (target_id) REFERENCES deploy_targets(id)
      );
    `);
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database) {
  // Migrate deploy_targets: add user_id if missing
  const dtCols = (db.prepare("PRAGMA table_info(deploy_targets)").all() as any[]).map(r => r.name);
  if (!dtCols.includes("user_id")) {
    db.exec("ALTER TABLE deploy_targets ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy-user'");
  }

  // Migrate config: check if user_id column exists
  const cfgCols = (db.prepare("PRAGMA table_info(config)").all() as any[]).map(r => r.name);
  if (!cfgCols.includes("user_id")) {
    db.exec("ALTER TABLE config ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy-user'");
  }
}

const MACHINE_KEY = crypto.createHash("sha256")
  .update(process.env.CONFIG_ENCRYPTION_KEY || `coach-platform-${process.cwd()}`)
  .digest();

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", MACHINE_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", MACHINE_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// ── Config (key-value, user-scoped) ──

export function getConfig(key: string, userId = "legacy-user"): string | null {
  const row = getDb().prepare("SELECT value FROM config WHERE key = ? AND user_id = ?").get(key, userId) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string, userId = "legacy-user"): void {
  getDb().prepare(`
    INSERT INTO config (key, user_id, value, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key, user_id) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).run(key, userId, value);
}

export function getAllConfig(userId = "legacy-user"): Record<string, string> {
  const rows = getDb().prepare("SELECT key, value FROM config WHERE user_id = ?").all(userId) as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value;
  return result;
}

// ── Deploy Targets (user-scoped) ──

export interface DeployTarget {
  id: string;
  userId: string;
  type: "cma" | "busibox";
  name: string;
  config: Record<string, any>;
  status: "unconfigured" | "configured" | "deploying" | "deployed" | "error";
  lastDeployedAt: string | null;
  agentState: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

function rowToTarget(row: any): DeployTarget {
  const configJson = JSON.parse(row.config_json || "{}");
  if (configJson._encrypted_api_key) {
    try { configJson.apiKey = decrypt(configJson._encrypted_api_key); } catch { configJson.apiKey = ""; }
    delete configJson._encrypted_api_key;
  }
  return {
    id: row.id,
    userId: row.user_id || "legacy-user",
    type: row.type,
    name: row.name,
    config: configJson,
    status: row.status,
    lastDeployedAt: row.last_deployed_at,
    agentState: JSON.parse(row.agent_state_json || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTargets(userId?: string): DeployTarget[] {
  if (userId) {
    return getDb().prepare("SELECT * FROM deploy_targets WHERE user_id = ? ORDER BY created_at").all(userId).map(rowToTarget);
  }
  return getDb().prepare("SELECT * FROM deploy_targets ORDER BY created_at").all().map(rowToTarget);
}

export function getTarget(id: string, userId?: string): DeployTarget | undefined {
  if (userId) {
    const row = getDb().prepare("SELECT * FROM deploy_targets WHERE id = ? AND user_id = ?").get(id, userId);
    return row ? rowToTarget(row) : undefined;
  }
  const row = getDb().prepare("SELECT * FROM deploy_targets WHERE id = ?").get(id);
  return row ? rowToTarget(row) : undefined;
}

export function upsertTarget(target: DeployTarget): void {
  const configToStore = { ...target.config };
  if (configToStore.apiKey) {
    configToStore._encrypted_api_key = encrypt(configToStore.apiKey);
    delete configToStore.apiKey;
  }
  getDb().prepare(`
    INSERT INTO deploy_targets (id, user_id, type, name, config_json, status, last_deployed_at, agent_state_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      user_id=excluded.user_id, type=excluded.type, name=excluded.name, config_json=excluded.config_json,
      status=excluded.status, last_deployed_at=excluded.last_deployed_at,
      agent_state_json=excluded.agent_state_json, updated_at=datetime('now')
  `).run(
    target.id, target.userId || "legacy-user", target.type, target.name,
    JSON.stringify(configToStore), target.status,
    target.lastDeployedAt, JSON.stringify(target.agentState)
  );
}

export function deleteTarget(id: string, userId?: string): void {
  if (userId) {
    getDb().prepare("DELETE FROM mcp_connections WHERE target_id = ? AND target_id IN (SELECT id FROM deploy_targets WHERE user_id = ?)").run(id, userId);
    getDb().prepare("DELETE FROM deploy_targets WHERE id = ? AND user_id = ?").run(id, userId);
  } else {
    getDb().prepare("DELETE FROM mcp_connections WHERE target_id = ?").run(id);
    getDb().prepare("DELETE FROM deploy_targets WHERE id = ?").run(id);
  }
}

export function updateTargetStatus(id: string, status: DeployTarget["status"], agentState?: Record<string, any>): void {
  if (agentState) {
    getDb().prepare("UPDATE deploy_targets SET status = ?, agent_state_json = ?, last_deployed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(status, JSON.stringify(agentState), id);
  } else {
    getDb().prepare("UPDATE deploy_targets SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  }
}

// ── MCP Connections ──

export interface McpConnection {
  id: string;
  targetId: string;
  mcpName: string;
  status: "disconnected" | "connected" | "error";
  vaultId: string | null;
}

export function listMcpConnections(targetId: string): McpConnection[] {
  return getDb().prepare("SELECT * FROM mcp_connections WHERE target_id = ? ORDER BY mcp_name").all(targetId).map((row: any) => ({
    id: row.id,
    targetId: row.target_id,
    mcpName: row.mcp_name,
    status: row.status,
    vaultId: row.vault_id,
  }));
}

export function upsertMcpConnection(conn: McpConnection): void {
  getDb().prepare(`
    INSERT INTO mcp_connections (id, target_id, mcp_name, status, vault_id, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, vault_id=excluded.vault_id, updated_at=datetime('now')
  `).run(conn.id, conn.targetId, conn.mcpName, conn.status, conn.vaultId);
}
